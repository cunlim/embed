"use client";

import { Suspense, useEffect, useSyncExternalStore } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SocialLogin } from "@/components/social-login";
import { useSearchParams, useRouter } from "next/navigation";
import { getToken, setToken } from "@/hooks/useAuth";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const redirectTo = searchParams.get("redirect") || "/embed";
  const token = searchParams.get("token");

  useEffect(() => {
    if (!mounted) return;

    if (token) {
      setToken(token);
      router.replace(redirectTo);
      return;
    }

    if (getToken()) {
      if (window.history.length > 1) {
        router.back();
      } else {
        router.replace("/");
      }
    }
  }, [mounted, token, redirectTo, router]);

  if (!mounted || token || getToken()) {
    return null;
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8">
            <div className="mb-8 text-center">
              <h1 className="text-xl font-bold tracking-tight">
                CL Embed
              </h1>
            </div>

            <SocialLogin />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
