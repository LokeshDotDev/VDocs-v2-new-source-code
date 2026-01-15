export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getMinioClient } from "@/lib/minioClient";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID required" },
        { status: 400 }
      );
    }

    // ✅ CREATE CLIENT HERE (THIS WAS MISSING)
    const minioClient = getMinioClient();

    const bucket = process.env.MINIO_BUCKET || "wedocs";
    const prefix = `jobs/${jobId}/`;

    const objectsList: string[] = [];
    const stream = minioClient.listObjectsV2(bucket, prefix, true);

    for await (const obj of stream) {
      if (obj.name) {
        objectsList.push(obj.name);
      }
    }

    if (objectsList.length > 0) {
      await minioClient.removeObjects(bucket, objectsList);
      console.log(`Deleted ${objectsList.length} objects for job ${jobId}`);
    }

    return NextResponse.json({
      message: "Job cleaned up successfully",
    });

  } catch (error: unknown) {
    console.error("Cleanup failed:", error);
    return NextResponse.json(
      {
        error: "Cleanup failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
