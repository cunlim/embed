"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getToken } from "@/hooks/useAuth";
import type { User } from "@/lib/api";
import { UserManagement } from "@/components/admin/user-management";

export function AdminMemberContent({ serverUser }: { serverUser: User }) {
  const { user, isLoading: authLoading } = useAuth(serverUser);
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?redirect=/admin/member");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  const token = getToken();

  return <UserManagement token={token} />;
}
