import { NextRequest, NextResponse } from "next/server";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const TMP_DIR = join(process.cwd(), "tmp", "editor-files");

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const key = searchParams.get("key");

		if (!key) {
			return NextResponse.json(
				{ error: "Missing document key" },
				{ status: 400 }
			);
		}

		const filePath = join(TMP_DIR, `${key}.docx`);

		if (!existsSync(filePath)) {
			return NextResponse.json({ error: "File not found" }, { status: 404 });
		}

		const fileBuffer = await readFile(filePath);

		// Optional: Clean up the file after download
		// Uncomment if you want to delete after download
		// await unlink(filePath);

		return new NextResponse(fileBuffer, {
			headers: {
				"Content-Type":
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				"Content-Disposition": `attachment; filename="edited-document.docx"`,
			},
		});
	} catch (error) {
		console.error("Download error:", error);
		return NextResponse.json(
			{ error: "Failed to download file" },
			{ status: 500 }
		);
	}
}
