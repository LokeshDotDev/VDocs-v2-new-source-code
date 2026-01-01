import { Router } from "express";
import { minioClient } from "../lib/minio.js";
import jobService from "../services/jobService.js";

const router = Router();
const MINIO_BUCKET = process.env["MINIO_BUCKET"] || "wedocs";

// GET /api/jobs/:jobId/files
router.get("/:jobId/files", async (req, res) => {
  const jobId = req.params.jobId;
  if (!jobId) return res.status(400).json({ error: "Missing jobId" });
  const jobPaths = jobService.getJobPaths(jobId);
  const rawPrefix = jobPaths.raw.endsWith("/") ? jobPaths.raw : jobPaths.raw + "/";
  const files = [];
  for await (const obj of minioClient.listObjectsV2(MINIO_BUCKET, rawPrefix, true)) {
    if (obj.name && obj.name.toLowerCase().endsWith(".pdf")) {
      files.push({
        key: obj.name,
        name: obj.name.split("/").pop(),
        size: obj.size,
        lastModified: obj.lastModified || new Date(),
        userId: jobId,
        uploadId: jobId,
        stage: "raw",
        relativePath: obj.name.replace(rawPrefix, ""),
      });
    }
  }
  res.json({ files });
});

export default router;
