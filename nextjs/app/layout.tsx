import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CL Embed | AI Category Engine",
  description:
    "AI 기반 다국어 카테고리 추천 시스템. 검색어를 분석해 네이버 카테고리 체계로 매핑합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${instrumentSans.variable} ${jetbrainsMono.variable} dark h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col noise-overlay">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('cl-embed-theme') || 'dark';
                  document.documentElement.classList.remove('light', 'dark');
                  document.documentElement.classList.add(theme);
                } catch(e) {}
              })();
            `,
          }}
        />
        <ThemeProvider defaultTheme="dark" storageKey="cl-embed-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
