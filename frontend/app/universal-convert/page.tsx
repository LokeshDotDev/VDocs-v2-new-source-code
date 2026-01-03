"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Upload,
	Download,
	RefreshCw,
	FileText,
	File,
	Image,
	Video,
	Music,
	Archive,
	ChevronDown,
	X,
	CheckCircle2,
} from "lucide-react";

// Comprehensive format categories
const FORMATS = {
	document: {
		label: "Document",
		icon: FileText,
		formats: ["PDF", "DOCX", "DOC", "ODT", "RTF", "TXT", "HTML", "PAGES"],
	},
	image: {
		label: "Image",
		icon: Image,
		formats: ["JPG", "PNG", "GIF", "BMP", "TIFF", "WebP", "SVG", "HEIC", "ICO"],
	},
	video: {
		label: "Video",
		icon: Video,
		formats: [
			"MP4",
			"MOV",
			"AVI",
			"MKV",
			"WebM",
			"FLV",
			"M4V",
			"MPEG",
			"WMV",
			"OGG",
		],
	},
	audio: {
		label: "Audio",
		icon: Music,
		formats: ["MP3", "WAV", "FLAC", "M4A", "AAC", "OGG", "WMA", "AIFF"],
	},
	archive: {
		label: "Archive",
		icon: Archive,
		formats: ["ZIP", "RAR", "7Z", "TAR", "GZ"],
	},
};

type FileWithFormat = {
	file: File;
	outputFormat: string;
	status: "pending" | "converting" | "completed" | "error";
	progress: number;
};

