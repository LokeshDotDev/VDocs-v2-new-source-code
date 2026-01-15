export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { getMinioClient } from "@/lib/minioClient";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    console.log(`🚀 Starting processing for job ${jobId}`);

    const scriptPath = path.resolve(
      process.cwd(),
      "..",
      "scripts",
      "process_job.py"
    );

    const child = spawn("python3", [scriptPath, "--job-id", jobId], {
      env: {
        ...process.env,
        PYTHONPATH: path.resolve(process.cwd(), ".."),
      },
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const exitCode: number = await new Promise((resolve, reject) => {
      child.on("close", resolve);
      child.on("error", reject);
    });

    if (exitCode !== 0) {
      throw new Error(
        `Python script failed (exit ${exitCode})\n${stderr}`
      );
    }

    console.log("✅ Python script finished");

    // ✅ MinIO ONLY created at runtime
    const minioClient = getMinioClient();
    const bucket = process.env.MINIO_BUCKET || "wedocs";
    const resultKey = `jobs/${jobId}/result.zip`;

    const downloadUrl = await minioClient.presignedGetObject(
      bucket,
      resultKey,
      24 * 60 * 60
    );

    return NextResponse.json({
      status: "success",
      downloadUrl,
      message: "Job processed successfully",
    });

  } catch (error) {
    console.error("❌ Job processing failed:", error);

    return NextResponse.json(
      {
        error: "Job processing failed",
        details:
          error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
