import type { Metadata } from "next";
import { Archivo, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CL Embed | AI 카테고리 추천 시스템",
  description:
    "AI 기반 다국어 카테고리 추천 시스템. 한국어/중국어/영어 텍스트를 분석하여 네이버 카테고리를 자동 추천합니다.",
  keywords: [
    "AI",
    "카테고리 추천",
    "네이버",
    "multilingual",
    "embedding",
    "portfolio",
  ],
  openGraph: {
    title: "CL Embed | AI 카테고리 추천 시스템",
    description:
      "AI 기반 다국어 카테고리 추천 시스템. 한국어/중국어/영어 텍스트를 분석하여 네이버 카테고리를 자동 추천합니다.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${archivo.variable} ${spaceGrotesk.variable} antialiased`}
    >
      <body className="min-h-dvh flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
