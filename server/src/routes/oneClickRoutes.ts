import { Router, Request, Response } from 'express';
import type { Job } from '../services/jobService.js';

interface ReductorResponse {
  minio_output_key?: string;
  [key: string]: any;
}

interface ZipResponse {
  zipKey?: string;
  [key: string]: any;
}
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
type Results = { outputFileKey: string }[];

async function startJobProcessing(jobId: string) {
  const job = jobService.getJob(jobId) as Job | undefined;
  if (!job) {
    logger.error({ jobId }, '[startJobProcessing] Job not found');
    return;
  }

  const REDUCTOR_BASE_URL = process.env.REDUCTOR_V2_MODULE_URL || 'http://vdocs-reductor-service-f4mqw1:5018';
  logger.info({ jobId, REDUCTOR_BASE_URL }, '[startJobProcessing] Resolved Reductor URL');

  // 1. Use environment-based URLs for all services
  const REDUCTOR_URL = process.env.REDUCTOR_V2_MODULE_URL || 'http://reductor:5018';
  const HUMANIZER_URL = process.env.HUMANIZER_MODULE_URL || 'http://humanizer:8000';
  const GRAMMAR_URL = process.env.GRAMMAR_MODULE_URL || 'http://grammar:8001';
  const API_BASE_URL = process.env.API_BASE_URL || 'http://server:3000';

  // 2. Run Reductor (Presidio) for all raw files
  for (const fileKey of job.rawFiles) {
    const payload = {
      bucket: 'wedocs',
      object_key: fileKey,
    };
    let lastError: string | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch(`${REDUCTOR_URL}/anonymize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (resp.ok) {
          logger.info({ jobId, fileKey, attempt, status: resp.status }, '[startJobProcessing] Reductor /anonymize success');
          const result: ReductorResponse = await resp.json();
          if (result.minio_output_key) {
            jobService.addAnonymizedFile(jobId, result.minio_output_key);
          }
          break;
        } else {
          const errorText = await resp.text();
          logger.error({ jobId, fileKey, attempt, status: resp.status, error: errorText }, '[startJobProcessing] Reductor /anonymize failed');
          lastError = errorText;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.error({ jobId, fileKey, attempt, error: lastError }, '[startJobProcessing] Reductor /anonymize error');
        if (attempt === 1) await new Promise(res => setTimeout(res, 1000));
      }
    }
    if (lastError) {
      jobService.updateJobStatus(jobId, 'failed', { errorMessage: lastError });
      logger.error({ jobId, fileKey, error: lastError }, '[startJobProcessing] Reductor /anonymize failed after retries');
      return;
    }
  }

  // 3. Send anonymized files to Python Manager for further processing (Humanizer + Grammar)
  jobService.updateJobStatus(jobId, 'processing');
  try {
    const PYTHON_MANAGER_URL = process.env.PYTHON_MANAGER_URL || 'http://vdocs-python-manager-falfws:5000';
    const response = await fetch(`${PYTHON_MANAGER_URL}/process-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, fileKeys: job.anonymizedFiles }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      jobService.updateJobStatus(jobId, 'failed', { errorMessage: errorText });
      logger.error({ jobId, error: errorText }, '[startJobProcessing] Python Manager process-job failed');
      return;
    }
    const result = await response.json();
    logger.info({ jobId, result }, '[startJobProcessing] Python Manager process-job started');
  } catch (err) {
    jobService.updateJobStatus(jobId, 'failed', { errorMessage: String(err) });
    logger.error({ jobId, error: String(err) }, '[startJobProcessing] Python Manager process-job error');
    return;
  }
  // Optionally, poll Python Manager for job status and continue pipeline as needed
  // (ZIP creation and job completion should be handled after Python Manager signals completion)
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

    const job = jobService.getJob(jobId) as Job | undefined;
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
