"use client";

import { useAuth, getToken } from "@/hooks/useAuth";
import type { User } from "@/lib/api";
import { UserManagement } from "@/components/admin/user-management";

export function AdminMemberContent({ serverUser }: { readonly serverUser: User }) {
  const { user, isLoading: authLoading } = useAuth(serverUser);

  if (authLoading || !user) return null;

  const token = getToken();

  return <UserManagement token={token} />;
}
