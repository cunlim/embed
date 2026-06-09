import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/api";
import { AdminPageContent } from "./page-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "시스템 설정",
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  // 토큰이 없으면 클라이언트에서 전체 URL(쿼리+해시) 포함하여 리다이렉트
  if (!token) {
    return <AdminPageContent serverUser={null} />;
  }

  let user;
  try {
    user = await getUser(token);
  } catch {
    // 토큰이 만료되면 클라이언트에서 리다이렉트
    return <AdminPageContent serverUser={null} />;
  }

  if (user.role !== "superadmin") {
    redirect("/embed");
  }

  return <AdminPageContent serverUser={user} />;
}
