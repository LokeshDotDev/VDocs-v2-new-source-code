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
    res.json({ jobId, uploadedFiles: job.uploadedFiles, expectedFiles: job.expectedFiles, status: job.status });
  } catch (error) {
    logger.error({ error }, '[one-click/upload-complete] Error');
    res.status(500).json({ error: 'Failed to record upload completion' });
  }
});

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
