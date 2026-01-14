import { Router, Request, Response } from 'express';
import jobService from '../services/jobService.js';
import logger from '../lib/logger.js';

const router = Router();

const TUS_PUBLIC_ENDPOINT =
  process.env.TUS_PUBLIC_ENDPOINT ||
  process.env.TUS_INTERNAL_ENDPOINT ||
  process.env.TUS_SERVER_URL ||
  'http://localhost:4001';

/**
 * Initialize one-click upload
 * POST /api/one-click/upload
 * Body: { fileCount: number, folderStructure?: string[] }
 */
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { fileCount, folderStructure } = req.body;

    if (!fileCount || typeof fileCount !== 'number') {
      return res.status(400).json({ error: 'fileCount is required' });
    }

    // Create a new job
    const job = jobService.createJob();
    const jobId = job.jobId;

    logger.info({ jobId, fileCount }, '[one-click/upload] Job initialized');

    // Return TUS upload configuration
    res.json({
      jobId,
      uploadUrl: `${TUS_SERVER_URL}/files`,
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

/**
 * Start processing uploaded files
 * POST /api/one-click/process
 * Body: { jobId: string }
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.body;

    logger.info({ jobId, body: req.body }, '[one-click/process] Received request');

    if (!jobId || typeof jobId !== 'string') {
      logger.warn({ jobId }, '[one-click/process] Invalid or missing jobId');
      return res.status(400).json({ error: 'jobId is required' });
    }

    // Verify job exists
    const job = jobService.getJob(jobId);
    if (!job) {
      logger.warn({ jobId }, '[one-click/process] Job not found in jobService');
      return res.status(404).json({ error: 'Job not found' });
    }

    // Update job status to processing
    jobService.updateJobStatus(jobId, 'processing');

    logger.info({ jobId }, '[one-click/process] Starting background processing');

    // Respond immediately - batch processing happens in background
    res.json({
      success: true,
      jobId,
      message: 'Processing started',
    });

    // Trigger batch processing asynchronously (don't wait)
    // The frontend will poll for status
    logger.info({ jobId }, '[one-click/process] Triggering background batch processing');
    fetch(`http://localhost:${process.env.PORT || 4000}/api/process/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    })
      .then(() => logger.info({ jobId }, '[one-click/process] Batch processing started'))
      .catch((err) => logger.error({ jobId, err }, '[one-click/process] Failed to start batch'));
  } catch (error) {
    logger.error({ error }, '[one-click/process] Error starting process');
    res.status(500).json({ error: 'Failed to start processing' });
  }
});

/**
 * Get job status
 * GET /api/one-click/status?jobId=xxx
 */
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

    // Derive UI-friendly stage/progress/message from job status
    const isComplete = job.status === 'completed';
    const stage = isComplete ? 'complete' : (job.status === 'processing' ? 'processing' : 'upload');
    const progress = isComplete ? 100 : (job.status === 'processing' ? 50 : 0);
    const message = isComplete ? 'Processing complete!' : (job.status === 'processing' ? 'Processing…' : 'Upload initialized');

    // Provide download information if available
    const exportZipKey = job.exportZipKey;
    const downloadUrl = exportZipKey ? `/api/files/download-zip?fileKey=${encodeURIComponent(exportZipKey)}` : undefined;

    res.json({
      jobId,
      status: job.status,
      progress,
      stage,
      message,
      exportZipKey,
      downloadUrl,
    });
  } catch (error) {
    logger.error({ error }, '[one-click/status] Error fetching status');
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

/**
 * Download processed files
 * GET /api/one-click/download?jobId=xxx
 */
router.get('/download', async (req: Request, res: Response) => {
  try {
    const jobId = req.query.jobId as string;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const job = jobService.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Job is not complete yet' });
    }

    // Ensure we have the ZIP key
    if (!job.exportZipKey) {
      return res.status(404).json({ error: 'ZIP not available for this job yet' });
    }

    // Redirect to the actual download URL using fileKey
    const downloadUrl = `/api/files/download-zip?fileKey=${encodeURIComponent(job.exportZipKey)}`;
    res.redirect(downloadUrl);
  } catch (error) {
    logger.error({ error }, '[one-click/download] Error downloading');
    res.status(500).json({ error: 'Failed to download' });
  }
});

export default router;
