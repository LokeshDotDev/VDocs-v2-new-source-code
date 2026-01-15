export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

import { TUS_SERVER_CONFIG } from "@/lib/upload/config/tus-upload-config";
import { UploadInfo, UploadMetadata } from "@/lib/upload/types/upload-types";
import { sanitizeFilename } from "@/lib/upload/utils/tus-file-utils";
import {
  getFinalFilename,
  usesOriginalFilename
} from "@/lib/upload/utils/tus-filename-utils";
import {
  ensureDir,
  parseMetadata,
  moveFile,
  checkDuplicateFile,
  getFullFilePath
} from "@/lib/upload/services/tus-file-operations";
import { TusMultipartManager } from "@/lib/upload/services/tus-multipart-manager";
import { getMinioClient } from "@/lib/minioClient";

/* -------------------- Init -------------------- */

ensureDir(TUS_SERVER_CONFIG.stagingDir);
ensureDir(TUS_SERVER_CONFIG.mountPath);

const tusMultipartManager = new TusMultipartManager();

/* -------------------- POST -------------------- */
export async function POST(req: NextRequest) {
  try {
    const uploadLength = req.headers.get("upload-length");
    const uploadMetadata = req.headers.get("upload-metadata");

    if (!uploadLength) {
      return NextResponse.json(
        { error: "Missing Upload-Length header" },
        { status: 400 }
      );
    }

    const metadata = parseMetadata(uploadMetadata) as Partial<UploadMetadata>;

    if (
      metadata.withFilename === "original" &&
      metadata.filename &&
      metadata.onDuplicate === "prevent"
    ) {
      if (
        checkDuplicateFile(
          sanitizeFilename(metadata.filename),
          metadata.destinationPath
        )
      ) {
        return NextResponse.json(
          { error: { message: `File "${metadata.filename}" already exists` } },
          { status: 409 }
        );
      }
    }

    const uploadId = uuidv4();
    fs.writeFileSync(path.join(TUS_SERVER_CONFIG.stagingDir, uploadId), "");

    const uploadInfo: UploadInfo = {
      id: uploadId,
      size: Number(uploadLength),
      offset: 0,
      metadata,
      creation_date: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(TUS_SERVER_CONFIG.stagingDir, `${uploadId}.json`),
      JSON.stringify(uploadInfo, null, 2)
    );

    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "localhost:3000";

    return new NextResponse(null, {
      status: 201,
      headers: {
        Location: `${protocol}://${host}/api/upload/${uploadId}`,
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "0"
      }
    });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* -------------------- PATCH -------------------- */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  try {
    const uploadId = (await params).params?.[0];
    if (!uploadId) {
      return NextResponse.json({ error: "Missing upload ID" }, { status: 400 });
    }

    const uploadOffset = Number(req.headers.get("upload-offset"));
    if (Number.isNaN(uploadOffset)) {
      return NextResponse.json({ error: "Invalid Upload-Offset" }, { status: 400 });
    }

    const metadataPath = path.join(
      TUS_SERVER_CONFIG.stagingDir,
      `${uploadId}.json`
    );
    if (!fs.existsSync(metadataPath)) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const uploadInfo: UploadInfo = JSON.parse(
      fs.readFileSync(metadataPath, "utf8")
    );

    if (uploadOffset !== uploadInfo.offset) {
      return NextResponse.json({ error: "Offset mismatch" }, { status: 409 });
    }

    const buffer = Buffer.from(await req.arrayBuffer());
    fs.appendFileSync(
      path.join(TUS_SERVER_CONFIG.stagingDir, uploadId),
      buffer
    );

    uploadInfo.offset += buffer.length;
    fs.writeFileSync(metadataPath, JSON.stringify(uploadInfo, null, 2));

    if (uploadInfo.offset >= uploadInfo.size) {
      const done = await handleUploadComplete(uploadId, uploadInfo);
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Tus-Resumable": "1.0.0",
          "Upload-Offset": uploadInfo.offset.toString(),
          ...(done && { "Upload-Complete": "true" })
        }
      });
    }

    return new NextResponse(null, {
      status: 204,
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": uploadInfo.offset.toString()
      }
    });
  } catch (err) {
    console.error("PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* -------------------- HELPERS -------------------- */
async function handleUploadComplete(
  uploadId: string,
  uploadInfo: UploadInfo
): Promise<boolean> {

  // ✅ THIS WAS THE BUG — NOW FIXED
  const minioClient = getMinioClient();

  const meta = (uploadInfo.metadata || {}) as Partial<UploadMetadata>;
  const isMultipart = !!(
    meta.multipartId &&
    meta.partIndex &&
    meta.totalParts
  );

  if (isMultipart && meta.totalParts !== "1") {
    return tusMultipartManager.handlePartCompletion(uploadId, meta);
  }

  const finalFilename = getFinalFilename(meta, uploadId);
  const stagingPath = path.join(TUS_SERVER_CONFIG.stagingDir, uploadId);
  const destinationPath = getFullFilePath(finalFilename, meta.destinationPath);

  moveFile(
    stagingPath,
    destinationPath,
    path.join(TUS_SERVER_CONFIG.stagingDir, `${uploadId}.json`),
    !usesOriginalFilename(meta)
  );

  try {
    const bucket = process.env.MINIO_BUCKET || "wedocs";
    const objectKey = path.posix.join(
      (meta.destinationPath || "").replace(/^\/+/, ""),
      finalFilename
    );

    await minioClient.fPutObject(bucket, objectKey, destinationPath, {
      "Content-Type": meta.filetype || "application/octet-stream",
      "X-Amz-Meta-Original-Name": meta.filename || finalFilename
    });
  } catch (err) {
    console.error("MinIO upload failed:", err);
  }

  return true;
}
