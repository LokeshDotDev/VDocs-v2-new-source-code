import { Router } from 'express';
import axios from 'axios';
import http from 'node:http';
import https from 'node:https';
import JSZip from 'jszip';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { minioClient } from '../lib/minio.js';
import HumanizerService from '../services/humanizerService.js';
import jobService from '../services/jobService.js';
import logger from '../lib/logger.js';

const router = Router();

// Prefer IPv4 loopback to avoid IPv6 localhost resolution issues when the reductor binds only on IPv4
const envReductorUrl = process.env['REDUCTOR_SERVICE_V2_URL'];
const REDUCTOR_SERVICE_V2_URL = envReductorUrl && envReductorUrl.includes('localhost')
  ? envReductorUrl.replace('localhost', '127.0.0.1')
  : (envReductorUrl || 'http://127.0.0.1:5018');
const MINIO_BUCKET = process.env['MINIO_BUCKET'] || 'wedocs';

// Force IPv4 + disable proxies to avoid EADDRNOTAVAIL/IPv6 proxy issues
const reductorHttpAgent = new http.Agent({ family: 4, keepAlive: true, localAddress: '127.0.0.1', maxSockets: 50 });
const reductorHttpsAgent = new https.Agent({ family: 4, keepAlive: true, localAddress: '127.0.0.1', maxSockets: 50 });
const reductorClient = axios.create({
  baseURL: REDUCTOR_SERVICE_V2_URL,
  timeout: 600000,
  proxy: false,
  httpAgent: reductorHttpAgent,
  httpsAgent: reductorHttpsAgent,
  maxRedirects: 0,
});

const humanizerService = new HumanizerService(minioClient as any);

/**
 * Batch process endpoint (job-based): anonymize PDFs → humanize DOCX → zip results
 * POST /api/process/batch
 * Body: { jobId: string, fileKeys?: string[] }
 * If fileKeys not provided, uses all raw files from jobId
 * 
 * Returns: { status, jobId, downloadUrl, zipKey }
 */
