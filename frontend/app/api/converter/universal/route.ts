import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const TEMP_DIR = path.join(process.cwd(), "tmp", "universal-converter");

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
	fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const file = formData.get("file") as File;
		const format = formData.get("format") as string;

		if (!file || !format) {
			return NextResponse.json(
				{ error: "Missing file or format" },
				{ status: 400 }
			);
		}

		// Create unique session directory
		const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
		const sessionDir = path.join(TEMP_DIR, sessionId);
		const inputDir = path.join(sessionDir, "input");
		const outputDir = path.join(sessionDir, "output");

		fs.mkdirSync(inputDir, { recursive: true });
		fs.mkdirSync(outputDir, { recursive: true });

		const targetFormat = format.toLowerCase();
		const inputPath = path.join(inputDir, file.name);

		// Write file to disk
		const buffer = Buffer.from(await file.arrayBuffer());
		fs.writeFileSync(inputPath, buffer);

		// Perform conversion
		const result = await convertFile(inputPath, targetFormat, outputDir);

		// Read converted file
		const convertedBuffer = fs.readFileSync(result.outputPath);

		// Get appropriate MIME type
		const mimeType = getMimeType(targetFormat);

		// Cleanup
		setTimeout(() => {
			try {
				fs.rmSync(sessionDir, { recursive: true, force: true });
			} catch (err) {
				console.error("Cleanup error:", err);
			}
		}, 30000); // Clean up after 30 seconds

		// Return converted file directly
		return new NextResponse(convertedBuffer, {
			headers: {
				"Content-Type": mimeType,
				"Content-Disposition": `attachment; filename="${result.outputName}"`,
			},
		});
	} catch (error) {
		console.error("Universal converter error:", error);
		return NextResponse.json(
			{
				error: "Conversion failed",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

function getMimeType(format: string): string {
	const mimeTypes: Record<string, string> = {
		// Documents
		pdf: "application/pdf",
		docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		doc: "application/msword",
		odt: "application/vnd.oasis.opendocument.text",
		rtf: "application/rtf",
		txt: "text/plain",
		html: "text/html",
		
		// Images
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		gif: "image/gif",
		bmp: "image/bmp",
		tiff: "image/tiff",
		webp: "image/webp",
		svg: "image/svg+xml",
		
		// Videos
		mp4: "video/mp4",
		mov: "video/quicktime",
		avi: "video/x-msvideo",
		mkv: "video/x-matroska",
		webm: "video/webm",
		flv: "video/x-flv",
		
		// Audio
		mp3: "audio/mpeg",
		wav: "audio/wav",
		flac: "audio/flac",
		m4a: "audio/mp4",
		aac: "audio/aac",
		ogg: "audio/ogg",
	};

	return mimeTypes[format.toLowerCase()] || "application/octet-stream";
}

async function convertFile(
	inputPath: string,
	targetFormat: string,
	outputDir: string
): Promise<{ outputPath: string; outputName: string }> {
	const inputExt = path.extname(inputPath).slice(1).toLowerCase();
	const baseName = path.basename(inputPath, path.extname(inputPath));
	const outputName = `${baseName}.${targetFormat}`;
	const outputPath = path.join(outputDir, outputName);

	// Get file category
	const category = getFileCategory(inputExt);
	const targetCategory = getFileCategory(targetFormat);

	// Route to appropriate converter
	if (category === "document" || targetCategory === "document") {
		await convertDocument(inputPath, outputPath, inputExt, targetFormat);
	} else if (category === "image" || targetCategory === "image") {
		await convertImage(inputPath, outputPath, targetFormat);
	} else if (category === "video" || targetCategory === "video") {
		await convertVideo(inputPath, outputPath, targetFormat);
	} else if (category === "audio" || targetCategory === "audio") {
		await convertAudio(inputPath, outputPath, targetFormat);
	} else {
		throw new Error(
			`Unsupported conversion: ${inputExt} to ${targetFormat}`
		);
	}

	return { outputPath, outputName };
}

function getFileCategory(ext: string): string {
	const categories: Record<string, string[]> = {
		document: ["pdf", "docx", "doc", "odt", "rtf", "txt", "html", "pages"],
		image: ["jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp", "svg", "heic", "ico"],
		video: ["mp4", "mov", "avi", "mkv", "webm", "flv", "m4v", "mpeg", "wmv", "ogg"],
		audio: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "wma", "aiff"],
		archive: ["zip", "rar", "7z", "tar", "gz"],
	};

	for (const [category, extensions] of Object.entries(categories)) {
		if (extensions.includes(ext.toLowerCase())) {
			return category;
		}
	}
	return "unknown";
}

async function convertDocument(
	inputPath: string,
	outputPath: string,
	inputExt: string,
	targetFormat: string
) {
	// For now, call Python service for document conversion
	const response = await fetch("http://localhost:8002/convert-document", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			inputPath,
			outputPath,
			inputFormat: inputExt,
			outputFormat: targetFormat,
		}),
	});

	if (!response.ok) {
		throw new Error(`Document conversion failed: ${response.statusText}`);
	}

	const result = await response.json();
	if (!result.success) {
		throw new Error(result.error || "Document conversion failed");
	}
}

async function convertImage(
	inputPath: string,
	outputPath: string,
	targetFormat: string
) {
	// Call Python service for image conversion (using Pillow)
	const response = await fetch("http://localhost:8002/convert-image", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			inputPath,
			outputPath,
			outputFormat: targetFormat,
		}),
	});

	if (!response.ok) {
		throw new Error(`Image conversion failed: ${response.statusText}`);
	}

	const result = await response.json();
	if (!result.success) {
		throw new Error(result.error || "Image conversion failed");
	}
}

async function convertVideo(
	inputPath: string,
	outputPath: string,
	targetFormat: string
) {
	// Call Python service for video conversion (using FFmpeg)
	const response = await fetch("http://localhost:8002/convert-video", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			inputPath,
			outputPath,
			outputFormat: targetFormat,
		}),
	});

	if (!response.ok) {
		throw new Error(`Video conversion failed: ${response.statusText}`);
	}

	const result = await response.json();
	if (!result.success) {
		throw new Error(result.error || "Video conversion failed");
	}
}

async function convertAudio(
	inputPath: string,
	outputPath: string,
	targetFormat: string
) {
	// Call Python service for audio conversion (using FFmpeg/pydub)
	const response = await fetch("http://localhost:8002/convert-audio", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			inputPath,
			outputPath,
			outputFormat: targetFormat,
		}),
	});

	if (!response.ok) {
		throw new Error(`Audio conversion failed: ${response.statusText}`);
	}

	const result = await response.json();
	if (!result.success) {
		throw new Error(result.error || "Audio conversion failed");
	}
}
