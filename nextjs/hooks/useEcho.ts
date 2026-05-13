"use client";

import { useEffect, useState } from "react";
import { createEcho, type ReverbEcho } from "@/lib/echo";

let echoInstance: ReverbEcho | null = null;
let echoPromise: Promise<ReverbEcho> | null = null;

export function useEcho(): ReverbEcho | null {
  const [echo, setEcho] = useState<ReverbEcho | null>(echoInstance);

  useEffect(() => {
    if (echoInstance) return;

    if (!echoPromise) {
      echoPromise = createEcho();
    }

    let cancelled = false;
    echoPromise
      .then((instance) => {
        if (cancelled) return;
        echoInstance = instance;
        setEcho(instance);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("Reverb Echo 연결 실패:", err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return echo;
}
