type JobStatus = {
	stage: string;
	progress: number;
	message: string;
	error?: string;
};

// Use globalThis to survive HMR in development
const globalForStore = globalThis as unknown as {
	jobStatusStore: Map<string, JobStatus> | undefined;
};

const jobStatuses = globalForStore.jobStatusStore ?? new Map<string, JobStatus>();
globalForStore.jobStatusStore = jobStatuses;

export function setJobStatus(jobId: string, status: JobStatus) {
	console.log(`[Store] Setting status for ${jobId}:`, status);
	jobStatuses.set(jobId, status);
	console.log(`[Store] Total jobs in store: ${jobStatuses.size}`);
}

export function getJobStatus(jobId: string) {
	const status = jobStatuses.get(jobId);
	console.log(`[Store] Getting status for ${jobId}:`, status ? 'FOUND' : 'NOT FOUND');
	if (!status) {
		console.log(`[Store] All job IDs in store:`, Array.from(jobStatuses.keys()));
	}
	return status;
}

export function jobExists(jobId: string) {
	return jobStatuses.has(jobId);
}

export function getAllJobs() {
	return Array.from(jobStatuses.entries());
}
