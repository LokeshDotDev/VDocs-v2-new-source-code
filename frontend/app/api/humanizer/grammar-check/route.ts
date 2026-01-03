import { NextRequest, NextResponse } from "next/server";

const GRAMMAR_API = process.env.GRAMMAR_API || "http://localhost:8001";

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

		// Call the Python spell & grammar checker
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

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
					`[Grammar] Service error: ${response.status} ${response.statusText}`,
					errorText
				);
				throw new Error(
					`Grammar check service error: ${response.status} ${response.statusText}`
				);
			}

			const result = await response.json();
			console.log("[Grammar] Success");

			return NextResponse.json({
				success: true,
				correctedText: result.corrected_text || result.text,
			});
		} catch (fetchError) {
			clearTimeout(timeoutId);
			if (fetchError instanceof Error && fetchError.name === "AbortError") {
				console.error("[Grammar] Request timeout");
				throw new Error("Grammar check service timeout (30s)");
			}
			throw fetchError;
		}
	} catch (error) {
		const errorMsg =
			error instanceof Error ? error.message : "Grammar check failed";
		console.error("[Grammar] Error:", errorMsg, error);
		return NextResponse.json(
			{
				error: errorMsg,
				service: GRAMMAR_API,
			},
			{ status: 500 }
		);
	}
}
