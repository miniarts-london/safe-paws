import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// One .env.local at the repo root, shared with the board server.
loadEnvConfig(path.resolve(__dirname, "../.."));

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source; let Next compile it.
  transpilePackages: ["@safe-paws/shared", "@safe-paws/db"],
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
