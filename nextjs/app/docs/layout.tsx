import { cookies } from "next/headers";
import { DocsLayoutClient } from "./docs-layout-client";

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialSidebarCollapsed =
    cookieStore.get("docs-sidebar")?.value === "collapsed";

  return (
    <DocsLayoutClient initialSidebarCollapsed={initialSidebarCollapsed}>
      {children}
    </DocsLayoutClient>
  );
}
