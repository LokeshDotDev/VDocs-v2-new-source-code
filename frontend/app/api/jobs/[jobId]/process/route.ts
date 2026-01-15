export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { minioClient } from "@/lib/minioClient";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { jobId } = resolvedParams;
    
    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    console.log(`Starting processing for job ${jobId}`);

    const absoluteScriptPath = path.resolve(process.cwd(), "..", "scripts", "process_job.py");
    
    // Check if it exists? 
    // Actually, exec runs in a shell.
    
    const command = "python3";
    const args = [absoluteScriptPath, "--job-id", jobId];
    console.log(`Spawning: ${command} ${args.join(" ")}`);
    const child = spawn(command, args, {
      env: { ...process.env, PYTHONPATH: path.resolve(process.cwd(), "..") },
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      const str = data.toString();
      stdout += str;
      if (process.env.NODE_ENV !== "production") process.stdout.write(str);
    });
    child.stderr.on("data", (data) => {
      const str = data.toString();
      stderr += str;
      if (process.env.NODE_ENV !== "production") process.stderr.write(str);
    });

    const exitCode: number = await new Promise((resolve, reject) => {
      child.on("close", resolve);
      child.on("error", reject);
    });

    if (exitCode !== 0) {
      console.error("Python script failed with exit code", exitCode);
      throw new Error(`Python script failed with exit code ${exitCode}\n${stderr}`);
    }
    console.log("Script output:", stdout);
    if (stderr) console.error("Script stderr:", stderr);

    // After success, generate download URL
    const bucket = process.env.MINIO_BUCKET || "wedocs";
    const resultKey = `jobs/${jobId}/result.zip`;
    
    try {
        const downloadUrl = await minioClient.presignedGetObject(bucket, resultKey, 24 * 60 * 60); // 24 hours
        return NextResponse.json({ 
            status: "success", 
            downloadUrl,
            message: "Job processed successfully" 
        });
    } catch (err) {
        console.error("Failed to generate presigned URL:", err);
        return NextResponse.json({ error: "Processing finished but failed to generate download URL" }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error("Job processing failed:", error);
    return NextResponse.json({ 
        error: "Job processing failed", 
        details: error instanceof Error ? error.message : "Unknown error",
        stderr: error && typeof error === "object" && "stderr" in error ? (error as { stderr?: string }).stderr : undefined 
    }, { status: 500 });
  }
}
