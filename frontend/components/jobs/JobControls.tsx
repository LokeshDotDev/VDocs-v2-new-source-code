"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  jobId: string | null;
  onJobCreated: (id: string) => void;
};

export default function JobControls({ jobId, onJobCreated }: Props) {
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [exportKey, setExportKey] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [stats, setStats] = useState<{ uploaded: number; anonymized: number; humanized: number; total: number }>({ uploaded: 0, anonymized: 0, humanized: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createJob = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/jobs/create", { method: "POST" });
      const data = await res.json();
      if (data.jobId) {
        onJobCreated(data.jobId);
        // start polling for status immediately
        setPolling(true);
      }
    } catch (e) {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const startBatch = async () => {
    if (!jobId) return;
    setStatus("starting");
    try {
      // Only process files already uploaded to this job's raw folder
      const res = await fetch("/api/process/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      
      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        let errorMsg = 'Batch processing failed';
        try {
          if (contentType && contentType.includes('application/json')) {
            const errorData = await res.json();
            errorMsg = errorData.error?.message || errorData.error || errorMsg;
          } else {
            const text = await res.text();
            errorMsg = text.slice(0, 200);
          }
        } catch (parseErr) {
          errorMsg = `HTTP ${res.status}: ${res.statusText}`;
        }
        setStatus('error');
        setErrorMessage(errorMsg);
        return;
      }
      
      const data = await res.json();
      if (data.error) {
        setStatus(`error`);
        setErrorMessage(data.error || 'Unknown error');
      } else {
        setStatus("started");
        setErrorMessage(null);
        setPolling(true);
      }
    } catch (e) {
      setStatus("error");
      setErrorMessage((e as Error).message || 'Network error');
    }
  };

  // Poll job status regularly and update UI
  const pollStatusOnce = async (id: string) => {
    try {
      const r = await fetch(`/api/jobs/${id}/status`);
      if (!r.ok) {
        const body = await r.text();
        setErrorMessage(`Status check failed: ${r.status} ${body}`);
        setStatus('error');
        return;
      }
      const j = await r.json();
      const exportKeyCandidate = j.exportZipKey || j.exportKey || j.zipKey || j.export || null;
      if (exportKeyCandidate) {
        setExportKey(exportKeyCandidate);
        setStatus('completed');
        setPolling(false);
      } else {
        setStatus(j.status || 'processing');
      }
      setProgress(j.progress || 0);
      setStats(j.stats || { uploaded: 0, anonymized: 0, humanized: 0, total: 0 });
      if (j.errorMessage) setErrorMessage(j.errorMessage);
    } catch (e) {
      setErrorMessage((e as Error).message || 'Network error while polling');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (!jobId) return;
    let timer: NodeJS.Timeout | null = null;
    if (polling) {
      // run immediate then interval
      pollStatusOnce(jobId);
      timer = setInterval(() => pollStatusOnce(jobId), 2000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [polling, jobId]);

  const downloadExport = () => {
    if (!exportKey) return;
    // Open download route
    window.open(`/api/files/download-zip?fileKey=${encodeURIComponent(exportKey)}`, "_blank");
  };

  useEffect(() => {
    if (jobId) {
      setStatus(null);
      setExportKey(null);
    }
  }, [jobId]);


  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button onClick={createJob} disabled={creating} size="sm">
          {creating ? "Creating..." : "Create Job"}
        </Button>

        <Button onClick={startBatch} variant="secondary" disabled={!jobId} size="sm">
          Start Batch
        </Button>
      </div>

      <div className="mt-2">
        <p className="text-sm">Status: {status || "idle"}</p>
        {errorMessage && (
          <div className="mt-2 p-2 rounded bg-red-900 text-red-100 text-sm">Error: {errorMessage}</div>
        )}

        <div className="mt-3">
          <p className="text-xs text-muted-foreground">Progress</p>
          <div className="w-full bg-neutral-800 rounded h-2 mt-1">
            <div className="bg-violet-600 h-2 rounded" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs mt-2">
            Uploaded: {stats.uploaded} / {stats.total} • Anonymized: {stats.anonymized} • Humanized: {stats.humanized}
          </div>
        </div>

        {exportKey && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={downloadExport}>
              Download ZIP
            </Button>
            <a href={`/api/files/download-zip?fileKey=${encodeURIComponent(exportKey)}`} className="text-sm text-muted-foreground self-center">Open in new tab</a>
          </div>
        )}
      </div>
    </div>
  );
}
