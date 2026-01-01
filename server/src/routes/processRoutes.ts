import { Router } from 'express';
import axios from 'axios';
import JSZip from 'jszip';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { minioClient } from '../lib/minio.js';
import HumanizerService from '../services/humanizerService.js';
import jobService from '../services/jobService.js';
import logger from '../lib/logger.js';

const router = Router();

const REDUCTOR_SERVICE_V2_URL = process.env['REDUCTOR_SERVICE_V2_URL'] || 'http://localhost:5018';
const MINIO_BUCKET = process.env['MINIO_BUCKET'] || 'wedocs';

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

    logger.info({ jobId, fileCount: filesToProcess.length }, '[batch] Starting batch processing');
    jobService.updateJobStatus(jobId, 'processing');

    // const jobPaths = jobService.getJobPaths(jobId); // Already declared above, remove this line
    // ===== 1) Anonymize each PDF via Reductor V2 =====
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
        logger.info({ jobId, fileKey }, '[batch] Requesting anonymization');

        const resp = await axios.post(
          `${REDUCTOR_SERVICE_V2_URL}/anonymize`,
          { bucket: MINIO_BUCKET, object_key: fileKey },
          { timeout: 600000 }
        );

        if (resp.status === 200 && resp.data?.minio_output_key) {
          const anonymizedKey = resp.data.minio_output_key;
          anonymizedKeys.push(anonymizedKey);
          jobService.addAnonymizedFile(jobId, anonymizedKey);
          logger.info({ jobId, fileKey, output: anonymizedKey }, '[batch] Anonymization success');
        } else {
          logger.error({ resp: resp.data }, '[batch] Anonymization did not return expected key');
        }
      } catch (err: any) {
        logger.error({ err, jobId, fileKey }, '[batch] Anonymization failed');
      }
    }

    if (anonymizedKeys.length === 0) {
      jobService.updateJobStatus(jobId, 'failed', {
        errorMessage: 'No files were successfully anonymized',
      });
      return res.status(500).json({ error: 'No files were successfully anonymized', jobId });
    }

    logger.info({ jobId, count: anonymizedKeys.length }, '[batch] Anonymization complete');

    // ===== 2) Trigger humanizer batch =====
    logger.info({ jobId }, '[batch] Starting humanization');
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

    // ===== 4) Create ZIP of humanized files =====
    logger.info({ jobId }, '[batch] Creating ZIP file');
    const zip = new JSZip();

    for (const result of jobStatus.results) {
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
        const filename = path.basename(key);
        zip.file(filename, buf);
        logger.info({ jobId, filename }, '[batch] Added file to ZIP');
        jobService.addHumanizedFile(jobId, key);
      } catch (err: any) {
        logger.error({ err, jobId, key }, '[batch] Failed to fetch humanized file for zip');
      }
    }

    // ===== 5) Upload ZIP to MinIO under job/exports =====
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

    // ===== 6) NO CLEANUP - keep all files organized under job ======
    logger.info({ jobId }, '[batch] All files preserved under job directory');

    // Clean up temp ZIP file only
    await fs.promises.unlink(tmpZipPath).catch(() => undefined);

    // ===== 7) Mark job as completed =====
    jobService.updateJobStatus(jobId, 'completed');

    // ===== 8) Return success =====
    const downloadUrl = `/api/files/download-zip?fileKey=${encodeURIComponent(zipKey)}`;

    logger.info({ jobId, downloadUrl }, '[batch] Processing complete');

    return res.json({
      status: 'success',
      jobId,
      downloadUrl,
      zipKey,
      filesProcessed: jobStatus.results.length,
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

export default router;
