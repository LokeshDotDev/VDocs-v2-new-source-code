import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { spawn } from "child_process";
import { setJobStatus } from "@/lib/one-click-store";

export async function POST(request: NextRequest) {
	try {
		const { jobId } = await request.json();

		if (!jobId) {
			console.error("❌ No jobId provided");
			return NextResponse.json({ error: "No jobId provided" }, { status: 400 });
		}

		console.log(`🔧 [Process] Starting processing for job ${jobId}`);

		// Set initial processing status
		setJobStatus(jobId, {
			stage: "convert",
			progress: 5,
			message: "Starting pipeline...",
		});

		console.log(`✅ [Process] Initial status set for ${jobId}`);

		const scriptPath = path.resolve(process.cwd(), "..", "scripts", "process_job.py");
		const env = { ...process.env, PYTHONPATH: path.resolve(process.cwd(), "..") };

		const child = spawn("python3", [scriptPath, "--job-id", jobId], {
			env,
			cwd: process.cwd(),
			detached: false,
		});

		const stageMatchers: Array<{ keyword: string; status: { stage: string; progress: number; message: string } }> = [
			{ keyword: "Converting", status: { stage: "convert", progress: 25, message: "Converting PDF to DOCX..." } },
			{ keyword: "Redacting", status: { stage: "anonymize", progress: 45, message: "Removing personal information..." } },
			{ keyword: "Humanizing", status: { stage: "humanize", progress: 65, message: "Humanizing text..." } },
			{ keyword: "Fixing spelling and grammar", status: { stage: "spell-grammar", progress: 80, message: "Checking spelling and grammar..." } },
			{ keyword: "Applying standard formatting", status: { stage: "format", progress: 90, message: "Applying professional formatting..." } },
			{ keyword: "Zipping results", status: { stage: "format", progress: 95, message: "Packaging results..." } },
			{ keyword: "Uploading zip", status: { stage: "complete", progress: 100, message: "Processing complete" } },
		];

		const handleLog = (buffer: Buffer) => {
			const text = buffer.toString();
			for (const { keyword, status } of stageMatchers) {
				if (text.includes(keyword)) {
					setJobStatus(jobId, status);
					break;
				}
			}
		};

		child.stdout.on("data", handleLog);
		child.stderr.on("data", handleLog);

		child.on("close", (code) => {
			if (code === 0) {
				setJobStatus(jobId, {
					stage: "complete",
					progress: 100,
					message: "Processing complete",
				});
			} else {
				setJobStatus(jobId, {
					stage: "format",
					progress: 90,
					message: "Processing failed",
					error: `Pipeline exited with code ${code}`,
				});
			}
		});

		child.on("error", (error) => {
			setJobStatus(jobId, {
				stage: "convert",
				progress: 0,
				message: "Failed to start pipeline",
				error: error instanceof Error ? error.message : String(error),
			});
		});

		// Respond immediately; status endpoint will reflect async progress
		return NextResponse.json({ success: true, jobId });
	} catch (error) {
		console.error("Process error:", error);
		return NextResponse.json(
			{ error: "Processing failed" },
			{ status: 500 }
		);
	}
}
