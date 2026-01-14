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
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { fileCount, folderStructure } = req.body;

    if (!fileCount || typeof fileCount !== 'number') {
      return res.status(400).json({ error: 'fileCount is required' });
    }

    // Create a new job
    const job = jobService.createJob();
    const jobId = job.jobId;

    logger.info(
      { jobId, fileCount, tusEndpoint: TUS_PUBLIC_ENDPOINT },
      '[one-click/upload] Job initialized'
    );

    // ✅ IMPORTANT: return PUBLIC TUS URL
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

/**
 * Start processing uploaded files
 * POST /api/one-click/process
 */
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

    jobService.updateJobStatus(jobId, 'processing');

    res.json({
      success: true,
      jobId,
      message: 'Processing started',
    });

    // Internal call (Docker-safe)
    fetch(`http://localhost:${process.env.PORT || 4000}/api/process/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    }).catch((err) =>
      logger.error({ jobId, err }, '[one-click/process] Batch trigger failed')
    );
  } catch (error) {
    logger.error({ error }, '[one-click/process] Error');
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

    const isComplete = job.status === 'completed';

    res.json({
      jobId,
      status: job.status,
      stage: isComplete
        ? 'complete'
        : job.status === 'processing'
        ? 'processing'
        : 'upload',
      progress: isComplete ? 100 : job.status === 'processing' ? 50 : 0,
      message: isComplete
        ? 'Processing complete!'
        : job.status === 'processing'
        ? 'Processing…'
        : 'Upload initialized',
      exportZipKey: job.exportZipKey,
      downloadUrl: job.exportZipKey
        ? `/api/files/download-zip?fileKey=${encodeURIComponent(job.exportZipKey)}`
        : undefined,
    });
  } catch (error) {
    logger.error({ error }, '[one-click/status] Error');
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

export default router;
