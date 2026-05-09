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

const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.add(t);
  } catch(e) {}
  window.toggleTheme = function() {
    var root = document.documentElement;
    var isDark = root.classList.contains('dark');
    root.classList.remove('light', 'dark');
    root.classList.add(isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  };
})();
`;

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
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="flex min-h-dvh flex-col bg-noise">{children}</body>
    </html>
  );
}
