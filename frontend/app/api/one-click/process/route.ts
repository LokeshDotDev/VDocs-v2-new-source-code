export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

/**
 * IMPORTANT:
 * - This route runs in Next.js (frontend)
 * - It ONLY forwards the request to backend
 * - Actual processing happens in backend + reductor
 */

// Use INTERNAL backend URL in Docker, fallback for local dev
const BACKEND_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body ?? {};

    if (!jobId || typeof jobId !== "string") {
      console.error("[one-click/process] ❌ Missing or invalid jobId");
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 }
      );
    }

    console.log(
      `[one-click/process] 🔁 Forwarding job ${jobId} → ${BACKEND_URL}`
    );

    const backendRes = await fetch(
      `${BACKEND_URL}/api/one-click/process`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Request": "true",
        },
        body: JSON.stringify({ jobId }),
      }
    );

    const text = await backendRes.text();

    if (!backendRes.ok) {
      console.error(
        `[one-click/process] ❌ Backend error`,
        backendRes.status,
        text
      );

      return NextResponse.json(
        {
          error: "Backend processing failed",
          backendStatus: backendRes.status,
          backendResponse: text,
        },
        { status: 502 }
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    console.log(
      `[one-click/process] ✅ Processing started for job ${jobId}`
    );

    return NextResponse.json({
      status: "processing_started",
      jobId,
      backend: data,
    });
  } catch (error) {
    console.error("[one-click/process] ❌ Unexpected error:", error);

    return NextResponse.json(
      { error: "Internal processing error" },
      { status: 500 }
    );
  }
}
