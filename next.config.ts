import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.0.0.228"],
  // Keep Prisma and pg out of the Next.js bundle — they need native Node.js require()
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "bcryptjs",
    "jsonwebtoken",
  ],
};

export default nextConfig;
