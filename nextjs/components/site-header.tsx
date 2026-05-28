"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

interface SiteHeaderProps {
  badge?: string;
  children?: React.ReactNode;
  leftChildren?: React.ReactNode;
}

export function SiteHeader({ badge, children, leftChildren }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 sm:px-8 bg-background border-b border-border">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 whitespace-nowrap rounded-md transition-opacity hover:opacity-80"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold font-mono text-accent-foreground">
            CL
          </div>
          <span className="whitespace-nowrap font-bold tracking-tight text-sm text-foreground">
            CL Embed
          </span>
          {badge && (
            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {badge}
            </span>
          )}
        </Link>
        {leftChildren && (
          <div className="hidden sm:block mx-1 h-5 w-px bg-border" />
        )}
        {leftChildren}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
