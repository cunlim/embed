import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/sonner";
import { getUser } from "@/lib/api";
import type { User } from "@/lib/api";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    template: "CL Embed | %s",
    default: "CL Embed | AI 카테고리 추천 시스템",
  },
  description:
    "AI 기반 다국어 카테고리 추천 시스템. 한국어/중국어/영어 텍스트를 분석하여 통합 카테고리를 자동 추천합니다.",
  keywords: [
    "AI",
    "카테고리 추천",
    "multilingual",
    "embedding",
    "portfolio",
  ],
  openGraph: {
    title: "CL Embed | AI 카테고리 추천 시스템",
    description:
      "AI 기반 다국어 카테고리 추천 시스템. 한국어/중국어/영어 텍스트를 분석하여 통합 카테고리를 자동 추천합니다.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value ?? null;
  let serverUser: User | null = null;
  if (token) {
    try { serverUser = await getUser(token); } catch {}
  }

  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${dmSans.variable} ${spaceGrotesk.variable} antialiased`}
    >
      <body className="min-h-dvh flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppHeader serverUser={serverUser} />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
