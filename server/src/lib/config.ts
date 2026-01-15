// lib/config.ts

export const config = {
  // ======================
  // App
  // ======================
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  HOST: process.env.HOST ?? '0.0.0.0',
  PORT: Number(process.env.PORT ?? 4000),

  // ======================
  // Security
  // ======================
  JWT_SECRET: process.env.JWT_SECRET ?? '',
  AUTH_SECRET: process.env.AUTH_SECRET ?? '',
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS ?? 10),

  // ======================
  // Rate limiting
  // ======================
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),
  RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 100),
  RATE_LIMIT_STORE: process.env.RATE_LIMIT_STORE ?? 'memory',

  // ======================
  // Logging
  // ======================
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  LOG_DB_SAMPLE_RATE: Number(process.env.LOG_DB_SAMPLE_RATE ?? 0),
  LOG_DB_MAX_BODY_LENGTH: Number(process.env.LOG_DB_MAX_BODY_LENGTH ?? 2048),
  LOG_PRETTY: process.env.LOG_PRETTY === 'true',
  LOG_REQUESTS_TO_DB: process.env.LOG_REQUESTS_TO_DB === 'true',

  // ======================
  // Database / Redis
  // ======================
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  REDIS_URL: process.env.REDIS_URL ?? '',

  // ======================
  // 🔥 MinIO (CRITICAL FIX)
  // ======================
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT ?? 'localhost',
  MINIO_PORT: Number(process.env.MINIO_PORT ?? 9000),

  // 🔥 THIS FIXES YOUR SSL ERROR
  MINIO_USE_SSL: process.env.MINIO_USE_SSL === 'true',

  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY ?? '',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY ?? '',
  MINIO_BUCKET: process.env.MINIO_BUCKET ?? 'default',

  // ======================
  // Internal services
  // ======================
  PYTHON_MANAGER_URL: process.env.PYTHON_MANAGER_URL ?? '',
  CONVERTER_MODULE_URL: process.env.CONVERTER_MODULE_URL ?? '',
  REDUCTOR_V2_MODULE_URL: process.env.REDUCTOR_V2_MODULE_URL ?? '',
  REDUCTOR_V3_MODULE_URL: process.env.REDUCTOR_V3_MODULE_URL ?? '',
  AI_DETECTOR_MODULE_URL: process.env.AI_DETECTOR_MODULE_URL ?? '',
  HUMANIZER_MODULE_URL: process.env.HUMANIZER_MODULE_URL ?? '',

  // ======================
  // TUS
  // ======================
  TUS_PUBLIC_ENDPOINT: process.env.TUS_PUBLIC_ENDPOINT ?? '',
  TUS_INTERNAL_ENDPOINT: process.env.TUS_INTERNAL_ENDPOINT ?? '',

  // ======================
  // CORS
  // ======================
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
};
