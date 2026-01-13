"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download } from "lucide-react";
import { useSession } from "next-auth/react";

type DocEditorInstance = {
	destroyEditor: () => void;
};

declare global {
	interface Window {
		DocsAPI?: {
			DocEditor: new (id: string, config: unknown) => DocEditorInstance;
		};
	}
}

export default function EditorPage() {
	const [uploadedFile, setUploadedFile] = useState<File | null>(null);
	const [editorReady, setEditorReady] = useState(false);
	const [documentKey, setDocumentKey] = useState<string>("");
	const [fileName, setFileName] = useState<string>("");
	const [fileType, setFileType] = useState<string>("docx");
	const [documentType, setDocumentType] = useState<"word" | "cell" | "slide">("word");
	const [fileExt, setFileExt] = useState<string>("docx");
	const [showNextPrompt, setShowNextPrompt] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const editorRef = useRef<DocEditorInstance | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const { data: session } = useSession();

	const resolveDocType = (ext: string): { documentType: "word" | "cell" | "slide"; fileType: string } => {
		const lower = ext.toLowerCase();
		const wordExt = ["doc", "docx", "odt", "rtf", "txt", "pdf"];
		const cellExt = ["xls", "xlsx", "ods", "csv"];
		const slideExt = ["ppt", "pptx", "odp"];
		if (wordExt.includes(lower)) return { documentType: "word", fileType: lower };
		if (cellExt.includes(lower)) return { documentType: "cell", fileType: lower };
		if (slideExt.includes(lower)) return { documentType: "slide", fileType: lower };
		return { documentType: "word", fileType: lower };
	};

	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const ext = file.name.split(".").pop()?.toLowerCase() || "docx";
		const { documentType: docType, fileType: ooFileType } = resolveDocType(ext);

		setUploadedFile(file);
		setEditorReady(false);
		setFileName(file.name);
		setDocumentType(docType);
		setFileType(ooFileType);
		setFileExt(ext);

		// Generate unique document key
		const key = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;
		setDocumentKey(key);

		// Upload file to temporary endpoint for editing
		const formData = new FormData();
		formData.append("file", file);
		formData.append("documentKey", key);
		formData.append("ext", ext);

		try {
			const response = await fetch("/api/editor/upload-local", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				throw new Error("Failed to upload file");
			}

			const { url } = await response.json();

			// Initialize OnlyOffice editor
			await initializeEditor(url, file.name, key, docType, ooFileType, ext);
		} catch (error) {
			console.error("Upload failed:", error);
			alert("Failed to upload file. Please try again.");
		}
	};

	const initializeEditor = async (
		docUrl: string,
		fileName: string,
		key: string,
		docType: "word" | "cell" | "slide",
		fileTypeForOO: string,
		fileExtForCallback: string
	) => {
		// Load OnlyOffice API
		if (!window.DocsAPI) {
			const script = document.createElement("script");
			script.src = `${
				process.env.NEXT_PUBLIC_ONLYOFFICE_API_URL || "http://localhost:8080"
			}/web-apps/apps/api/documents/api.js`;
			script.async = true;
			await new Promise((resolve, reject) => {
				script.onload = resolve;
				script.onerror = reject;
				document.body.appendChild(script);
			});
		}

		if (!containerRef.current) return;

		// Destroy existing editor
		if (editorRef.current) {
			try {
				editorRef.current.destroyEditor();
			} catch (e) {
				console.error("Error destroying editor:", e);
			}
		}

		// Configure editor
		const callbackParams = new URLSearchParams({
			key,
			ext: fileExtForCallback,
			userId: session?.user?.id || "anonymous",
		});

		const config = {
			documentType: docType,
			document: {
				fileType: fileTypeForOO,
				key: key,
				title: fileName,
				url: docUrl,
				permissions: {
					edit: true,
					download: true,
					print: true,
					review: true,
				},
			},
			editorConfig: {
				mode: "edit",
				lang: "en",
				callbackUrl: `http://host.docker.internal:3001/api/editor/callback?${callbackParams.toString()}`,
				customization: {
					autosave: false,
					forcesave: false,
					compactHeader: false,
					toolbarNoTabs: false,
				},
				user: {
					id: "local-user",
					name: "Local User",
				},
			},
			events: {
				onDocumentReady: () => {
					console.log("Document ready");
					setEditorReady(true);
				},
				onError: (error: unknown) => {
					console.error("OnlyOffice error:", error);
				},
			},
			width: "100%",
			height: "100%",
		};

	if (window.DocsAPI) {
		editorRef.current = new window.DocsAPI.DocEditor(
			containerRef.current.id,
			config
		);
	}
};

