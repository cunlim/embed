import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/api";
import { AdminPageContent } from "./page-content";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/login?redirect=/admin");
  }

  let user;
  try {
    user = await getUser(token);
  } catch {
    redirect("/login?redirect=/admin");
  }

  if (user.role !== "superadmin") {
    redirect("/embed");
  }

  return <AdminPageContent serverUser={user} />;
}
