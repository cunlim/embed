"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, getToken } from "@/hooks/useAuth";

export function AuthButtons() {
  const { logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const hasToken = !!getToken();

  if (hasToken) {
    return (
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
    );
  }

  return (
    <Button variant="ghost" size="sm" asChild className="rounded-full">
      <Link href="/login">
        <LogIn className="mr-1.5 h-4 w-4" />
        로그인
      </Link>
    </Button>
  );
}
