"use client";

import React, { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Editor } from "@ckeditor/ckeditor5-core";
import "../../editor/styles.css";

const CKEditor = dynamic(
	() => import("@ckeditor/ckeditor5-react").then((mod) => mod.CKEditor),
	{ ssr: false }
);

// We will load the actual build constructor dynamically in useEffect

interface CKEditorWrapperProps {
	data: string;
	onChange: (html: string) => void;
}

type EditorConstructor = typeof Editor;

const CKEditorWrapper: React.FC<CKEditorWrapperProps> = ({
	data,
	onChange,
}) => {
	const [isClient, setIsClient] = useState(false);
	const [EditorBuild, setEditorBuild] = useState<unknown>(null);
	const editorRef = useRef<Editor | null>(null);

	useEffect(() => {
		let mounted = true;
		setIsClient(true);
		// Try Classic build first (more compatible with Next/Turbopack). Fallback to Decoupled
		import("@ckeditor/ckeditor5-build-classic")
			.then((mod) => {
				const ctor = (mod as { default?: unknown }).default || mod;
				if (mounted) setEditorBuild(ctor);
			})
			.catch(async () => {
				try {
					const dec = await import(
						"@ckeditor/ckeditor5-build-decoupled-document/build/ckeditor"
					);
					const ctor = (dec as { default?: unknown }).default || dec;
					if (mounted) setEditorBuild(ctor);
				} catch (err) {
					console.error("Failed to load CKEditor builds", err);
				}
			});
		return () => {
			mounted = false;
		};
	}, []);

	const handleReady = (editor: Editor) => {
		editorRef.current = editor;
		// Classic build renders toolbar internally; decoupled also provides its own toolbar element.
	};

	if (!isClient || !EditorBuild) {
		return (
			<div className='editor-container space-y-4 min-h-96 bg-gray-50 rounded p-4'>
				Loading editor...
			</div>
		);
	}

	return (
		<div className='editor-container space-y-4'>
			<CKEditor
				// @ts-expect-error: CKEditor component expects constructor, EditorBuild is dynamically loaded
				editor={EditorBuild}
				data={data}
				onReady={handleReady}
				onChange={(event: Event, editor: Editor) => {
					const html = editor.getData();
					onChange(html);
				}}
				config={{
					placeholder: "Start typing your content here...",
					toolbar: {
						items: [
							"heading",
							"|",
							"bold",
							"italic",
							"link",
							"bulletedList",
							"numberedList",
							"|",
							"blockQuote",
							"insertTable",
							"undo",
							"redo",
						],
					},
					table: {
						contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
					},
				}}
			/>
		</div>
	);
};

export default CKEditorWrapper;
