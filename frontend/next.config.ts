import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.TTI_E2E === "1" ? ".next-e2e" : ".next",
  async rewrites() {
    const backend = process.env.DJANGO_URL ?? "http://127.0.0.1:8000";
    return [
      { source: "/api/v1/:path*/", destination: `${backend}/api/v1/:path*/` },
      { source: "/health/", destination: `${backend}/health/` },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
