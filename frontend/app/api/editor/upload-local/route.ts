import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Store files temporarily in memory or disk
const TMP_DIR = join(process.cwd(), "tmp", "editor-files");

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const file = formData.get("file") as File;
		const documentKey = formData.get("documentKey") as string;

		if (!file || !documentKey) {
			return NextResponse.json(
				{ error: "Missing file or document key" },
				{ status: 400 }
			);
		}

		// Create tmp directory if it doesn't exist
		if (!existsSync(TMP_DIR)) {
			await mkdir(TMP_DIR, { recursive: true });
		}

		// Save file to disk
		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);
		const filePath = join(TMP_DIR, `${documentKey}.docx`);
		await writeFile(filePath, buffer);

		// Return URL that OnlyOffice can access
		// OnlyOffice runs in Docker, so use host.docker.internal instead of localhost
		const url = `http://host.docker.internal:3001/api/editor/serve-local?key=${documentKey}`;

		return NextResponse.json({ url, key: documentKey });
	} catch (error) {
		console.error("Upload error:", error);
		return NextResponse.json(
			{ error: "Failed to upload file" },
			{ status: 500 }
		);
	}
}
