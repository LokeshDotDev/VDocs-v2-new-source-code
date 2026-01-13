import * as Minio from 'minio';
import { config } from './config.js';
import logger from './logger.js';

export const minioClient = new Minio.Client({
  endPoint: config.MINIO_ENDPOINT,
  port: config.MINIO_PORT,
  useSSL: config.MINIO_USE_SSL,
  accessKey: config.MINIO_ACCESS_KEY,
  secretKey: config.MINIO_SECRET_KEY,
  pathStyle: true, // 🔥 REQUIRED FOR TRAEFIK + HTTPS
});

// Ensure bucket exists on startup
export async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(config.MINIO_BUCKET);
    if (!exists) {
      await minioClient.makeBucket(config.MINIO_BUCKET); // ✅ no region
      logger.info(`✅ Created MinIO bucket: ${config.MINIO_BUCKET}`);
    } else {
      logger.info(`✅ MinIO bucket exists: ${config.MINIO_BUCKET}`);
    }
  } catch (error) {
    logger.error({ error }, '❌ MinIO bucket initialization failed');
    throw error;
  }
}
