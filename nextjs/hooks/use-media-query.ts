"use client";

import { useSyncExternalStore } from "react";

/**
 * 클라이언트에서만 미디어 쿼리 결과를 반환하는 훅.
 * 서버에서는 항상 false를 반환합니다.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