// Download is available via OnlyOffice toolbar; keeping handler removed from UI to declutter.

const handleDownloadWithPrompt = async () => {	if (!documentKey) return;
	const userId = session?.user?.id || "anonymous";
		try {
			const response = await fetch(
				`/api/editor/download-local?key=${documentKey}&ext=${fileExt}&name=${encodeURIComponent(
					fileName || "edited-file"
				)}&userId=${encodeURIComponent(userId)}`
			);
			if (!response.ok) {
				throw new Error("Failed to download file");
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = fileName || `edited-document.${fileExt}`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);

			setShowNextPrompt(true);
		} catch (error) {
			console.error("Download failed:", error);
			alert("Failed to download file. Please try again.");
		}
	};

	return (
		<div className='fixed inset-0 bg-gradient-to-b from-[#050910] via-[#0a1020] to-[#0b1224] text-slate-100 flex flex-col'>
			<input
				ref={fileInputRef}
				type='file'
				accept='.doc,.docx,.odt,.rtf,.txt,.pdf,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp'
				onChange={handleFileUpload}
				className='hidden'
			/>

			{/* Editor Area */}
			<div className='flex-1 overflow-hidden'>
				{uploadedFile ? (
					<div
						id='onlyoffice-editor-container'
						ref={containerRef}
						className='w-full h-full'
					/>
				) : (
					<div className='flex items-center justify-center h-full'>
						<div className='text-center space-y-4 max-w-md'>
							<div className='w-20 h-20 mx-auto bg-indigo-500/10 rounded-full flex items-center justify-center'>
								<FileText className='w-10 h-10 text-indigo-400' />
							</div>
							<h2 className='text-2xl font-bold'>
								Upload a Document to Get Started
							</h2>
							<p className='text-slate-400'>
								Upload a supported document (Word, PDF, Sheets, Slides) to edit it
								with OnlyOffice. Your file stays local and secure.
							</p>
							<Button
								onClick={() => fileInputRef.current?.click()}
								size='lg'
								className='gap-2'>
								<Upload className='w-5 h-5' />
								Upload a File
							</Button>
						</div>
					</div>
				)}
			</div>

			{/* Minimal download control and post-download prompt */}
			{uploadedFile && editorReady && (
				<div className='fixed bottom-4 right-4 z-50 flex items-center gap-3'>
					<Button
						onClick={handleDownloadWithPrompt}
						size='sm'
						className='bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30 border border-white/10'>
						<Download className='w-4 h-4 mr-2' />
						Download
					</Button>
				</div>
			)}

			{showNextPrompt && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'>
					<div className='bg-[#0b0f1a] border border-white/10 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl'>
						<h3 className='text-lg font-semibold text-slate-100'>Load another file?</h3>
						<p className='text-sm text-slate-400'>You can keep this document open or pick a new one to edit.</p>
						<div className='flex justify-end gap-2'>
							<Button
								variant='outline'
								onClick={() => setShowNextPrompt(false)}
								className='border-white/15 text-slate-200 hover:bg-white/10'
							>
								Keep current
							</Button>
							<Button
								onClick={() => {
									setShowNextPrompt(false);
									fileInputRef.current?.click();
								}}
								className='bg-indigo-600 hover:bg-indigo-500 text-white'
							>
								Load another
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
