"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-sm bg-background/80 border-b border-border">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
        <div className="font-semibold text-base tracking-tight">cl_embed</div>
        <button
          onClick={toggleTheme}
          className="rounded-md p-2 hover:bg-accent/10 transition-colors"
          aria-label="테마 토글"
        >
          {mounted && theme === "dark" ? (
            <Sun className="h-4 w-4 text-muted" />
          ) : (
            <Moon className="h-4 w-4 text-muted" />
          )}
        </button>
      </div>
    </header>
  );
}
