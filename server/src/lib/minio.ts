// lib/minio.ts

import * as Minio from 'minio';
import { config } from './config.js';
import logger from './logger.js';

export const minioClient = new Minio.Client({
  endPoint: config.MINIO_ENDPOINT,
  port: config.MINIO_PORT,
  useSSL: config.MINIO_USE_SSL, // ✅ FIXED BOOLEAN
  accessKey: config.MINIO_ACCESS_KEY,
  secretKey: config.MINIO_SECRET_KEY,
  pathStyle: true, // ✅ required for Traefik / reverse proxy
});

// Ensure bucket exists on startup
export async function ensureBucket() {
  try {
    // 🔎 TEMP DEBUG (REMOVE LATER)
    logger.info({
      endpoint: config.MINIO_ENDPOINT,
      port: config.MINIO_PORT,
      useSSL: config.MINIO_USE_SSL,
      bucket: config.MINIO_BUCKET,
    }, '🪣 MinIO config');

    const exists = await minioClient.bucketExists(config.MINIO_BUCKET);

    if (!exists) {
      await minioClient.makeBucket(config.MINIO_BUCKET);
      logger.info(`✅ Created MinIO bucket: ${config.MINIO_BUCKET}`);
    } else {
      logger.info(`✅ MinIO bucket exists: ${config.MINIO_BUCKET}`);
    }
  } catch (error) {
    logger.error({ error }, '❌ MinIO bucket initialization failed');
    throw error;
  }
}
