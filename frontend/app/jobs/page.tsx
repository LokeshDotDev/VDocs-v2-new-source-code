"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import TusFileUpload from "@/components/upload/TusFileUpload";
import JobControls from "@/components/jobs/JobControls";
import JobFileList from "@/components/jobs/JobFileList";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function JobsPage() {
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("currentJobId");
    if (saved) setJobId(saved);
  }, []);

  const handleJobCreated = async (id: string) => {
    setJobId(id);
    sessionStorage.setItem("currentJobId", id);
    try {
      const cfg = (await import("@/lib/upload/config/tus-upload-config")).TUS_CLIENT_CONFIG;
      cfg.destinationPath = `jobs/${id}/raw`;
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-4">Job Processing</h1>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8">
            <Card>
              <CardHeader>
                <CardTitle>Upload & Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a job, upload files directly into the job raw folder, then
                  trigger anonymization and humanization.
                </p>

                <JobControls onJobCreated={handleJobCreated} jobId={jobId} />

                <div className="mt-6">
                  <TusFileUpload jobId={jobId} />
                </div>
                <div className="mt-6">
                  {/* Show files for current job */}
                  <JobFileList jobId={jobId} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-4">
            <Card>
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
              </CardHeader>
              <CardContent>
                {jobId ? (
                  <div>
                    <p className="font-medium">Current Job</p>
                    <p className="break-all text-sm mt-2">{jobId}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Files uploaded will be placed at <code>jobs/{`{jobId}`}/raw</code>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No active job.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
