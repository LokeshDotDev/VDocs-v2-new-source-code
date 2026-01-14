import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import {
  createTusServer,
  getFailedUploads,
  retryFailedUpload
} from "./tus-server.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { checkMinIOHealth, ensureBucket } from "./minio-client.js";

const app = express();
const tusServer = createTusServer();

/**
 * CORS – must support TUS headers
 */
app.use(cors({
  origin: true,
  credentials: true,
  exposedHeaders: [
    "Tus-Resumable",
    "Upload-Offset",
    "Upload-Length",
    "Upload-Metadata",
    "Location"
  ]
}));

fs.mkdirSync(config.storageDir, { recursive: true });

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * TUS HANDLER
 */
app.all(`${config.tusPath}*`, async (req: Request, res: Response) => {
  try {
    await tusServer.handle(req, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("TUS handler error", { msg, path: req.path });
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    }
  }
});

app.get("/health/minio", async (_req, res) => {
  const ok = await checkMinIOHealth();
  res.status(ok ? 200 : 503).json({ status: ok ? "connected" : "disconnected" });
});

app.get("/debug/failed-uploads", (_req, res) => {
  res.json({ failedUploads: getFailedUploads() });
});

app.post("/debug/retry-upload/:uploadId", async (req, res) => {
  try {
    await retryFailedUpload(req.params.uploadId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * IMPORTANT FIX: bind to 0.0.0.0 for production
 */
const port = Number(config.port) || 4001;
app.listen(port, "0.0.0.0", async () => {
  logger.info("✅ TUS server started successfully", {
    port,
    path: config.tusPath,
    tusEndpoint: `http://0.0.0.0:${port}${config.tusPath}`,
    storageDir: config.storageDir,
    environment: process.env.NODE_ENV || 'production'
  });

  // Check MinIO connectivity
  try {
    const minioOk = await checkMinIOHealth();
    if (minioOk) {
      logger.info("✅ MinIO connection verified");
      await ensureBucket();
      logger.info(`✅ MinIO bucket '${config.minio.bucket}' is ready`);
    } else {
      logger.warn("⚠️ MinIO is unreachable - uploads will fail until MinIO is available");
    }
  } catch (error) {
    logger.error("❌ Failed to initialize MinIO", { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});
