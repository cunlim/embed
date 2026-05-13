"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AuthButtons } from "@/components/auth-buttons";

export function AppHeader() {
  const pathname = usePathname();
  const badge = pathname === "/admin" ? "admin" : undefined;

  return (
    <SiteHeader badge={badge}>
      <AuthButtons />
    </SiteHeader>
  );
}
