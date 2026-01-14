import { Router, Request, Response } from 'express';
import jobService from '../services/jobService.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * Public → browser
 * Internal → docker network
 */
const TUS_PUBLIC_ENDPOINT =
  process.env.TUS_PUBLIC_ENDPOINT ||
  process.env.TUS_INTERNAL_ENDPOINT ||
  'http://localhost:4001';

const REDUCTOR_URL =
  `${process.env.REDUCTOR_V2_MODULE_URL || 'http://vdocs-reductor-service-f4mqw1:5018'}/process`;

logger.info({ TUS_PUBLIC_ENDPOINT, REDUCTOR_URL }, '[one-click] Config loaded');

/**
 * ----------------------------------------------------
 * 1️⃣ INIT UPLOAD (called by frontend)
 * ----------------------------------------------------
 */
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const { fileCount } = req.body;

    if (!fileCount || typeof fileCount !== 'number' || fileCount <= 0) {
      return res.status(400).json({ error: 'fileCount is required' });
    }

    const job = jobService.createJob(fileCount);
    const jobId = job.jobId;

    logger.info(
      { jobId, fileCount },
      '[one-click/upload] Job initialized'
    );

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
    logger.error({ error }, '[one-click/upload] Failed');
    res.status(500).json({ error: 'Failed to initialize upload' });
  }
});

/**
 * ----------------------------------------------------
 * 2️⃣ FILE UPLOAD COMPLETE (called by TUS server)
 * ----------------------------------------------------
 */
router.post('/upload-complete', async (req: Request, res: Response) => {
  try {
    const { jobId, fileKey } = req.body;

    if (!jobId || !fileKey) {
      return res.status(400).json({ error: 'jobId and fileKey are required' });
    }

    // Track raw file
    jobService.addRawFile(jobId, fileKey);

    // Increment uploaded file count
    const job = jobService.incrementUploadedFiles(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    logger.info(
      {
        jobId,
        uploadedFiles: job.uploadedFiles,
        expectedFiles: job.expectedFiles,
        rawFiles: job.rawFiles.length,
      },
      '[one-click/upload-complete] File registered'
    );

    // 🔥 All files uploaded → start processing
    if (job.uploadedFiles === job.expectedFiles) {
      logger.info({ jobId }, '[one-click] All files uploaded');

      jobService.updateJobStatus(jobId, 'uploaded');
      jobService.updateJobStatus(jobId, 'processing');

      // Fire & forget
      void startJobProcessing(jobId);
    }

    res.json({
      jobId,
      uploadedFiles: job.uploadedFiles,
      expectedFiles: job.expectedFiles,
      status: job.status,
    });
  } catch (error) {
    logger.error({ error }, '[one-click/upload-complete] Error');
    res.status(500).json({ error: 'Failed to record upload completion' });
  }
});

/**
 * ----------------------------------------------------
 * 3️⃣ REDUCTOR TRIGGER (internal)
 * ----------------------------------------------------
 */
async function startJobProcessing(jobId: string) {
  const job = jobService.getJob(jobId);
  if (!job) {
    logger.error({ jobId }, '[startJobProcessing] Job not found');
    return;
  }

  const payload = {
    jobId,
    rawFiles: job.rawFiles,
  };

  logger.info(
    { jobId, rawFiles: job.rawFiles.length, REDUCTOR_URL },
    '[startJobProcessing] Calling Reductor'
  );

  let lastError: string | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(REDUCTOR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (resp.ok) {
        logger.info(
          { jobId, attempt },
          '[startJobProcessing] Reductor triggered successfully'
        );
        return;
      }

      const text = await resp.text();
      lastError = text;

      logger.error(
        { jobId, attempt, status: resp.status, text },
        '[startJobProcessing] Reductor error'
      );
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);

      logger.error(
        { jobId, attempt, error: lastError },
        '[startJobProcessing] Fetch failed'
      );

      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // ❌ All retries failed
  jobService.updateJobStatus(jobId, 'failed', {
    errorMessage: lastError || 'Reductor failed',
  });

  logger.error(
    { jobId, error: lastError },
    '[startJobProcessing] Job marked as failed'
  );
}

/**
 * ----------------------------------------------------
 * 4️⃣ JOB STATUS (frontend polling)
 * ----------------------------------------------------
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
