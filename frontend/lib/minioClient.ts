import { Client } from "minio";

let _client: Client | null = null;

export function getMinioClient(): Client {
  if (_client) return _client;

  const endpoint = process.env.MINIO_ENDPOINT;
  if (!endpoint) {
    throw new Error("MINIO_ENDPOINT missing at runtime");
  }

  _client = new Client({
    endPoint: endpoint,
    port: Number(process.env.MINIO_PORT || 443),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY!,
    secretKey: process.env.MINIO_SECRET_KEY!,
    pathStyle: true,
  });

  return _client;
}
