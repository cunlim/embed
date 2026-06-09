import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/api";
import { AdminMemberContent } from "./page-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회원 관리",
};

export default async function AdminMemberPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  // 토큰이 없으면 클라이언트에서 전체 URL(쿼리+해시) 포함하여 리다이렉트
  if (!token) {
    return <AdminMemberContent serverUser={null} />;
  }

  let user;
  try {
    user = await getUser(token);
  } catch {
    // 토큰이 만료되면 클라이언트에서 리다이렉트
    return <AdminMemberContent serverUser={null} />;
  }

  if (user.role !== "superadmin") {
    redirect("/embed");
  }

  return <AdminMemberContent serverUser={user} />;
}
