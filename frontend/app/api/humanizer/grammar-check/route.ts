import { NextRequest, NextResponse } from "next/server";

/**
 * Grammar / Spell Checker Service URL
 * Must be provided via environment variables in production
 */
const GRAMMAR_API = process.env.AI_DETECTOR_MODULE_URL;

if (!GRAMMAR_API) {
	throw new Error("AI_DETECTOR_MODULE_URL is not set");
}

export async function POST(request: NextRequest) {
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
		const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

		try {
			const response = await fetch(`${GRAMMAR_API}/check`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					text: text.trim(),
				}),
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

			console.log("[Grammar] Success");

			return NextResponse.json({
				success: true,
				correctedText: result.corrected_text ?? result.text,
			});
		} catch (err: unknown) {
			clearTimeout(timeoutId);

			if (err instanceof Error && err.name === "AbortError") {
				console.error("[Grammar] Request timeout");
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
				service: GRAMMAR_API,
			},
			{ status: 500 }
		);
	}
}
