import type { NextConfig } from "next";

const allowedDevOrigins = process.env.TIKDD_ALLOWED_DEV_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@tikdd/contracts", "@tikdd/platform"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/en",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
