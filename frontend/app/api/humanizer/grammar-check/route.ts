export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	const GRAMMAR_API = process.env.AI_DETECTOR_MODULE_URL;

	if (!GRAMMAR_API) {
		console.error("[Grammar] AI_DETECTOR_MODULE_URL is not set");
		return NextResponse.json(
			{ error: "Grammar service not configured" },
			{ status: 500 }
		);
	}

	try {
		const { text } = await request.json();

		if (!text || typeof text !== "string" || text.trim().length === 0) {
			return NextResponse.json(
				{ error: "Invalid or empty text provided" },
				{ status: 400 }
			);
		}

		console.log(`[Grammar] Calling ${GRAMMAR_API}/check`);
		console.log(`[Grammar] Text length: ${text.length} chars`);

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000);

		try {
			const response = await fetch(`${GRAMMAR_API}/check`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: text.trim() }),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					`[Grammar] Service error: ${response.status}`,
					errorText
				);
				throw new Error(`Grammar service error: ${response.status}`);
			}

			const result = await response.json();

			return NextResponse.json({
				success: true,
				correctedText: result.corrected_text ?? result.text,
			});
		} catch (err: unknown) {
			clearTimeout(timeoutId);

			if (err instanceof Error && err.name === "AbortError") {
				throw new Error("Grammar service timeout (30s)");
			}

			throw err;
		}
	} catch (error) {
		console.error("[Grammar] Error:", error);

		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Grammar check failed",
			},
			{ status: 500 }
		);
	}
}
