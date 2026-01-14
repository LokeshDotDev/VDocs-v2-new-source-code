import logger from '../lib/logger.js';

export interface Job {
  jobId: string;
  createdAt: Date;
  status: 'uploading' | 'uploaded' | 'processing' | 'completed' | 'failed';
  expectedFiles: number;
  uploadedFiles: number;
  fileCount: number; // always equals expectedFiles
  rawFiles: string[];
  anonymizedFiles: string[];
  humanizedFiles: string[];
  exportZipKey?: string;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

class JobService {
  private jobs: Map<string, Job> = new Map();

  /**
   * Create a new job
   */
  // Create a new job with expectedFiles
  createJob(expectedFiles: number): Job {
    const jobId = `job-${new Date().toISOString().split('T')[0]}-${Date.now()}`;
    const job: Job = {
      jobId,
      createdAt: new Date(),
      status: 'uploading',
      expectedFiles,
      uploadedFiles: 0,
      fileCount: expectedFiles,
      rawFiles: [],
      anonymizedFiles: [],
      humanizedFiles: [],
    };
    this.jobs.set(jobId, job);
    logger.info({ jobId, expectedFiles }, '[jobService] Job created');
    return job;
  }
  /**
   * Increment uploadedFiles for a job. Returns updated job.
   */
  incrementUploadedFiles(jobId: string): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    job.uploadedFiles = (job.uploadedFiles || 0) + 1;
    logger.info({ jobId, uploadedFiles: job.uploadedFiles, expectedFiles: job.expectedFiles }, '[jobService] Uploaded file incremented');
    if (job.uploadedFiles === job.expectedFiles) {
      job.status = 'uploaded';
      logger.info({ jobId }, '[jobService] All files uploaded, status set to uploaded');
    }
    return job;
  }

  /**
   * Set expectedFiles for a job (if needed)
   */
  setExpectedFiles(jobId: string, expectedFiles: number): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    job.expectedFiles = expectedFiles;
    logger.info({ jobId, expectedFiles }, '[jobService] expectedFiles set');
    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * List all jobs
   */
  listJobs(): Job[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Update job status
   */
  updateJobStatus(
    jobId: string,
    status: Job['status'],
    options?: { errorMessage?: string }
  ): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    job.status = status;
    if (status === 'processing' && !job.startedAt) {
      job.startedAt = new Date();
    }
    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date();
    }
    if (options?.errorMessage) {
      job.errorMessage = options.errorMessage;
    }

    logger.info({ jobId, status }, '[jobService] Job status updated');
    return job;
  }

  /**
   * Add raw file to job
   */
  // Add a raw file to job (does not affect status)
  addRawFile(jobId: string, fileKey: string): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    if (!job.rawFiles.includes(fileKey)) {
      job.rawFiles.push(fileKey);
    }
    logger.debug({ jobId, fileKey }, '[jobService] Raw file added');
    return job;
  }
  // ...existing code...

  /**
   * Add anonymized file to job
   */
  addAnonymizedFile(jobId: string, fileKey: string): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    if (!job.anonymizedFiles.includes(fileKey)) {
      job.anonymizedFiles.push(fileKey);
    }

    logger.debug({ jobId, fileKey }, '[jobService] Anonymized file added');
    return job;
  }

  /**
   * Add humanized file to job
   */
  addHumanizedFile(jobId: string, fileKey: string): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    if (!job.humanizedFiles.includes(fileKey)) {
      job.humanizedFiles.push(fileKey);
    }

    logger.debug({ jobId, fileKey }, '[jobService] Humanized file added');
    return job;
  }

  /**
   * Set export ZIP key
   */
  setExportZipKey(jobId: string, zipKey: string): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    job.exportZipKey = zipKey;
    logger.info({ jobId, zipKey }, '[jobService] Export ZIP set');
    return job;
  }

  /**
   * Get MinIO paths for job
   */
  getJobPaths(jobId: string) {
    return {
      raw: `jobs/${jobId}/raw`,
      anonymized: `jobs/${jobId}/anonymized`,
      humanized: `jobs/${jobId}/humanized`,
      exports: `jobs/${jobId}/exports`,
    };
  }

  /**
   * Get full MinIO key for a file in job
   */
  getJobFileKey(jobId: string, stage: 'raw' | 'anonymized' | 'humanized' | 'exports', filename: string): string {
    const paths = this.getJobPaths(jobId);
    return `${paths[stage]}/${filename}`;
  }
}

export default new JobService();
