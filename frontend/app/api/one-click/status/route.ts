import { NextRequest, NextResponse } from "next/server";
import { getJobStatus } from "@/lib/one-click-store";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function GET(request: NextRequest) {
	const jobId = request.nextUrl.searchParams.get("jobId");

	if (!jobId) {
		console.error("❌ [Status] No jobId provided");
		return NextResponse.json({ error: "No jobId provided" }, { status: 400 });
	}

	console.log(`📊 [Status] Checking status for ${jobId}`);
	
	// Try to get status from backend first
	try {
		const backendRes = await fetch(`${BACKEND_URL}/api/one-click/status?jobId=${jobId}`, {
			headers: { "Content-Type": "application/json" },
		});

		if (backendRes.ok) {
			const status = await backendRes.json();
			console.log(`✅ [Status] Got status from backend for ${jobId}:`, status);
			return NextResponse.json(status);
		}
	} catch (err) {
		console.warn(`⚠️ [Status] Could not reach backend, falling back to local store`);
	}

	// Fallback to local in-memory store
	const status = getJobStatus(jobId);

	if (!status) {
		console.error(`❌ [Status] Job ${jobId} not found`);
		return NextResponse.json({ error: "Job not found" }, { status: 404 });
	}

	console.log(`✅ [Status] Returning status for ${jobId}:`, status);
	return NextResponse.json(status);
}
