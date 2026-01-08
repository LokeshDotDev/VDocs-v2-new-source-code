import { NextRequest, NextResponse } from "next/server";
import { setJobStatus } from "@/lib/one-click-store";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(request: NextRequest) {
	try {
		const { fileCount, folderStructure } = await request.json();

		if (!fileCount || fileCount === 0) {
			console.error("❌ No files provided");
			return NextResponse.json({ error: "fileCount is required" }, { status: 400 });
		}

		// Call the backend to create the job
		const backendRes = await fetch(`${BACKEND_URL}/api/one-click/upload`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ fileCount, folderStructure }),
		});

		if (!backendRes.ok) {
			const error = await backendRes.json();
			console.error("❌ Backend error:", error);
			return NextResponse.json(error, { status: backendRes.status });
		}

		const { jobId, uploadUrl, metadata } = await backendRes.json();

		console.log("✅ Multi-file upload initialized:", { jobId, fileCount, folders: folderStructure?.length || 0 });

		// Prime in-memory status (for polling on frontend)
		setJobStatus(jobId, {
			stage: "upload",
			progress: 0,
			message: `Ready to upload ${fileCount} files`,
		});

		console.log("📤 Returning upload config:", { jobId, uploadUrl, metadata });

		return NextResponse.json({ jobId, uploadUrl, metadata });
	} catch (error) {
		console.error("❌ Upload init error:", error);
		return NextResponse.json(
			{ error: "Failed to initialize upload" },
			{ status: 500 }
		);
	}
}
