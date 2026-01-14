import { NextRequest, NextResponse } from "next/server";

const HUMANIZER_API = process.env.HUMANIZER_MODULE_URL;

if (!HUMANIZER_API) {
	throw new Error("HUMANIZER_MODULE_URL is not set");
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

		console.log(`[Humanizer] Calling ${HUMANIZER_API}/humanize`);
		console.log(`[Humanizer] Text length: ${text.length} chars`);

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000);

		try {
			const response = await fetch(`${HUMANIZER_API}/humanize`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text: text.trim(),
					p_syn: 0.35,
					p_trans: 0.30,
					preserve_linebreaks: true,
				}),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					`[Humanizer] Service error: ${response.status}`,
					errorText
				);
				throw new Error(`Humanizer service error: ${response.status}`);
			}

			const result = await response.json();

			return NextResponse.json({
				success: true,
				humanizedText: result.humanized_text || result.text,
			});
		} catch (err: any) {
			clearTimeout(timeoutId);
			if (err.name === "AbortError") {
				throw new Error("Humanizer service timeout (30s)");
			}
			throw err;
		}
	} catch (error) {
		console.error("[Humanizer] Error:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Humanization failed",
			},
			{ status: 500 }
		);
	}
}
