"use client";

import React from "react";
import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 border-r p-4 bg-neutral-900 text-white">
      <div className="mb-6">
        <h2 className="text-lg font-bold">WeDocs</h2>
        <p className="text-sm text-muted-foreground">Document Redaction</p>
      </div>

      <nav className="flex flex-col gap-2">
        <Link href="/" className="p-2 rounded hover:bg-neutral-800">Home</Link>
        <Link href="/jobs" className="p-2 rounded bg-violet-600 text-white">Jobs</Link>
        <Link href="/editor" className="p-2 rounded hover:bg-neutral-800">Editor</Link>
        <Link href="/humanizer" className="p-2 rounded hover:bg-neutral-800">Humanizer</Link>
        <Link href="/convert" className="p-2 rounded hover:bg-neutral-800">Converter</Link>
      </nav>
    </aside>
  );
}
