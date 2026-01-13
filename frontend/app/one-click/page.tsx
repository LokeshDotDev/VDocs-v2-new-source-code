"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Upload,
	FileText,
	Shield,
	Sparkles,
	CheckCircle2,
	Download,
	RefreshCw,
	AlertCircle,
	Folder,
	Loader2,
} from "lucide-react";
import * as tus from "tus-js-client";

type ProcessingStage =
	| "upload"
	| "convert"
	| "anonymize"
	| "humanize"
	| "spell-grammar"
	| "format"
	| "complete";

interface ProcessingStatus {
	stage: ProcessingStage;
	progress: number;
	message: string;
	error?: string;
}

const STAGES = [
	{ id: "convert" as ProcessingStage, icon: RefreshCw, title: "Converting", description: "PDF to DOCX", color: "blue" },
	{ id: "anonymize" as ProcessingStage, icon: Shield, title: "Anonymizing", description: "Remove personal info", color: "purple" },
	{ id: "humanize" as ProcessingStage, icon: Sparkles, title: "Humanizing", description: "Natural text", color: "pink" },
	{ id: "spell-grammar" as ProcessingStage, icon: CheckCircle2, title: "Checking", description: "Spell & grammar", color: "green" },
	{ id: "format" as ProcessingStage, icon: FileText, title: "Formatting", description: "Professional style", color: "orange" },
];

