"use client";

import { useEffect, useState } from "react";
import { FileList } from "@/components/converter/FileList";
import { MinIOFile } from "@/lib/converter/types/converter-types";

interface JobFileListProps {
  jobId: string | null;
}

export default function JobFileList({ jobId }: JobFileListProps) {
  const [files, setFiles] = useState<MinIOFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setFiles([]);
      setSelectedFiles(new Set());
      return;
    }
    setIsLoading(true);
    fetch(`/api/jobs/${jobId}/files`)
      .then((res) => res.json())
      .then((data) => {
        setFiles(data.files || []);
        setSelectedFiles(new Set());
      })
      .catch(() => setFiles([]))
      .finally(() => setIsLoading(false));
  }, [jobId]);

  const handleToggleSelection = (fileKey: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileKey)) {
        next.delete(fileKey);
      } else {
        next.add(fileKey);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedFiles(new Set(files.map((f) => f.key)));
  };

  const handleDeselectAll = () => {
    setSelectedFiles(new Set());
  };

  return (
    <FileList
      files={files}
      selectedFiles={selectedFiles}
      onToggleSelection={handleToggleSelection}
      onSelectAll={handleSelectAll}
      onDeselectAll={handleDeselectAll}
      isLoading={isLoading}
    />
  );
}
