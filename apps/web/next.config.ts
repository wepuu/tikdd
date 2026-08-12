import type { NextConfig } from "next";

const allowedDevOrigins = process.env.TIKDD_ALLOWED_DEV_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  distDir: process.env.WEB_NEXT_DIST_DIR ?? (process.env.NODE_ENV === "development" ? ".next-web-dev" : ".next-web-production"),
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@tikdd/admin-contracts", "@tikdd/contracts", "@tikdd/platform"]
};

export default nextConfig;
