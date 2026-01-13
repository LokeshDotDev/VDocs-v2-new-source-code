import { NextRequest, NextResponse } from "next/server";
import minioClient from "@/lib/minioClient";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 });
    }

    const bucket = process.env.MINIO_BUCKET || "wedocs";
    const prefix = `jobs/${jobId}/`;

    // List all objects in the job folder
    const objectsList = [];
    const stream = minioClient.listObjectsV2(bucket, prefix, true);
    
    for await (const obj of stream) {
      if (obj.name) {
        objectsList.push(obj.name);
      }
    }

    if (objectsList.length > 0) {
      // Delete objects
      await minioClient.removeObjects(bucket, objectsList);
      console.log(`Deleted ${objectsList.length} objects for job ${jobId}`);
    }

    return NextResponse.json({ message: "Job cleaned up successfully" });

  } catch (error: unknown) {
    console.error("Cleanup failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Cleanup failed", details: message }, { status: 500 });
  }
}
