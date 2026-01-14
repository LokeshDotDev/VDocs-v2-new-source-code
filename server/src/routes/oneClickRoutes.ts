import { Router, Request, Response } from 'express';
import jobService from '../services/jobService.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * PUBLIC endpoint → returned to browser
 * INTERNAL endpoint → Docker network fallback
 */
const TUS_PUBLIC_ENDPOINT =
  process.env.TUS_PUBLIC_ENDPOINT ||
  process.env.TUS_INTERNAL_ENDPOINT ||
  'http://localhost:4001';

/**
 * Initialize one-click upload
 * POST /api/one-click/upload
 * Body: { fileCount: number, folderStructure?: string[] }
 */
// Create job and return TUS upload config
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { fileCount, folderStructure } = req.body;
    if (!fileCount || typeof fileCount !== 'number' || fileCount <= 0) {
      return res.status(400).json({ error: 'fileCount is required' });
    }
    const job = jobService.createJob(fileCount);
    const jobId = job.jobId;
    logger.info({ jobId, fileCount, tusEndpoint: TUS_PUBLIC_ENDPOINT }, '[one-click/upload] Job initialized');
    res.json({
      jobId,
      uploadUrl: `${TUS_PUBLIC_ENDPOINT}/files`,
      metadata: {
        jobId,
        bucket: 'wedocs',
        folder: 'raw',
      },
    });
  } catch (error) {
    logger.error({ error }, '[one-click/upload] Error initializing');
    res.status(500).json({ error: 'Failed to initialize upload' });
  }
});
// Called by TUS or frontend after each file upload

// Enhanced upload-complete handler: triggers Reductor when all files uploaded
router.post('/upload-complete', async (req: Request, res: Response) => {
  try {
    const { jobId, fileKey } = req.body;
    if (!jobId || typeof jobId !== 'string' || !fileKey || typeof fileKey !== 'string') {
      return res.status(400).json({ error: 'jobId and fileKey are required' });
    }
    jobService.addRawFile(jobId, fileKey);
    const job = jobService.incrementUploadedFiles(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    logger.info({ jobId, uploadedFiles: job.uploadedFiles, expectedFiles: job.expectedFiles, status: job.status }, '[one-click/upload-complete] File upload recorded');

    // If all files uploaded, set to processing and trigger Reductor in background
    if (job.uploadedFiles === job.expectedFiles) {
      jobService.updateJobStatus(jobId, 'processing');
      void startJobProcessing(jobId);
    }

    res.json({ jobId, uploadedFiles: job.uploadedFiles, expectedFiles: job.expectedFiles, status: job.status });
  } catch (error) {
    logger.error({ error }, '[one-click/upload-complete] Error');
    res.status(500).json({ error: 'Failed to record upload completion' });
  }
});

// --- Reductor trigger logic ---
import fetch from 'node-fetch';
const REDUCTOR_URL = 'http://vdocs-reductor-service:5018/process';

async function startJobProcessing(jobId: string) {
  const job = jobService.getJob(jobId);
  if (!job) {
    logger.error({ jobId }, '[startJobProcessing] Job not found');
    return;
  }
  const payload = { jobId, rawFiles: job.rawFiles };
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(REDUCTOR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        logger.info({ jobId, attempt, status: resp.status }, '[startJobProcessing] Reductor triggered successfully');
        return;
      } else {
        const errorText = await resp.text();
        logger.error({ jobId, attempt, status: resp.status, error: errorText }, '[startJobProcessing] Reductor call failed');
        lastError = errorText;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logger.error({ jobId, attempt, error: lastError }, '[startJobProcessing] Reductor call error');
      if (attempt === 1) await new Promise(res => setTimeout(res, 1000));
    }
  }
  // All attempts failed
  jobService.updateJobStatus(jobId, 'failed', { errorMessage: lastError || 'Reductor call failed' });
  logger.error({ jobId, error: lastError }, '[startJobProcessing] Reductor call failed after retries, job marked as failed');
}

/**
 * Notify backend that a file upload is complete (called by TUS server)
 * POST /api/one-click/upload-complete
 * Body: { jobId: string }
 */
router.post('/upload-complete', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.body;
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ error: 'jobId is required' });
    }
    const job = jobService.incrementUploadedFiles(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    logger.info({ jobId, uploadedFiles: job.uploadedFiles, expectedFiles: job.expectedFiles, status: job.status }, '[one-click/upload-complete] File upload recorded');
    res.json({ jobId, uploadedFiles: job.uploadedFiles, expectedFiles: job.expectedFiles, status: job.status });
  } catch (error) {
    logger.error({ error }, '[one-click/upload-complete] Error');
    res.status(500).json({ error: 'Failed to record upload completion' });
  }
});

/**
 * Start processing uploaded files
 * POST /api/one-click/process
 */
// Only start processing if job.status === 'uploaded'
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.body;
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ error: 'jobId is required' });
    }
    const job = jobService.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status !== 'uploaded') {
      return res.status(400).json({ error: 'All files must be uploaded before processing can start' });
    }
    jobService.updateJobStatus(jobId, 'processing');
    res.json({ success: true, jobId, message: 'Processing started' });
    // Internal call (Docker-safe)
    fetch(`http://localhost:${process.env.PORT || 4000}/api/process/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    }).catch((err) => logger.error({ jobId, err }, '[one-click/process] Batch trigger failed'));
  } catch (error) {
    logger.error({ error }, '[one-click/process] Error');
    res.status(500).json({ error: 'Failed to start processing' });
  }
});

/**
 * Get job status
 * GET /api/one-click/status?jobId=xxx
 */
// Return job status directly, no heuristics
router.get('/status', async (req: Request, res: Response) => {
  try {
    const jobId = req.query.jobId as string;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }
    const job = jobService.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({
      jobId,
      status: job.status,
      expectedFiles: job.expectedFiles,
      uploadedFiles: job.uploadedFiles,
      rawFiles: job.rawFiles,
      exportZipKey: job.exportZipKey,
      errorMessage: job.errorMessage,
    });
  } catch (error) {
    logger.error({ error }, '[one-click/status] Error');
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

export default router;
