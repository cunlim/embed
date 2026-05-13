"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

interface SiteHeaderProps {
  badge?: string;
  children?: React.ReactNode;
}

export function SiteHeader({ badge, children }: SiteHeaderProps) {
  return (
    <header className="relative z-10 flex items-center justify-between px-6 py-4 sm:px-8">
      <Link
        href="/"
        className="flex items-center gap-2 rounded-md transition-opacity hover:opacity-80"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
          CL
        </div>
        <span className="font-mono text-sm font-medium text-foreground">
          CL Embed
        </span>
        {badge && (
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {badge}
          </span>
        )}
      </Link>
      <div className="flex items-center gap-2">
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
