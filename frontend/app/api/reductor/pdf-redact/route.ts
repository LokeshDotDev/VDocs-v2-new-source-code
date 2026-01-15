export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { getMinioClient } from "@/lib/minioClient";

// Storage path for DOCX files
const DOCX_DIR =
  process.env.DOCX_STORAGE_PATH ||
  path.join(process.cwd(), "public", "uploads", "docx");

// Ensure directory exists
if (!fs.existsSync(DOCX_DIR)) {
  fs.mkdirSync(DOCX_DIR, { recursive: true });
}

// Dummy conversion (replace later)
async function convertPdfToDocx(
  _pdfPath: string,
  _docxPath: string
): Promise<boolean> {
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const { fileKey, removeName, removeRollNo } = await request.json();

    if (!fileKey) {
      return NextResponse.json(
        { error: "Missing fileKey" },
        { status: 400 }
      );
    }

    // ✅ CREATE MINIO CLIENT (THIS WAS MISSING)
    const minioClient = getMinioClient();

    const bucket = process.env.MINIO_BUCKET || "wedocs";

    // Download PDF to temp
    const tempPdfPath = path.join(os.tmpdir(), path.basename(fileKey));
    const pdfWriteStream = fs.createWriteStream(tempPdfPath);

    await new Promise<void>((resolve, reject) => {
      minioClient
        .getObject(bucket, fileKey)
        .then((dataStream) => {
          dataStream.pipe(pdfWriteStream);
          dataStream.on("end", resolve);
          dataStream.on("error", reject);
        })
        .catch(reject);
    });

    const docxFileName = path.basename(fileKey).replace(/\.pdf$/i, ".docx");
    const docxPath = path.join(DOCX_DIR, docxFileName);

    const redactedDocxFileName = docxFileName.replace(
      /\.docx$/i,
      "_redacted.docx"
    );
    const redactedDocxPath = path.join(DOCX_DIR, redactedDocxFileName);

    // 1️⃣ Convert PDF → DOCX
    const converted = await convertPdfToDocx(tempPdfPath, docxPath);
    if (!converted) {
      return NextResponse.json(
        { error: "PDF to DOCX conversion failed" },
        { status: 500 }
      );
    }

    // 2️⃣ Call backend redactor
    const backendResp = await fetch(
      "http://localhost:3000/api/reductor/redact",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileKey,
          fileName: docxFileName,
          removeName,
          removeRollNo,
        }),
      }
    );

    if (!backendResp.ok) {
      const errText = await backendResp.text();
      throw new Error(`Redactor failed: ${errText}`);
    }

    // 3️⃣ Upload redacted DOCX to MinIO
    const redactedKey = fileKey
      .replace("/raw/", "/redacted/")
      .replace(/\.pdf$/i, "_redacted.docx");

    await minioClient.fPutObject(
      bucket,
      redactedKey,
      redactedDocxPath,
      {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }
    );

    return NextResponse.json({
      status: "success",
      redactedFileKey: redactedKey,
      originalFileKey: fileKey,
    });
  } catch (error) {
    console.error("PDF → DOCX → Redact error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
