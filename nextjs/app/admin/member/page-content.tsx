"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getToken } from "@/hooks/useAuth";
import type { User } from "@/lib/api";
import { UserManagement } from "@/components/admin/user-management";

export function AdminMemberContent({ serverUser }: { serverUser: User | null }) {
  const { user, isLoading: authLoading } = useAuth(serverUser);
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const fullPath = window.location.pathname + window.location.search + window.location.hash;
      router.replace(`/login?redirect=${encodeURIComponent(fullPath)}`);
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  const token = getToken();

  return <UserManagement token={token} />;
}
