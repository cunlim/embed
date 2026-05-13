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
    echoPromise.then((instance) => {
      if (cancelled) return;
      echoInstance = instance;
      setEcho(instance);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return echo;
}
