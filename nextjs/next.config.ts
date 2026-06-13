import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["embed.cunlim.dev", "localhost:3000"],
  async headers() {
    return [
      // 정적 자산: 해시 파일명 → immutable (폰트 FOUT 방지)
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // HTML 페이지: no-cache → 브라우저가 매번 서버에 재검증
      // cookie 기반 UI 상태(사이드바 접힘 등)가 F5로도 즉시 반영되도록 함
      // 첫 번째 매칭이 우선 적용되므로 /_next/static 은 이 규칙의 영향을 받지 않음
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
