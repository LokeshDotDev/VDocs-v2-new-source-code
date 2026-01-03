import { NextRequest, NextResponse } from "next/server";
import { getJobStatus } from "@/lib/one-click-store";

export async function GET(request: NextRequest) {
	const jobId = request.nextUrl.searchParams.get("jobId");

	if (!jobId) {
		console.error("❌ [Status] No jobId provided");
		return NextResponse.json({ error: "No jobId provided" }, { status: 400 });
	}

	console.log(`📊 [Status] Checking status for ${jobId}`);
	const status = getJobStatus(jobId);

	if (!status) {
		console.error(`❌ [Status] Job ${jobId} not found in store`);
		return NextResponse.json({ error: "Job not found" }, { status: 404 });
	}

	console.log(`✅ [Status] Returning status for ${jobId}:`, status);
	return NextResponse.json(status);
}
