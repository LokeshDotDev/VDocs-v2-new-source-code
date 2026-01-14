import { Router } from 'express';
import jobService from '../services/jobService.js';
import logger from '../lib/logger.js';

const router = Router();

/**
 * Create a new job
 * POST /api/jobs/create
 * Returns: { jobId, status, createdAt }
 */
// You must provide expectedFiles for job creation
router.post('/create', (req, res) => {
  try {
    const { expectedFiles } = req.body;
    if (!expectedFiles || typeof expectedFiles !== 'number' || expectedFiles <= 0) {
      return res.status(400).json({ error: 'expectedFiles is required and must be a positive number' });
    }
    const job = jobService.createJob(expectedFiles);
    res.json({
      jobId: job.jobId,
      status: job.status,
      createdAt: job.createdAt,
      paths: jobService.getJobPaths(job.jobId),
    });
  } catch (err: any) {
    logger.error({ err }, '[jobs/create] Error');
    res.status(500).json({ error: err.message || 'Failed to create job' });
  }
});

/**
 * List all jobs
 * GET /api/jobs
 * Returns: { jobs: Job[] }
 */
router.get('/', (req, res) => {
  try {
    const jobs = jobService.listJobs();
    res.json({ jobs, total: jobs.length });
  } catch (err: any) {
    logger.error({ err }, '[jobs/list] Error');
    res.status(500).json({ error: err.message || 'Failed to list jobs' });
  }
});

/**
 * Get job by ID
 * GET /api/jobs/:jobId
 * Returns: { job: Job }
 */
router.get('/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobService.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found', jobId });
    }

    res.json({
      job,
      paths: jobService.getJobPaths(jobId),
    });
  } catch (err: any) {
    logger.error({ err }, '[jobs/get] Error');
    res.status(500).json({ error: err.message || 'Failed to get job' });
  }
});

/**
 * Get job status
 * GET /api/jobs/:jobId/status
 * Returns: { jobId, status, progress, stats }
 */
router.get('/:jobId/status', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobService.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found', jobId });
    }

    const progress =
      job.fileCount > 0
        ? Math.round(
            ((job.anonymizedFiles.length + job.humanizedFiles.length) / (job.fileCount * 2)) * 100
          )
        : 0;

    // If exportZipKey is missing but job is completed, reconstruct it
    let exportZipKey = job.exportZipKey;
    if (!exportZipKey && job.status === 'completed') {
      // Reconstruct the expected export ZIP key
      exportZipKey = `jobs/${jobId}/exports/${jobId}-export.zip`;
    }
    res.json({
      jobId,
      status: job.status,
      progress,
      stats: {
        uploaded: job.rawFiles.length,
        anonymized: job.anonymizedFiles.length,
        humanized: job.humanizedFiles.length,
        total: job.fileCount,
      },
      exportZipKey,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  } catch (err: any) {
    logger.error({ err }, '[jobs/status] Error');
    res.status(500).json({ error: err.message || 'Failed to get job status' });
  }
});

/**
 * Import recent uploaded files (users/<user>/uploads/<uploadId>/raw) into job raw folder
 * POST /api/jobs/:jobId/import
 * Body (optional): { srcPrefix?: string, maxAgeMinutes?: number }
 */

export default router;
