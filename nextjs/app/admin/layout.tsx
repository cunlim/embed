import { cookies } from "next/headers";
import { AdminLayoutClient } from "./admin-layout-client";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialSidebarCollapsed =
    cookieStore.get("admin-sidebar")?.value === "collapsed";

  return (
    <AdminLayoutClient initialSidebarCollapsed={initialSidebarCollapsed}>
      {children}
    </AdminLayoutClient>
  );
}
