export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const TMP_DIR = join(process.cwd(), "tmp", "editor-files");

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const key = searchParams.get("key");
		const ext = (searchParams.get("ext") || "docx").toLowerCase();

		if (!key) {
			return NextResponse.json(
				{ error: "Missing document key" },
				{ status: 400 }
			);
		}

		const filePath = join(TMP_DIR, `${key}.${ext}`);

		if (!existsSync(filePath)) {
			return NextResponse.json({ error: "File not found" }, { status: 404 });
		}

		const fileBuffer = await readFile(filePath);

		const contentTypes: Record<string, string> = {
			docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			doc: "application/msword",
			odt: "application/vnd.oasis.opendocument.text",
			rtf: "application/rtf",
			txt: "text/plain",
			pdf: "application/pdf",
			xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			xls: "application/vnd.ms-excel",
			ods: "application/vnd.oasis.opendocument.spreadsheet",
			csv: "text/csv",
			pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
			ppt: "application/vnd.ms-powerpoint",
			odp: "application/vnd.oasis.opendocument.presentation",
		};

		return new NextResponse(fileBuffer, {
			headers: {
				"Content-Type": contentTypes[ext] || "application/octet-stream",
				"Content-Disposition": `inline; filename="${key}.${ext}"`,
				"Access-Control-Allow-Origin": "*",
			},
		});
	} catch (error) {
		console.error("Serve error:", error);
		return NextResponse.json(
			{ error: "Failed to serve file" },
			{ status: 500 }
		);
	}
}
