import type { Metadata } from "next";
import { Outfit, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CL Embed | AI 카테고리 추천 시스템",
  description:
    "AI 기반 다국어 카테고리 추천 시스템 — 사용자 텍스트를 분석해 최적의 카테고리를 추천합니다.",
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
      className={`${outfit.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var e=localStorage.getItem('theme');e||(e=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'),document.documentElement.classList.toggle('dark','dark'===e)}catch(e){}})();",
          }}
        />
      </head>
      <body className="flex min-h-dvh flex-col bg-noise">
        {children}
      </body>
    </html>
  );
}