router.post('/batch', async (req, res) => {
  let jobId: string | undefined;
  try {
    const { fileKeys } = req.body;
    jobId = req.body?.jobId;

    if (!jobId || typeof jobId !== 'string') {
      logger.warn({ jobId }, '[batch] Missing or invalid jobId');
      return res.status(400).json({ error: 'jobId (string) is required' });
    }

    // Get or verify job exists
    let job = jobService.getJob(jobId);
    if (!job) {
      logger.warn({ jobId }, '[batch] Job not found');
      return res.status(404).json({ error: 'Job not found', jobId });
    }


    // Always scan MinIO for files in this job's raw folder before processing
    const jobPaths = jobService.getJobPaths(jobId);
    const rawPrefix = jobPaths.raw.endsWith('/') ? jobPaths.raw : jobPaths.raw + '/';
    const foundFiles = [];
    for await (const obj of minioClient.listObjectsV2(MINIO_BUCKET, rawPrefix, true)) {
      if (obj.name && obj.name.toLowerCase().endsWith('.pdf')) {
        foundFiles.push(obj.name);
      }
    }
    job.rawFiles = foundFiles;
    job.fileCount = foundFiles.length;

    // Use provided fileKeys or fall back to job's raw files (now updated)
    const filesToProcess = fileKeys || job.rawFiles;

    if (!Array.isArray(filesToProcess) || filesToProcess.length === 0) {
      logger.warn({ jobId }, '[batch] No files to process');
      return res.status(400).json({ error: 'No files to process in job', jobId });
    }

    logger.info({ jobId, fileCount: filesToProcess.length }, '[batch] Starting batch processing - ALL files through full pipeline');
    jobService.updateJobStatus(jobId, 'processing');

    // ===== 1) Redact PII via Presidio for ALL files =====
    const anonymizedKeys: string[] = [];

    for (const fileKey of filesToProcess) {
      if (!fileKey || typeof fileKey !== 'string') {
        logger.warn({ fileKey }, '[batch] Skipping invalid fileKey');
        continue;
      }

      if (!fileKey.toLowerCase().endsWith('.pdf')) {
        logger.warn({ fileKey }, '[batch] Skipping non-PDF file');
        continue;
      }

      try {
        logger.info({ jobId, fileKey }, '[batch] Requesting Presidio-based PII redaction');

        const resp = await axios.post(
          `${REDUCTOR_SERVICE_V2_URL}/presidio-redact`,
          { bucket: MINIO_BUCKET, object_key: fileKey },
          { timeout: 600000 }
        );

        if (resp.status === 200 && resp.data?.minio_output_key) {
          const anonymizedKey = resp.data.minio_output_key;
          anonymizedKeys.push(anonymizedKey);
          jobService.addAnonymizedFile(jobId, anonymizedKey);
          logger.info({ 
            jobId, 
            fileKey, 
            output: anonymizedKey,
            detectionsCount: resp.data.detections_count,
            piiTypes: resp.data.pii_types
          }, '[batch] Presidio redaction success');
        } else {
          logger.error({ resp: resp.data }, '[batch] Presidio redaction did not return expected key');
        }
      } catch (err: any) {
        logger.error({ err, jobId, fileKey }, '[batch] Presidio redaction failed');
      }
    }

    if (anonymizedKeys.length === 0) {
      jobService.updateJobStatus(jobId, 'failed', {
        errorMessage: 'No files were successfully redacted',
      });
      return res.status(500).json({ error: 'No files were successfully redacted', jobId });
    }

    logger.info({ jobId, count: anonymizedKeys.length }, '[batch] PII redaction complete for all files');

    // ===== 2) Trigger humanizer batch for ALL redacted files =====
    logger.info({ jobId, count: anonymizedKeys.length }, '[batch] Starting humanization for all redacted files');
    const jobId_humanize = await humanizerService.batchHumanize(anonymizedKeys);

    // ===== 3) Poll job status until complete or timeout =====
      const timeoutMs = 1000 * 60 * 30; // 30 minutes
      const pollInterval = 2000; // 2 seconds
      const start = Date.now();
      let jobStatus = humanizerService.getJobStatus(jobId_humanize);

      while (jobStatus && jobStatus.status === 'processing' && Date.now() - start < timeoutMs) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, pollInterval));
        jobStatus = humanizerService.getJobStatus(jobId_humanize);
        const elapsed = Math.round((Date.now() - start) / 1000);
        const progress = jobStatus?.progress || 0;
        logger.info({ jobId, elapsed, progress }, '[batch] Humanization in progress');
      }

      if (!jobStatus || jobStatus.status !== 'completed') {
        jobService.updateJobStatus(jobId, 'failed', {
          errorMessage: 'Humanization job failed or timed out',
        });
        return res.status(500).json({
          error: 'Humanization job failed or timed out',
          jobId,
          status: jobStatus?.status,
        });
      }

      logger.info({ jobId, results: jobStatus.results.length }, '[batch] Humanization complete');
      const humanizedResults = jobStatus.results;

    // ===== 4) Create ZIP of all final files =====
    logger.info({ 
      jobId, 
      filesCount: humanizedResults.length,
      totalForZip: humanizedResults.length
    }, '[batch] Creating ZIP file with all humanized files');
    const zip = new JSZip();

    // Add all humanized files
    for (const result of humanizedResults) {
      const key = result.outputFileKey;
      try {
        // eslint-disable-next-line no-await-in-loop
        const stream = await minioClient.getObject(MINIO_BUCKET, key);
        const chunks: Buffer[] = [];

        // eslint-disable-next-line no-await-in-loop
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }

        const buf = Buffer.concat(chunks);
        // Preserve original upload structure: drop stage folder if present
        let relativePath = key.replace(`jobs/${jobId}/`, '');
        const segments = relativePath.split('/');
        const STAGE_DIRS = new Set(['anonymized', 'humanized', 'reduced', 'exports', 'processed']);
        if (segments.length > 1 && segments[0] && STAGE_DIRS.has(segments[0])) {
          relativePath = segments.slice(1).join('/');
        }
        zip.file(relativePath, buf);
        logger.info({ jobId, relativePath }, '[batch] Added humanized AI file to ZIP');
        jobService.addHumanizedFile(jobId, key);
      } catch (err: any) {
        logger.error({ err, jobId, key }, '[batch] Failed to fetch humanized file for zip');
      }
    }
    // Note: previously we added anonymized Non-AI files separately.
    // With the unified pipeline, all files go through humanization and are already handled above.
    
    // ===== 6) Upload ZIP to MinIO under job/exports =====
    logger.info({ jobId }, '[batch] Uploading ZIP to MinIO');
    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
    const zipFilename = `${jobId}-export.zip`;
    const zipKey = `${jobPaths.exports}/${zipFilename}`;
    const tmpZipPath = path.join(os.tmpdir(), `${jobId}-${Date.now()}.zip`);

    await fs.promises.writeFile(tmpZipPath, zipContent);

    await minioClient.fPutObject(MINIO_BUCKET, zipKey, tmpZipPath, {
      'Content-Type': 'application/zip',
    });

    logger.info({ jobId, zipKey, size: zipContent.length }, '[batch] ZIP uploaded');
    jobService.setExportZipKey(jobId, zipKey);

    // ===== 7) NO CLEANUP - keep all files organized under job ======
    logger.info({ jobId }, '[batch] All files preserved under job directory');

    // Clean up temp ZIP file only
    await fs.promises.unlink(tmpZipPath).catch(() => undefined);

    // ===== 8) Mark job as completed =====
    jobService.updateJobStatus(jobId, 'completed');

    // ===== 9) Return success =====
    const downloadUrl = `/api/files/download-zip?fileKey=${encodeURIComponent(zipKey)}`;

    logger.info({ jobId, downloadUrl }, '[batch] Processing complete');

    return res.json({
      status: 'success',
      jobId,
      downloadUrl,
      zipKey,
      filesProcessed: humanizedResults.length,
    });
  } catch (err: any) {
    if (jobId) {
      jobService.updateJobStatus(jobId, 'failed', {
        errorMessage: err.message || 'Batch processing failed',
      });
    }
    logger.error({ err, jobId }, '[batch] Batch processing failed');
    
    // Always return a JSON response, never let Express handle the error
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: err.message || 'Batch processing failed', 
        details: err.code || err.toString(),
        jobId 
      });
    }
    // Headers already sent, just end the response
    return res.end();
  }
});

