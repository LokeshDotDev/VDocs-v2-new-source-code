import { NextRequest, NextResponse } from "next/server";
import minioClient from "@/lib/minioClient";

export async function GET(request: NextRequest) {
	const jobId = request.nextUrl.searchParams.get("jobId");

	if (!jobId) {
		return NextResponse.json({ error: "No jobId provided" }, { status: 400 });
	}

	const bucket = process.env.MINIO_BUCKET || "wedocs";
	const objectKey = `jobs/${jobId}/result.zip`;

	try {
		// Ensure the object exists before issuing a signed URL
		await minioClient.statObject(bucket, objectKey);
		const url = await minioClient.presignedGetObject(bucket, objectKey, 60 * 60);
		return NextResponse.redirect(url);
	} catch (error) {
		console.error("Download error:", error);
		return NextResponse.json({ error: "Result not ready" }, { status: 404 });
	}
}
