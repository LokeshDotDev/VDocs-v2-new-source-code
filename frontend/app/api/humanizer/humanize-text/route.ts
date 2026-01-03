import { NextRequest, NextResponse } from "next/server";

const HUMANIZER_API = process.env.HUMANIZER_API || "http://localhost:8000";

export async function POST(request: NextRequest) {
	try {
		const { text } = await request.json();

		if (!text || typeof text !== "string" || text.trim().length === 0) {
			return NextResponse.json(
				{ error: "Invalid or empty text provided" },
				{ status: 400 }
			);
		}

		console.log(`[Humanizer] Calling ${HUMANIZER_API}/humanize`);
		console.log(`[Humanizer] Text length: ${text.length} chars`);

		// Call the Python humanizer module
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

		try {
			const response = await fetch(`${HUMANIZER_API}/humanize`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ 
					text: text.trim(),
					p_syn: 0.35,      // Lower synonym replacement (35% instead of 95%)
					p_trans: 0.30,    // Lower transition insertion (30% instead of 70%)
					preserve_linebreaks: true
				}),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					`[Humanizer] Service error: ${response.status} ${response.statusText}`,
					errorText
				);
				throw new Error(
					`Humanizer service error: ${response.status} ${response.statusText}`
				);
			}

			const result = await response.json();
			console.log("[Humanizer] Success");

			return NextResponse.json({
				success: true,
				humanizedText: result.humanized_text || result.text,
			});
		} catch (fetchError) {
			clearTimeout(timeoutId);
			if (fetchError instanceof Error && fetchError.name === "AbortError") {
				console.error("[Humanizer] Request timeout");
				throw new Error("Humanizer service timeout (30s)");
			}
			throw fetchError;
		}
	} catch (error) {
		const errorMsg =
			error instanceof Error ? error.message : "Humanization failed";
		console.error("[Humanizer] Error:", errorMsg, error);
		return NextResponse.json(
			{
				error: errorMsg,
				service: HUMANIZER_API,
			},
			{ status: 500 }
		);
	}
}
