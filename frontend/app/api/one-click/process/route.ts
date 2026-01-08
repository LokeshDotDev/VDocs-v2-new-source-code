import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(request: NextRequest) {
	try {
		const { jobId } = await request.json();

		if (!jobId) {
			console.error("❌ No jobId provided");
			return NextResponse.json({ error: "No jobId provided" }, { status: 400 });
		}

		console.log(`🔧 [Process] Forwarding to backend for job ${jobId}`);

		// Forward the request to the backend's process endpoint
		const backendRes = await fetch(`${BACKEND_URL}/api/one-click/process`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ jobId }),
		});

		if (!backendRes.ok) {
			const error = await backendRes.json();
			console.error("❌ Backend processing error:", error);
			return NextResponse.json(error, { status: backendRes.status });
		}

		const result = await backendRes.json();
		console.log(`✅ [Process] Backend processing started for ${jobId}`);

		return NextResponse.json(result);
	} catch (error) {
		console.error("Process error:", error);
		return NextResponse.json(
			{ error: "Processing failed" },
			{ status: 500 }
		);
	}
}
