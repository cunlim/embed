import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/api";
import { AdminMemberContent } from "./page-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회원 관리",
};

type AdminMemberPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AdminMemberPage({ searchParams }: AdminMemberPageProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  // 쿼리 파라미터를 포함한 redirect 경로 생성
  const sp = await searchParams;
  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]
  ).toString();
  const redirectPath = qs ? `/admin/member?${qs}` : "/admin/member";

  // 미인증 사용자는 서버에서 즉시 리다이렉트 (header/nav 플래시 방지)
  if (!token) {
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  let user;
  try {
    user = await getUser(token);
  } catch {
    // 토큰이 만료된 경우에도 서버에서 즉시 리다이렉트
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  if (user.role !== "superadmin") {
    redirect("/embed");
  }

  return <AdminMemberContent serverUser={user} />;
}
