import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/api";
import { MyPageContent } from "./page-content";

export default async function MyPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/login?redirect=/mypage");
  }

  let user;
  try {
    user = await getUser(token);
  } catch {
    redirect("/login?redirect=/mypage");
  }

  return <MyPageContent serverUser={user} />;
}
