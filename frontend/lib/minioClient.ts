import { Client } from "minio";

if (!process.env.MINIO_ENDPOINT) throw new Error("MINIO_ENDPOINT missing");

export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: Number(process.env.MINIO_PORT || 443),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
  pathStyle: true, 
});
