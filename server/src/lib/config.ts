import dotenv from 'dotenv';
import { z } from 'zod';
import os from 'os';

// Load .env - try multiple locations for Windows compatibility
dotenv.config();
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '../.env' });

const configSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']),
  
  // Server Configuration
  PORT: z.coerce.number(),
  HOST: z.string(),
  
  // Database
  DATABASE_URL: z.string(),
  
  // Security
  JWT_SECRET: z.string(),
  BCRYPT_ROUNDS: z.coerce.number(),
  BASIC_AUTH_USERNAME: z.string(),
  BASIC_AUTH_PASSWORD: z.string(),
  
  // CORS
  CORS_ORIGIN: z.string(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number(),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number(),
  RATE_LIMIT_STORE: z.enum(['memory', 'redis']),
  REDIS_URL: z.string().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
  LOG_PRETTY: z.coerce.boolean(),
  LOG_REQUESTS_TO_DB: z.coerce.boolean(),
  LOG_DB_SAMPLE_RATE: z.coerce.number().min(0).max(1),
  LOG_DB_MAX_BODY_LENGTH: z.coerce.number(),
  
  // Scalability & Infrastructure
  ENABLE_CLUSTER: z.coerce.boolean(),
  WORKER_COUNT: z.coerce.number(),
  TRUST_PROXY: z.coerce.boolean(),
  REQUEST_BODY_LIMIT: z.string(),
  
  // Prisma Logging
  PRISMA_LOG_QUERIES: z.coerce.boolean(),
  
  // Caching
  ENABLE_CACHE: z.coerce.boolean(),
  CACHE_TTL_SECONDS: z.coerce.number(),
  CACHE_MAX_ITEMS: z.coerce.number(),
  
  // MinIO Configuration
  MINIO_ENDPOINT: z.string(),
  MINIO_PORT: z.coerce.number(),
  MINIO_USE_SSL: z.coerce.boolean(),
  MINIO_ACCESS_KEY: z.string(),
  MINIO_SECRET_KEY: z.string(),
  MINIO_BUCKET: z.string(),
  MINIO_PUBLIC_ENDPOINT: z.string().optional(),
  MINIO_PUBLIC_PORT: z.coerce.number().optional(),
  MINIO_PUBLIC_USE_SSL: z.coerce.boolean().optional(),
  
  // Microservices URLs
  PYTHON_MANAGER_URL: z.string(),
  CONVERTER_MODULE_URL: z.string(),
  REDUCTOR_V2_MODULE_URL: z.string(),
  REDUCTOR_V3_MODULE_URL: z.string(),
  AI_DETECTOR_MODULE_URL: z.string(),
  HUMANIZER_MODULE_URL: z.string(),
});

const configResult = configSchema.safeParse(process.env);

if (!configResult.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(configResult.error.format());
  process.exit(1);
}

export const config = configResult.data;
export default config;
