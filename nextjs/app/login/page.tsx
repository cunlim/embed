"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  LogIn,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";

const loginSchema = z.object({
  email: z.string().email("유효한 이메일을 입력하세요"),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다"),
});

const registerSchema = z
  .object({
    name: z.string().min(2, "이름을 입력하세요"),
    email: z.string().email("유효한 이메일을 입력하세요"),
    password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다"),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["passwordConfirmation"],
  });

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

const oauthProviders = [
  {
    provider: "google" as const,
    label: "Google로 계속하기",
    // biome-ignore lint/a11y/noSvgWithoutTitle: Google icon
    icon: ({ className }: { className?: string }) => (
      <svg
        className={className}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    ),
  },
  {
    provider: "github" as const,
    label: "GitHub로 계속하기",
    // biome-ignore lint/a11y/noSvgWithoutTitle: GitHub icon
    icon: ({ className }: { className?: string }) => (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  {
    provider: "naver" as const,
    label: "Naver로 계속하기",
    // biome-ignore lint/a11y/noSvgWithoutTitle: Naver icon
    icon: ({ className }: { className?: string }) => (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" />
      </svg>
    ),
  },
];

function LoginForm() {
  const { login, register, loginWithOAuth, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState("login");
  const [error, setError] = useState<string | null>(null);

  const redirectTo = searchParams.get("redirect") || "/embed";

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      passwordConfirmation: "",
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    setError(null);
    try {
      await login(data.email, data.password);
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다");
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    setError(null);
    try {
      await register(
        data.name,
        data.email,
        data.password,
        data.passwordConfirmation
      );
      router.push(redirectTo);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "회원가입에 실패했습니다"
      );
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-grid" />
      <div className="glow-orb -top-40 -right-40 h-96 w-96 bg-blue-500/15 dark:bg-blue-500/10" />
      <div className="glow-orb -bottom-40 -left-40 h-96 w-96 bg-purple-500/15 dark:bg-purple-500/10" />

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 sm:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            CL
          </div>
          <span className="font-mono text-sm font-medium text-foreground">
            CL Embed
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              CL Embed에 오신 것을 환영합니다
            </CardTitle>
            <CardDescription>
              로그인하여 모든 기능을 이용하세요
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Error */}
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-destructive" role="alert">
                  {error}
                </p>
              </div>
            )}

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">
                  로그인
                </TabsTrigger>
                <TabsTrigger value="register" className="flex-1">
                  회원가입
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4 space-y-4">
                <form
                  onSubmit={loginForm.handleSubmit(handleLogin)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="email">이메일</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      {...loginForm.register("email")}
                    />
                    {loginForm.formState.errors.email && (
                      <p
                        className="text-sm text-destructive"
                        role="alert"
                      >
                        {loginForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">비밀번호</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      {...loginForm.register("password")}
                    />
                    {loginForm.formState.errors.password && (
                      <p
                        className="text-sm text-destructive"
                        role="alert"
                      >
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LogIn className="mr-2 h-4 w-4" />
                    )}
                    로그인
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-4 space-y-4">
                <form
                  onSubmit={registerForm.handleSubmit(handleRegister)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">이름</Label>
                    <Input
                      id="reg-name"
                      placeholder="홍길동"
                      {...registerForm.register("name")}
                    />
                    {registerForm.formState.errors.name && (
                      <p
                        className="text-sm text-destructive"
                        role="alert"
                      >
                        {registerForm.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-email">이메일</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="name@example.com"
                      {...registerForm.register("email")}
                    />
                    {registerForm.formState.errors.email && (
                      <p
                        className="text-sm text-destructive"
                        role="alert"
                      >
                        {registerForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password">비밀번호</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="••••••••"
                      {...registerForm.register("password")}
                    />
                    {registerForm.formState.errors.password && (
                      <p
                        className="text-sm text-destructive"
                        role="alert"
                      >
                        {registerForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password-confirm">
                      비밀번호 확인
                    </Label>
                    <Input
                      id="reg-password-confirm"
                      type="password"
                      placeholder="••••••••"
                      {...registerForm.register("passwordConfirmation")}
                    />
                    {registerForm.formState.errors.passwordConfirmation && (
                      <p
                        className="text-sm text-destructive"
                        role="alert"
                      >
                        {
                          registerForm.formState.errors.passwordConfirmation
                            .message
                        }
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    회원가입
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* OAuth section */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    또는
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {oauthProviders.map(({ provider, label, icon: Icon }) => (
                  <Button
                    key={provider}
                    variant="outline"
                    className="w-full"
                    disabled={isLoading}
                    onClick={() => loginWithOAuth(provider)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
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
