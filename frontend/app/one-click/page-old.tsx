"use client";

import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import Sidebar from "@/components/Sidebar";
import TusFileUpload from "@/components/upload/TusFileUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Download, Trash2, CheckCircle, ArrowRight } from "lucide-react";
import { TUS_CLIENT_CONFIG } from "@/lib/upload/config/tus-upload-config";

export default function OneClickPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "completed" | "error">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Initialize Job ID
  useEffect(() => {
    // Check if we have an active job in session, else create new
    // Actually, for "1 click" maybe always fresh?
    // Let's create fresh if not present
        if (!jobId) {
            const newId = uuidv4();
            setJobId(newId);
            TUS_CLIENT_CONFIG.destinationPath = `jobs/${newId}/raw/`;
            TUS_CLIENT_CONFIG.jobId = newId; // Set jobId for TUS upload metadata
        } else {
            TUS_CLIENT_CONFIG.jobId = jobId; // Always keep jobId in sync
        }
  }, [jobId]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleProcess = async () => {
    if (!jobId) return;
    setStatus("processing");
    setErrorMsg(null);
    addLog("Starting processing pipeline...");
    
    try {
      const resp = await fetch(`/api/jobs/${jobId}/process`, {
        method: "POST",
      });
      
      const data = await resp.json();
      
      if (!resp.ok) {
        throw new Error(data.error || data.details || "Processing failed");
      }
      
      setDownloadUrl(data.downloadUrl);
      setStatus("completed");
      addLog("Processing complete! Ready to download.");
      
        } catch (err: unknown) {
      console.error(err);
      setStatus("error");
            const message = err instanceof Error ? err.message : "Processing failed";
            setErrorMsg(message);
            addLog(`Error: ${message}`);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, "_blank");
      addLog("Download started.");
      // Optional: Trigger cleanup after a delay or ask user?
      // User said: "after the downloading the zip. the minio storage will automatically empty"
      // We can call cleanup after a short delay
      setTimeout(() => {
        handleCleanup();
      }, 5000); 
    }
  };

  const handleCleanup = async () => {
    if (!jobId) return;
    addLog("Cleaning up files...");
    try {
        // We need a cleanup API. 
        // For now, we'll just reset the UI and generate a new ID, 
        // assuming a background cron or manual trigger handles actual MinIO deletion 
        // OR we implement DELETE /api/jobs/[jobId]
        
        // Let's implement DELETE call
        await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
        
        addLog("Cleanup successful.");
        // Reset
        setJobId(uuidv4());
        setStatus("idle");
        setDownloadUrl(null);
        setLogs([]);
        TUS_CLIENT_CONFIG.destinationPath = `jobs/${uuidv4()}/raw/`; // Update config for new job
        window.location.reload(); // Simplest way to clear TUS state
    } catch (err) {
        console.error("Cleanup failed", err);
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">One-Click Pipeline</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Upload & Controls */}
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>1. Upload Files</CardTitle>
                        <CardDescription>
                            Upload your PDF files. They will be automatically queued for processing.
                            Job ID: <code className="bg-muted px-1 rounded">{jobId}</code>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TusFileUpload jobId={jobId} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>2. Process</CardTitle>
                        <CardDescription>
                            Trigger Redaction (V2) and Humanization.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button 
                            onClick={handleProcess} 
                            disabled={status === "processing" || status === "completed"}
                            className="w-full text-lg py-6"
                        >
                            {status === "processing" ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Processing...
                                </>
                            ) : status === "completed" ? (
                                <>
                                    <CheckCircle className="mr-2 h-5 w-5" />
                                    Completed
                                </>
                            ) : (
                                <>
                                    Start Processing <ArrowRight className="ml-2 h-5 w-5" />
                                </>
                            )}
                        </Button>
                        
                        {errorMsg && (
                            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                                {errorMsg}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Right: Results & Logs */}
            <div className="space-y-6">
                 {status === "completed" && (
                    <Card className="bg-green-50 border-green-200">
                        <CardHeader>
                            <CardTitle className="text-green-800">3. Download Results</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-green-700">
                                Your files have been redacted, humanized, and zipped.
                            </p>
                            <Button 
                                onClick={handleDownload}
                                className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6"
                            >
                                <Download className="mr-2 h-5 w-5" />
                                Download ZIP & Cleanup
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <Card className="h-full max-h-[600px] flex flex-col">
                    <CardHeader>
                        <CardTitle>Activity Log</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto font-mono text-sm">
                        {logs.length === 0 ? (
                            <p className="text-muted-foreground italic">No activity yet.</p>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="mb-1 border-b border-muted pb-1 last:border-0">
                                    {log}
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
      </main>
    </div>
  );
}
