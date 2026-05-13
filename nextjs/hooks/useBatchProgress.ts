"use client";

import { useState, useEffect, useCallback } from "react";
import { useEcho } from "@/hooks/useEcho";

export interface BatchProgress {
  batchId: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  status: "processing" | "completed" | "failed";
}

export function useBatchProgress(batchId: string | null): BatchProgress | null {
  const echo = useEcho();
  const [progress, setProgress] = useState<BatchProgress | null>(null);

  const handleProgress = useCallback((e: BatchProgress) => {
    setProgress(e);
  }, []);

  useEffect(() => {
    if (!echo || !batchId) return;

    const channel = echo.channel(`translation.${batchId}`);
    channel.listen(".translation.progress", handleProgress);

    return () => {
      channel.stopListening(".translation.progress");
      echo.leaveChannel(`translation.${batchId}`);
    };
  }, [echo, batchId, handleProgress]);

  return progress;
}
