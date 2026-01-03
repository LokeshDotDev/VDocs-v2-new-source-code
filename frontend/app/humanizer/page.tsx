"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Loader, CheckCircle2, AlertCircle } from "lucide-react";

interface ProcessingState {
	stage: "idle" | "humanizing" | "grammar-check" | "complete" | "error";
	progress: number;
	message: string;
}

export default function HumanizerPage() {
	const [inputText, setInputText] = useState("");
	const [outputText, setOutputText] = useState("");
	const [processingState, setProcessingState] = useState<ProcessingState>({
		stage: "idle",
		progress: 0,
		message: "",
	});
	const [processingTime, setProcessingTime] = useState(0);
	const [copySuccess, setCopySuccess] = useState(false);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const outputRef = useRef<HTMLTextAreaElement>(null);

	const handleHumanize = async () => {
		if (!inputText.trim()) {
			alert("Please enter text to humanize");
			return;
		}

		const startTime = Date.now();
		setOutputText("");
		setCopySuccess(false);

		try {
			// Stage 1: Humanize
			setProcessingState({
				stage: "humanizing",
				progress: 33,
				message: "Humanizing text...",
			});

			const humanizeResponse = await fetch("/api/humanizer/humanize-text", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: inputText }),
			});

			if (!humanizeResponse.ok) {
				const errorData = await humanizeResponse.json().catch(() => ({}));
				const errorMsg = errorData.error || "Humanization failed";
				throw new Error(errorMsg);
			}

			const humanizeData = await humanizeResponse.json();
			let processedText = humanizeData.humanizedText;

			// Stage 2: Grammar & Spell Check
			setProcessingState({
				stage: "grammar-check",
				progress: 66,
				message: "Checking grammar and spelling...",
			});

			const grammarResponse = await fetch(
				"/api/humanizer/grammar-check",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ text: processedText }),
				}
			);

			if (!grammarResponse.ok) {
				const errorData = await grammarResponse.json().catch(() => ({}));
				const errorMsg = errorData.error || "Grammar check failed";
				throw new Error(errorMsg);
			}

			const grammarData = await grammarResponse.json();
			processedText = grammarData.correctedText;

			setOutputText(processedText);
			const endTime = Date.now();
			setProcessingTime((endTime - startTime) / 1000);

			setProcessingState({
				stage: "complete",
				progress: 100,
				message: "Complete!",
			});
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : "An error occurred";
			console.error("Processing error:", error);
			setProcessingState({
				stage: "error",
				progress: 0,
				message: errorMsg,
			});
			alert(`Error: ${errorMsg}`);
		}
	};

	const handleCopy = () => {
		if (outputRef.current) {
			outputRef.current.select();
			document.execCommand("copy");
			setCopySuccess(true);
			setTimeout(() => setCopySuccess(false), 2000);
		}
	};

	const handleClearInput = () => {
		setInputText("");
		setOutputText("");
		setProcessingState({ stage: "idle", progress: 0, message: "" });
		setProcessingTime(0);
		inputRef.current?.focus();
	};

	const getStageColor = (stage: string) => {
		switch (stage) {
			case "humanizing":
				return "text-blue-500";
			case "grammar-check":
				return "text-purple-500";
			case "complete":
				return "text-green-500";
			case "error":
				return "text-red-500";
			default:
				return "text-slate-400";
		}
	};

	const getStageIcon = (stage: string) => {
		switch (stage) {
			case "humanizing":
			case "grammar-check":
				return <Loader className='w-5 h-5 animate-spin' />;
			case "complete":
				return <CheckCircle2 className='w-5 h-5' />;
			case "error":
				return <AlertCircle className='w-5 h-5' />;
			default:
				return null;
		}
	};


	return (
		<div className='min-h-screen bg-gradient-to-br from-[#050910] via-[#0a1020] to-[#0b1224] text-slate-100 p-6'>
			<div className='max-w-7xl mx-auto space-y-6'>
				{/* Header */}
				<div className='space-y-2'>
					<h1 className='text-5xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent'>
						AI Text Humanizer
					</h1>
					<p className='text-slate-400 text-lg'>
						Transform AI-generated content into natural, human-like text with intelligent processing
					</p>
				</div>

				{/* Main Content */}
				<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
					{/* Input Section */}
					<Card className='bg-[#0b0f1a]/50 border border-white/10 backdrop-blur-sm shadow-xl'>
						<CardContent className='p-6 space-y-4'>
							<div className='space-y-2'>
								<h2 className='text-lg font-semibold text-slate-100'>
									Original Text
								</h2>
								<p className='text-sm text-slate-400'>
									Paste your AI-generated content here
								</p>
							</div>

							<textarea
								ref={inputRef}
								value={inputText}
								onChange={(e) => setInputText(e.target.value)}
								placeholder='Paste your text here... (minimum 50 characters recommended)'
								className='w-full h-96 p-4 rounded-lg bg-[#05070d] border border-white/10 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none'
								disabled={processingState.stage !== "idle"}
							/>

							<div className='flex items-center justify-between text-sm text-slate-400'>
								<span>
									{inputText.length} characters
								</span>
								<span>
									~{Math.ceil(inputText.split(/\s+/).length / 200)} min read
								</span>
							</div>

							<div className='flex gap-2'>
								<Button
									onClick={handleHumanize}
									disabled={
										processingState.stage !== "idle" || !inputText.trim()
									}
									className='flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-900/30'
								>
									{processingState.stage === "idle" ? (
										"Humanize Now"
									) : (
										<>
											<Loader className='w-4 h-4 mr-2 animate-spin' />
											Processing...
										</>
									)}
								</Button>
								<Button
									onClick={handleClearInput}
									variant='outline'
									className='border-white/15 hover:bg-white/5 text-slate-300'
								>
									Clear
								</Button>
							</div>
						</CardContent>
					</Card>

					{/* Output Section */}
					<Card className='bg-[#0b0f1a]/50 border border-white/10 backdrop-blur-sm shadow-xl'>
						<CardContent className='p-6 space-y-4'>
							<div className='space-y-2'>
								<h2 className='text-lg font-semibold text-slate-100'>
									Humanized Text
								</h2>
								<p className='text-sm text-slate-400'>
									Your processed content appears here
								</p>
							</div>

							{/* Processing Status */}
							{processingState.stage !== "idle" && (
								<div className={`flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 ${getStageColor(processingState.stage)}`}>
									{getStageIcon(processingState.stage)}
									<div className='flex-1'>
										<p className='text-sm font-medium'>
											{processingState.message}
										</p>
										{processingState.stage !== "complete" &&
											processingState.stage !== "error" && (
												<div className='w-full bg-white/5 rounded-full h-1 mt-2'>
													<div
														className='h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300'
														style={{
															width: `${processingState.progress}%`,
														}}
													/>
												</div>
											)}
									</div>
								</div>
							)}

							<textarea
								ref={outputRef}
								value={outputText}
								readOnly
								placeholder='Humanized text will appear here...'
								className='w-full h-96 p-4 rounded-lg bg-[#05070d] border border-white/10 text-slate-100 placeholder-slate-500 focus:outline-none resize-none'
							/>

							{outputText && (
								<div className='flex items-center justify-between text-sm text-slate-400'>
									<span>
										{outputText.length} characters
									</span>
									{processingTime > 0 && (
										<span>
											Processed in {processingTime.toFixed(2)}s
										</span>
									)}
								</div>
							)}

							{outputText && (
								<Button
									onClick={handleCopy}
									className='w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30'
								>
									<Copy className='w-4 h-4 mr-2' />
									{copySuccess ? "Copied to Clipboard!" : "Copy Humanized Text"}
								</Button>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Info Cards */}
				<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
					<Card className='bg-[#0b0f1a]/50 border border-white/10 backdrop-blur-sm'>
						<CardContent className='p-4 space-y-2'>
							<div className='w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center'>
								<span className='text-blue-400 text-lg'>✨</span>
							</div>
							<h3 className='font-semibold text-slate-100'>Smart Humanization</h3>
							<p className='text-sm text-slate-400'>
								Advanced algorithms transform robotic text into natural language
							</p>
						</CardContent>
					</Card>

					<Card className='bg-[#0b0f1a]/50 border border-white/10 backdrop-blur-sm'>
						<CardContent className='p-4 space-y-2'>
							<div className='w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center'>
								<span className='text-purple-400 text-lg'>✓</span>
							</div>
							<h3 className='font-semibold text-slate-100'>Grammar Check</h3>
							<p className='text-sm text-slate-400'>
								Automatic spell and grammar correction for polished output
							</p>
						</CardContent>
					</Card>

					<Card className='bg-[#0b0f1a]/50 border border-white/10 backdrop-blur-sm'>
						<CardContent className='p-4 space-y-2'>
							<div className='w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center'>
								<span className='text-indigo-400 text-lg'>⚡</span>
							</div>
							<h3 className='font-semibold text-slate-100'>Lightning Fast</h3>
							<p className='text-sm text-slate-400'>
								Get results in seconds with our optimized pipeline
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
