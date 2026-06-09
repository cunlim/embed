import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/api";
import { LoginFormClient } from "./login-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인",
};

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect: redirectTo } = await searchParams;
  const cookieStore = await cookies();

  // 이미 로그인된 사용자는 로그인 페이지에 접근할 필요 없음
  const existingToken = cookieStore.get("auth_token")?.value;
  if (existingToken) {
    try {
      await getUser(existingToken);
      redirect(redirectTo || "/embed");
    } catch {
      // 토큰이 만료되었으면 로그인 폼 표시
    }
  }

  return <LoginFormClient />;
}
