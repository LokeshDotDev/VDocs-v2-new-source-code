"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileText } from "lucide-react";

declare global {
	interface Window {
		DocsAPI?: any;
	}
}

export default function EditorPage() {
	const [uploadedFile, setUploadedFile] = useState<File | null>(null);
	const [editorReady, setEditorReady] = useState(false);
	const [documentKey, setDocumentKey] = useState<string>("");
	const [fileName, setFileName] = useState<string>("");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const editorRef = useRef<any>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Restore state from sessionStorage on mount
	useEffect(() => {
		const savedKey = sessionStorage.getItem("editor_doc_key");
		const savedName = sessionStorage.getItem("editor_doc_name");

		if (savedKey && savedName) {
			setDocumentKey(savedKey);
			setFileName(savedName);
			// Create a placeholder file object
			const placeholder = new File([], savedName, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
			setUploadedFile(placeholder);
			
			// Reinitialize editor with saved document
			const docUrl = `http://host.docker.internal:3001/api/editor/serve-local?key=${savedKey}`;
			initializeEditor(docUrl, savedName, savedKey);
		}
	}, []);

	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (!file.name.endsWith(".docx")) {
			alert("Please upload a DOCX file");
			return;
		}

		setUploadedFile(file);
		setEditorReady(false);
		setFileName(file.name);

		// Generate unique document key
		const key = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;
		setDocumentKey(key);

		// Save to sessionStorage for persistence
		sessionStorage.setItem("editor_doc_key", key);
		sessionStorage.setItem("editor_doc_name", file.name);

		// Upload file to temporary endpoint for editing
		const formData = new FormData();
		formData.append("file", file);
		formData.append("documentKey", key);

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
			await initializeEditor(url, file.name, key);
		} catch (error) {
			console.error("Upload failed:", error);
			alert("Failed to upload file. Please try again.");
		}
	};

	const initializeEditor = async (
		docUrl: string,
		fileName: string,
		key: string
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
		const config = {
			documentType: "word",
			document: {
				fileType: "docx",
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
				callbackUrl: `http://host.docker.internal:3001/api/editor/callback?key=${key}`,
				customization: {
					autosave: true,
					forcesave: true,
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
				onError: (error: any) => {
					console.error("OnlyOffice error:", error);
				},
			},
			width: "100%",
			height: "100%",
		};

		editorRef.current = new window.DocsAPI.DocEditor(
			containerRef.current.id,
			config
		);
	};

	const handleDownload = async () => {
		if (!documentKey) return;

		try {
			const response = await fetch(
				`/api/editor/download-local?key=${documentKey}`
			);
			if (!response.ok) {
				throw new Error("Failed to download file");
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = fileName || "edited-document.docx";
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
		} catch (error) {
			console.error("Download failed:", error);
			alert("Failed to download file. Please try again.");
		}
	};

	return (
		<div className='fixed inset-0 bg-gradient-to-b from-[#050910] via-[#0a1020] to-[#0b1224] text-slate-100 flex flex-col'>
			{/* Header */}
			<div className='flex items-center justify-between px-6 py-4 bg-black/20 border-b border-white/10'>
				<div className='flex items-center gap-4'>
					<FileText className='w-6 h-6 text-indigo-400' />
					<div>
						<h1 className='text-xl font-bold'>Document Editor</h1>
						{fileName && (
							<p className='text-sm text-slate-400'>{fileName}</p>
						)}
					</div>
				</div>

				<div className='flex items-center gap-3'>
					<input
						ref={fileInputRef}
						type='file'
						accept='.docx'
						onChange={handleFileUpload}
						className='hidden'
					/>
					<Button
						onClick={() => fileInputRef.current?.click()}
						variant='outline'
						className='gap-2'>
						<Upload className='w-4 h-4' />
						{uploadedFile ? "Upload New" : "Upload DOCX"}
					</Button>

					{uploadedFile && editorReady && (
						<Button onClick={handleDownload} className='gap-2'>
							<Download className='w-4 h-4' />
							Download
						</Button>
					)}
				</div>
			</div>

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
								Upload a DOCX file to edit it online like Microsoft Word. Your
								file stays local and secure.
							</p>
							<Button
								onClick={() => fileInputRef.current?.click()}
								size='lg'
								className='gap-2'>
								<Upload className='w-5 h-5' />
								Upload DOCX File
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
