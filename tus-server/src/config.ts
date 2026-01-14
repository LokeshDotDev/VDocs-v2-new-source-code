const envVars = process.env;

// Validate required config values
function getRequiredEnv(key: string): string {
  const value = envVars[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
  return envVars[key] || defaultValue;
}

export const config = {
  port: Number(envVars.PORT) || 4001,
  tusPath: envVars.TUS_PATH || "/files",
  storageDir: envVars.TUS_STORAGE_DIR || ".data/tus",
  maxUploadSizeBytes: Number(envVars.MAX_UPLOAD_SIZE_BYTES) || 50 * 1024 * 1024 * 1024,
  minio: {
    endpoint: getRequiredEnv('MINIO_ENDPOINT'),
    port: Number(getRequiredEnv('MINIO_PORT')),
    useSSL: getRequiredEnv('MINIO_USE_SSL').toLowerCase() === 'true',
    accessKey: getRequiredEnv('MINIO_ACCESS_KEY'),
    secretKey: getRequiredEnv('MINIO_SECRET_KEY'),
    bucket: getRequiredEnv('MINIO_BUCKET'),
  },
};
