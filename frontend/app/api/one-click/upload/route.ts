import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { setJobStatus, getJobStatus } from "@/lib/one-click-store";

export async function POST(request: NextRequest) {
	try {
		const { fileCount, folderStructure } = await request.json();

		if (!fileCount || fileCount === 0) {
			console.error("❌ No files provided");
			return NextResponse.json({ error: "fileCount is required" }, { status: 400 });
		}

		const jobId = uuidv4();
		const uploadUrl = "http://localhost:4000/files";

		console.log("✅ Multi-file upload initialized:", { jobId, fileCount, folders: folderStructure?.length || 0 });

		// TUS metadata - all values must be strings
		const metadata = {
			jobId: jobId,
			stage: "raw",
			userId: "u_default",
		};

		// Prime in-memory status
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