export default function OneClickPage() {
	const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
	const [folderStructure, setFolderStructure] = useState<Map<string, File[]>>(new Map());
	const [processing, setProcessing] = useState(false);
	const [status, setStatus] = useState<ProcessingStatus>({
		stage: "upload",
		progress: 0,
		message: "Ready to process",
	});
	const [jobId, setJobId] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const pollRef = useRef<NodeJS.Timeout | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		return () => {
			if (pollRef.current) {
				clearInterval(pollRef.current);
			}
		};
	}, []);

	const getRelativePath = (file: File) => {
		const candidate = file as File & { webkitRelativePath?: string };
		return candidate.webkitRelativePath || file.name;
	};

	const ingestFiles = (files: File[]) => {
		const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith(".pdf"));
		if (pdfFiles.length === 0) return;

		const structure = new Map<string, File[]>();
		pdfFiles.forEach((file) => {
			const relativePath = getRelativePath(file);
			const pathParts = relativePath.split("/");
			const folderPath = pathParts.slice(0, -1).join("/") || "root";

			if (!structure.has(folderPath)) {
				structure.set(folderPath, []);
			}
			structure.get(folderPath)!.push(file);
		});

		setUploadedFiles(pdfFiles);
		setFolderStructure(structure);
		setStatus({
			stage: "upload",
			progress: 0,
			message: `${pdfFiles.length} PDF files ready`,
		});
	};

	const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []);
		if (files.length === 0) return;
		ingestFiles(files);
	};

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(false);
		const files = Array.from(e.dataTransfer?.files || []);
		if (files.length === 0) return;
		ingestFiles(files);
	};

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(true);
		if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
	};

	const handleDragLeave = () => setIsDragging(false);

	const clearPolling = () => {
		if (pollRef.current) {
			clearInterval(pollRef.current);
			pollRef.current = null;
		}
	};

	const startPolling = (activeJobId: string) => {
		clearPolling();
		pollRef.current = setInterval(async () => {
			try {
				const response = await fetch(`/api/one-click/status?jobId=${activeJobId}`);
				if (!response.ok) return;
				const data = await response.json();


				if (data.stage === "complete" || data.error) {
					clearPolling();
					setProcessing(false);
				}
			} catch (error) {
				clearPolling();
				setProcessing(false);
			}
		}, 2000);
	};

	useEffect(() => {
		// Resume an in-flight job after refresh/navigation
		const storedJob = typeof window !== "undefined" ? localStorage.getItem("oneClickJobId") : null;
		if (!storedJob) return;

		const resume = async () => {
			try {
				const res = await fetch(`/api/one-click/status?jobId=${storedJob}`);
				if (!res.ok) {
					localStorage.removeItem("oneClickJobId");
					return;
				}
				const data = await res.json();
				setJobId(storedJob);
				setStatus({
					stage: data.stage,
					progress: data.progress,
					message: data.message,
					error: data.error,
				});
				if (data.stage !== "complete" && !data.error) {
					setProcessing(true);
					startPolling(storedJob);
				}
			} catch (err) {
				localStorage.removeItem("oneClickJobId");
			}
		};

		resume();
	}, []);

	const handleProcess = async () => {
		if (uploadedFiles.length === 0) return;

		clearPolling();
		setProcessing(true);
		setStatus({ stage: "upload", progress: 0, message: "Uploading files..." });

		try {
			console.log(`🚀 Uploading ${uploadedFiles.length} files`);
			
			// Initialize job
			const initResponse = await fetch("/api/one-click/upload", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fileCount: uploadedFiles.length,
					folderStructure: Array.from(folderStructure.keys()),
				}),
			});

			if (!initResponse.ok) throw new Error("Failed to initialize");

			const { jobId: newJobId, uploadUrl, metadata } = await initResponse.json();
			console.log("✅ Upload initialized:", newJobId);
			localStorage.setItem("oneClickJobId", newJobId);
			setJobId(newJobId);

		// Upload all files with TUS
		let uploadedCount = 0;
		for (const file of uploadedFiles) {
			const relativePath = getRelativePath(file);
				
				const fileMetadata = {
					...metadata,
					filename: file.name,
					filetype: file.type || "application/pdf",
					relativePath: relativePath,
				};

				await new Promise<void>((resolve, reject) => {
					const upload = new tus.Upload(file, {
						endpoint: uploadUrl,
						metadata: fileMetadata,
						retryDelays: [0, 1000, 3000, 5000],
						chunkSize: 5 * 1024 * 1024,
						onError: (error) => {
							console.error(`❌ Upload failed: ${file.name}`, error);
							reject(error);
						},
						onProgress: (bytesUploaded, bytesTotal) => {
							const fileProgress = (bytesUploaded / bytesTotal) * 100;
							const totalProgress = ((uploadedCount + fileProgress / 100) / uploadedFiles.length) * 100;
							setStatus(prev => ({
								...prev,
								progress: Math.round(totalProgress),
								message: `Uploading ${uploadedCount + 1}/${uploadedFiles.length}: ${file.name}`,
							}));
						},
						onSuccess: () => {
							console.log(`✅ Uploaded: ${file.name}`);
							uploadedCount++;
							resolve();
						},
					});
					upload.start();
				});
			}

			console.log("✅ All files uploaded!");
			
			// Start processing
			const processResponse = await fetch("/api/one-click/process", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jobId: newJobId }),
			});

			if (!processResponse.ok) throw new Error("Processing failed");

			console.log("✅ Processing started");
			startPolling(newJobId);
		} catch (error) {
			console.error("❌ Error:", error);
			setStatus({
				stage: "upload",
				progress: 0,
				message: "Upload failed",
				error: error instanceof Error ? error.message : String(error),
			});
			setProcessing(false);
		}
	};

	const handleDownload = async () => {
		if (!jobId) return;
		window.location.href = `/api/one-click/download?jobId=${jobId}`;
	};

	const resetProcess = () => {
		setUploadedFiles([]);
		setFolderStructure(new Map());
		setProcessing(false);
		setStatus({ stage: "upload", progress: 0, message: "Ready to process" });
		setJobId(null);
		localStorage.removeItem("oneClickJobId");
		clearPolling();
	};

	return (
		<div className="min-h-screen bg-slate-950 text-slate-50">
			<div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
				<div className="text-center space-y-2">
					<p className="text-sm uppercase tracking-[0.25em] text-slate-400">One-Click</p>
					<h1 className="text-4xl font-bold text-slate-50">Process Entire Folder Structures</h1>
					<p className="text-slate-400 text-sm">Upload MBA/SEM*/.../file.pdf → process all → download organized ZIP</p>
				</div>

			{/* Upload Area */}
			{!processing && uploadedFiles.length === 0 && (
				<Card
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					className={`p-8 mb-6 bg-slate-900/80 border ${isDragging ? 'border-indigo-500' : 'border-slate-800'} shadow-xl transition-colors`}
				>
					<input
						type="file"
						ref={fileInputRef}
						onChange={handleFolderSelect}
					// @ts-expect-error: webkitdirectory is a non-standard attribute
						webkitdirectory=""
						directory=""
						multiple
						style={{ display: 'none' }}
					/>
					<div className="text-center space-y-3">
						<Folder className="mx-auto h-16 w-16 text-indigo-300 mb-2" />
						<p className="text-xl font-semibold text-slate-50">Upload or Drop Entire Folder</p>
						<p className="text-sm text-slate-400">Select or drag your main folder (e.g., MBA) with all subfolders and PDFs</p>
						<div className="flex items-center justify-center gap-3">
							<Button onClick={() => fileInputRef.current?.click()} size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white">
								<Folder className="mr-2 h-5 w-5" />
								Select Folder
							</Button>
							<span className="text-slate-500 text-sm">or drag & drop here</span>
						</div>
						<p className="text-xs text-slate-400">Example: MBA/SEM1/23562378/file1.pdf ...</p>
					</div>
				</Card>
			)}

			{/* File Preview */}
			{uploadedFiles.length > 0 && !processing && (
				<Card className="p-6 mb-6 bg-slate-900/80 border border-slate-800 shadow-xl">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-3">
							<Folder className="h-8 w-8 text-indigo-300" />
							<div>
								<p className="font-semibold text-slate-50">{uploadedFiles.length} PDF file(s) selected</p>
								<p className="text-sm text-slate-400">
									{Array.from(folderStructure.keys()).length} folder(s)
								</p>
							</div>
						</div>
						<div className="flex gap-2">
							<Button onClick={resetProcess} variant="outline" size="sm" className="border-slate-700 text-slate-200">
								Clear
							</Button>
							<Button onClick={handleProcess} size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
								<Sparkles className="mr-2 h-4 w-4" />
								Process All
							</Button>
						</div>
					</div>
					<div className="max-h-60 overflow-y-auto space-y-2 text-slate-200">
						{Array.from(folderStructure.entries()).map(([folder, files]) => (
							<div key={folder} className="border-l-2 border-blue-500 pl-4">
								<p className="text-sm font-medium text-muted-foreground mb-1">
									📁 {folder}
								</p>
								{files.map((file, idx) => (
									<p key={idx} className="text-sm pl-4">
										📄 {file.name}
									</p>
								))}
							</div>
						))}
					</div>
				</Card>
			)}

			{/* Processing */}
			{processing && (
				<Card className="p-6 mb-6 bg-slate-900/80 border border-slate-800 shadow-xl">
					<div className="space-y-6">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-semibold text-slate-50">{status.message}</h3>
							<span className="text-2xl font-bold text-indigo-200">{status.progress}%</span>
						</div>
						<div className="w-full bg-slate-800 rounded-full h-3">
							<div
								className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-300"
								style={{ width: `${status.progress}%` }}
							/>
						</div>
						<div className="grid grid-cols-5 gap-4">
							{STAGES.map((stage) => {
								const Icon = stage.icon;
								const isActive = status.stage === stage.id;
								const isComplete = STAGES.findIndex(s => s.id === status.stage) > STAGES.findIndex(s => s.id === stage.id);
								
								return (
									<div
										key={stage.id}
										className={`text-center p-3 rounded-lg border ${
											isActive ? 'border-indigo-500 bg-indigo-500/10' : 
											isComplete ? 'border-emerald-500 bg-emerald-500/10' : 
											'border-slate-800 bg-slate-900'
										}`}
									>
										<Icon className={`mx-auto h-6 w-6 mb-2 ${
											isActive ? 'text-indigo-400' : 
											isComplete ? 'text-emerald-400' : 
											'text-slate-500'
										}`} />
										<p className="text-xs font-medium text-slate-200">{stage.title}</p>
									</div>
								);
							})}
						</div>
						{status.error && (
							<div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
								<AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
								<div>
									<h4 className="font-semibold text-red-100">Error</h4>
									<p className="text-sm text-red-200">{status.error}</p>
								</div>
							</div>
						)}
					</div>
				</Card>
			)}

			{/* Complete */}
			{status.stage === "complete" && !status.error && (
				<Card className="p-8 text-center bg-emerald-500/10 border border-emerald-500/30 shadow-xl">
					<CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
					<h2 className="text-2xl font-bold mb-2 text-slate-50">Processing Complete!</h2>
					<p className="text-slate-200 mb-6 text-sm">
						All files processed. Download keeps your folder structure.
					</p>
					<Button onClick={handleDownload} size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white">
						<Download className="mr-2 h-5 w-5" />
						Download ZIP
					</Button>
				</Card>
			)}
		</div>
		</div>
	);
}
