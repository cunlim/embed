"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, getToken } from "@/hooks/useAuth";
import { isSuperAdmin } from "@/lib/utils";

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
  const admin = isSuperAdmin(user);

  return (
    <div className="flex min-w-0 items-center gap-1">
      {user && (
        <span className="hidden text-sm font-medium text-foreground sm:inline">
          {user.name}
        </span>
      )}

      {admin && (
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-7 w-7 justify-center rounded-full px-0 sm:h-8 sm:w-auto sm:px-3"
        >
          <Link href="/admin" aria-label="관리자">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline ml-0.5">관리자</span>
          </Link>
        </Button>
      )}

      {hasToken ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 justify-center rounded-full px-0 sm:h-8 sm:w-auto sm:px-3"
          aria-label="로그아웃"
          onClick={async () => {
            await logout();
            router.push("/");
          }}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline ml-0.5">로그아웃</span>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-7 w-7 justify-center rounded-full px-0 sm:h-8 sm:w-auto sm:px-3"
        >
          <Link href="/login" aria-label="로그인">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline ml-0.5">로그인</span>
          </Link>
        </Button>
      )}
    </div>
  );
}