/**
 * DEBUG: Check files in MinIO for a job
 * GET /api/process/debug-files?jobId=xxx
 */
router.get('/debug-files', async (req, res) => {
  try {
    const jobId = req.query.jobId as string;
    
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const job = jobService.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const jobPaths = jobService.getJobPaths(jobId);
    const rawPrefix = jobPaths.raw.endsWith('/') ? jobPaths.raw : jobPaths.raw + '/';
    
    const rawFiles = [];
    const anonymizedFiles = [];
    const humanizedFiles = [];
    const allObjects = [];

    // Scan all job folders
    for await (const obj of minioClient.listObjectsV2(MINIO_BUCKET, `jobs/${jobId}/`, true)) {
      if (obj.name) {
        allObjects.push(obj.name);
        
        if (obj.name.includes('/raw/')) {
          rawFiles.push(obj.name);
        } else if (obj.name.includes('/anonymized/')) {
          anonymizedFiles.push(obj.name);
        } else if (obj.name.includes('/humanized/')) {
          humanizedFiles.push(obj.name);
        }
      }
    }

    return res.json({
      jobId,
      jobPaths,
      files: {
        raw: rawFiles,
        anonymized: anonymizedFiles,
        humanized: humanizedFiles,
      },
      allObjects,
      summary: {
        rawCount: rawFiles.length,
        anonymizedCount: anonymizedFiles.length,
        humanizedCount: humanizedFiles.length,
        total: allObjects.length,
      }
    });
  } catch (err: any) {
    logger.error({ err }, '[debug-files] Error');
    return res.status(500).json({ error: err.message });
  }
});

export default router;
