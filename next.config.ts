import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["shiki", "mermaid"],
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3001", "localhost:3000"] },
  },
};

export default nextConfig;
