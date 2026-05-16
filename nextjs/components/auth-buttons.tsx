"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, getToken } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/utils";

export function AuthButtons() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) return null;

  const hasToken = !!getToken();
  const admin = isAdmin(user?.id);

  return (
    <div className="flex items-center gap-1">
      {admin && (
        <Button variant="ghost" size="sm" asChild className="rounded-full">
          <Link href="/admin">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">관리자</span>
          </Link>
        </Button>
      )}

      {hasToken ? (
        <>
          {user && (
            <span className="text-sm font-medium text-foreground ml-1">
              {user.name}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={async () => {
              await logout();
              router.push("/");
            }}
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            로그아웃
          </Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" asChild className="rounded-full">
          <Link href="/login">
            <LogIn className="mr-1.5 h-4 w-4" />
            로그인
          </Link>
        </Button>
      )}
    </div>
  );
}