export default function UniversalConvertPage() {
	const [files, setFiles] = useState<FileWithFormat[]>([]);
	const [showFormatPicker, setShowFormatPicker] = useState<number | null>(null);
	const [converting, setConverting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const uploadedFiles = Array.from(e.target.files || []);
		const newFiles: FileWithFormat[] = uploadedFiles.map((file) => ({
			file,
			outputFormat: "",
			status: "pending",
			progress: 0,
		}));
		setFiles([...files, ...newFiles]);
	};

	const setOutputFormat = (index: number, format: string) => {
		const updated = [...files];
		updated[index].outputFormat = format;
		setFiles(updated);
		setShowFormatPicker(null);
	};

	const removeFile = (index: number) => {
		setFiles(files.filter((_, i) => i !== index));
	};

	const getFileExtension = (filename: string): string => {
		return filename.split(".").pop()?.toUpperCase() || "FILE";
	};

	const handleConvert = async () => {
		if (files.some((f) => !f.outputFormat)) {
			alert("Please select output format for all files");
			return;
		}

		setConverting(true);

		try {
			// Convert each file individually
			for (let i = 0; i < files.length; i++) {
				const fileItem = files[i];
				const formData = new FormData();
				formData.append("file", fileItem.file);
				formData.append("format", fileItem.outputFormat);

				// Update status to converting
				setFiles((prev) =>
					prev.map((f, idx) =>
						idx === i ? { ...f, status: "converting", progress: 50 } : f
					)
				);

				const response = await fetch("/api/converter/universal", {
					method: "POST",
					body: formData,
				});

				if (!response.ok) {
					throw new Error(`Conversion failed for ${fileItem.file.name}`);
				}

				// Download the converted file directly
				const blob = await response.blob();
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				
				// Get filename without extension
				const baseName = fileItem.file.name.replace(/\.[^/.]+$/, "");
				a.download = `${baseName}.${fileItem.outputFormat.toLowerCase()}`;
				
				document.body.appendChild(a);
				a.click();
				window.URL.revokeObjectURL(url);
				document.body.removeChild(a);

				// Update status to completed
				setFiles((prev) =>
					prev.map((f, idx) =>
						idx === i ? { ...f, status: "completed", progress: 100 } : f
					)
				);
			}

			// Clear after 2 seconds
			setTimeout(() => {
				setFiles([]);
			}, 2000);
		} catch (error) {
			console.error("Conversion error:", error);
			alert("Conversion failed. Please try again.");
			// Reset failed files
			setFiles((prev) =>
				prev.map((f) =>
					f.status === "converting" ? { ...f, status: "error", progress: 0 } : f
				)
			);
		} finally {
			setConverting(false);
		}
	};

	return (
		<div className='min-h-screen bg-gradient-to-b from-[#050910] via-[#0a1020] to-[#0b1224] text-slate-100'>
			<div className='mx-auto max-w-6xl px-4 py-16 space-y-8'>
				{/* Header */}
				<div className='text-center space-y-4'>
					<div className='inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm'>
						<RefreshCw className='w-4 h-4' />
						<span>Universal File Converter</span>
					</div>
					<h1 className='text-5xl font-bold'>
						Convert{" "}
						<span className='bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent'>
							Any File Format
						</span>
					</h1>
					<p className='text-xl text-slate-400 max-w-2xl mx-auto'>
						Documents, images, videos, audio - convert between hundreds of
						formats instantly
					</p>
				</div>

				{/* Upload Area */}
				<Card className='border-dashed border-2 border-white/20 bg-white/5 backdrop-blur p-12'>
					<input
						ref={fileInputRef}
						type='file'
						multiple
						onChange={handleFileUpload}
						className='hidden'
						accept='*/*'
					/>

					{files.length === 0 ? (
						<div className='text-center space-y-4'>
							<div className='w-20 h-20 mx-auto rounded-full bg-indigo-500/20 flex items-center justify-center'>
								<Upload className='w-10 h-10 text-indigo-400' />
							</div>
							<div>
								<h3 className='text-xl font-semibold mb-2'>
									Upload Files to Convert
								</h3>
								<p className='text-slate-400 mb-4'>
									Support for 100+ file formats
								</p>
								<Button
									size='lg'
									onClick={() => fileInputRef.current?.click()}
									className='gap-2'>
									<Upload className='w-5 h-5' />
									Choose Files
								</Button>
							</div>
						</div>
					) : (
						<div className='space-y-4'>
							{files.map((fileItem, index) => (
								<Card
									key={index}
									className='p-4 bg-white/5 border-white/10 flex items-center justify-between'>
									<div className='flex items-center gap-4 flex-1'>
										<div className='w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center'>
											<File className='w-6 h-6 text-indigo-400' />
										</div>
										<div className='flex-1'>
											<p className='font-medium truncate max-w-xs'>
												{fileItem.file.name}
											</p>
											<p className='text-sm text-slate-400'>
												{(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
											</p>
										</div>

										{/* Format Selector */}
										<div className='flex items-center gap-3'>
											<div className='px-3 py-1 rounded bg-blue-500/20 text-blue-300 text-sm font-medium'>
												{getFileExtension(fileItem.file.name)}
											</div>
											<RefreshCw className='w-4 h-4 text-slate-400' />
											<div className='relative'>
												<Button
													variant='outline'
													size='sm'
													onClick={() => setShowFormatPicker(index)}
													className='gap-2'>
													{fileItem.outputFormat || "Select Format"}
													<ChevronDown className='w-4 h-4' />
												</Button>

												{showFormatPicker === index && (
													<div className='absolute top-full mt-2 right-0 w-96 bg-[#0a1020] border border-white/10 rounded-lg shadow-2xl p-4 z-50 max-h-96 overflow-y-auto'>
														{Object.entries(FORMATS).map(([key, category]) => (
															<div key={key} className='mb-4'>
																<div className='flex items-center gap-2 mb-2'>
																	<category.icon className='w-4 h-4 text-indigo-400' />
																	<h4 className='text-sm font-semibold text-slate-300'>
																		{category.label}
																	</h4>
																</div>
																<div className='grid grid-cols-4 gap-2'>
																	{category.formats.map((format) => (
																		<button
																			key={format}
																			onClick={() =>
																				setOutputFormat(index, format)
																			}
																			className='px-3 py-2 text-sm rounded bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/30 transition-colors'>
																			{format}
																		</button>
																	))}
																</div>
															</div>
														))}
													</div>
												)}
											</div>
										</div>

										{/* Status */}
										{fileItem.status === "completed" && (
											<CheckCircle2 className='w-5 h-5 text-green-400' />
										)}
									</div>

									<Button
										variant='ghost'
										size='sm'
										onClick={() => removeFile(index)}
										disabled={converting}>
										<X className='w-4 h-4' />
									</Button>
								</Card>
							))}

							<div className='flex items-center justify-between pt-4'>
								<Button
									variant='outline'
									onClick={() => fileInputRef.current?.click()}
									disabled={converting}>
									<Upload className='w-4 h-4 mr-2' />
									Add More Files
								</Button>

								<Button
									size='lg'
									onClick={handleConvert}
									disabled={
										converting || files.some((f) => !f.outputFormat)
									}
									className='gap-2'>
									{converting ? (
										<>
											<RefreshCw className='w-5 h-5 animate-spin' />
											Converting...
										</>
									) : (
										<>
											<Download className='w-5 h-5' />
											Convert & Download {files.length > 1 ? `(${files.length} files)` : ""}
										</>
									)}
								</Button>
							</div>
						</div>
					)}
				</Card>

				{/* Supported Formats */}
				<div className='grid md:grid-cols-2 lg:grid-cols-5 gap-4'>
					{Object.entries(FORMATS).map(([key, category]) => (
						<Card
							key={key}
							className='p-4 bg-white/5 border-white/10 hover:bg-white/10 transition-colors'>
							<div className='flex items-center gap-3 mb-2'>
								<div className='w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center'>
									<category.icon className='w-5 h-5 text-indigo-400' />
								</div>
								<h3 className='font-semibold'>{category.label}</h3>
							</div>
							<p className='text-sm text-slate-400'>
								{category.formats.length} formats
							</p>
						</Card>
					))}
				</div>
			</div>
		</div>
	);
}
