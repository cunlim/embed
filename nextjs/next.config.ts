import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["embed.cunlim.dev", "localhost:3000"],
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
