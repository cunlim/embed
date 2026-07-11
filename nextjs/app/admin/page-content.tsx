"use client";

import { useAuth, getToken } from "@/hooks/useAuth";
import type { User } from "@/lib/api";
import { SettingsPanel } from "@/components/admin/settings-panel";

export function AdminPageContent({ serverUser }: { readonly serverUser: User }) {
  const { user, isLoading: authLoading } = useAuth(serverUser);

  if (authLoading || !user) return null;

  const token = getToken();

  return <SettingsPanel token={token} />;
}
