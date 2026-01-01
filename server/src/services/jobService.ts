import logger from '../lib/logger.js';

export interface Job {
  jobId: string;
  createdAt: Date;
  status: 'created' | 'uploading' | 'processing' | 'completed' | 'failed';
  fileCount: number;
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
  createJob(): Job {
    const jobId = `job-${new Date().toISOString().split('T')[0]}-${Date.now()}`;
    const job: Job = {
      jobId,
      createdAt: new Date(),
      status: 'created',
      fileCount: 0,
      rawFiles: [],
      anonymizedFiles: [],
      humanizedFiles: [],
    };
    this.jobs.set(jobId, job);
    logger.info({ jobId }, '[jobService] Job created');
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
  addRawFile(jobId: string, fileKey: string): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    if (!job.rawFiles.includes(fileKey)) {
      job.rawFiles.push(fileKey);
      job.fileCount = job.rawFiles.length;
    }

    logger.debug({ jobId, fileKey }, '[jobService] Raw file added');
    return job;
  }

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
