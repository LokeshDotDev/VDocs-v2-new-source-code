import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";

const TMP_DIR = join(process.cwd(), "tmp", "editor-files");

export async function POST(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const key = searchParams.get("key");

		if (!key) {
			return NextResponse.json(
				{ error: "Missing document key" },
				{ status: 400 }
			);
		}

		const body = await request.json();
		console.log("OnlyOffice callback:", JSON.stringify(body, null, 2));

		// Status codes:
		// 0 - document not found
		// 1 - document being edited
		// 2 - document ready for saving
		// 3 - document saving error
		// 4 - document closed with no changes
		// 6 - document being edited, force save initiated
		// 7 - error force saving the document

		const status = body.status;

		if (status === 2 || status === 6) {
			// Document is ready to be saved
			const downloadUrl = body.url;

			if (downloadUrl) {
				// Download the edited document from OnlyOffice
				const response = await fetch(downloadUrl);
				const buffer = await response.arrayBuffer();

				// Save the edited file
				const filePath = join(TMP_DIR, `${key}.docx`);
				await writeFile(filePath, Buffer.from(buffer));

				console.log(`Saved edited document: ${filePath}`);
			}
		}

		// Always return success to OnlyOffice
		return NextResponse.json({ error: 0 });
	} catch (error) {
		console.error("Callback error:", error);
		return NextResponse.json({ error: 1 }, { status: 500 });
	}
}
