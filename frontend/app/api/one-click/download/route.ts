export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getMinioClient } from "@/lib/minioClient";

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json(
      { error: "No jobId provided" },
      { status: 400 }
    );
  }

  // ✅ CREATE CLIENT
  const minioClient = getMinioClient();

  const bucket = process.env.MINIO_BUCKET || "wedocs";
  const objectKey = `jobs/${jobId}/exports/${jobId}-export.zip`;

  try {
    // Ensure object exists
    await minioClient.statObject(bucket, objectKey);

    const url = await minioClient.presignedGetObject(
      bucket,
      objectKey,
      60 * 60 // 1 hour
    );

    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      {
        error:
          "Result not ready - zip file not found. Processing may still be in progress.",
      },
      { status: 404 }
    );
  }
}
