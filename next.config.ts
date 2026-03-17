import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [process.env.REPLIT_DEV_DOMAIN ?? ""].filter(Boolean),
};

export default nextConfig;
