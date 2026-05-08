"use client";

import { useEffect } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const theme =
      stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, []);

  return <>{children}</>;
}
