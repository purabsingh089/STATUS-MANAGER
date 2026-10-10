import type { NextConfig } from "next";

const isExport = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  output: isExport ? "export" : "standalone",
  trailingSlash: isExport,
  images: { unoptimized: isExport },
  allowedDevOrigins: [".monkeycode-ai.live"],
  async rewrites() {
    if (isExport) return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3001/api/:path*",
      },
    ];
  },
};

export default nextConfig;
