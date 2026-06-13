"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { cn } from "@/lib/utils";
import { docList, type DocEntry } from "@/lib/docs";

export { docList } from "@/lib/docs";

export function DocsLayoutClient({
  children,
  initialSidebarCollapsed,
}: {
  children: React.ReactNode;
  initialSidebarCollapsed: boolean;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 gap-8 px-6 py-12 sm:px-8">
        <CollapsibleSidebar title="문서" storageKey="docs-sidebar" initialCollapsed={initialSidebarCollapsed}>
          <Suspense
            fallback={docList.map((doc) => (
              <DocsNavButton key={doc.slug} doc={doc} active={false} />
            ))}
          >
            <DocsNav />
          </Suspense>
        </CollapsibleSidebar>

        <div className="min-w-0 flex-1">{children}</div>
      </main>

      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row sm:px-8">
          <p className="text-xs text-muted-foreground">
            CL Embed. Portfolio Project.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              홈
            </Link>
            <Link
              href="/embed"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              기능시연
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DocsNav() {
  const searchParams = useSearchParams();
  const activeDoc = searchParams.get("doc") || docList[0]?.slug || "";

  return (
    <>
      {docList.map((doc) => (
        <DocsNavButton
          key={doc.slug}
          doc={doc}
          active={activeDoc === doc.slug}
        />
      ))}
    </>
  );
}

function DocsNavButton({ doc, active }: { doc: DocEntry; active: boolean }) {
  return (
    <Link
      href={`/docs?doc=${doc.slug}`}
      className={cn(
        "flex w-full flex-col items-start rounded-md px-3 py-2 text-left transition-colors whitespace-nowrap overflow-hidden",
        active
          ? "bg-accent/20 text-foreground font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
      )}
    >
      <span className="text-sm">{doc.title}</span>
      <span className="text-[11px] text-muted-foreground mt-0.5">
        {doc.description}
      </span>
    </Link>
  );
}
