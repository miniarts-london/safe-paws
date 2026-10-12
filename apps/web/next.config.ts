import type { NextConfig } from "next";

// Settings come from one .env.local at the repo root, shared with the board server:
// `npm run dev` / `start` load it before Next starts (see scripts/next.mjs).

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source; let Next compile it.
  transpilePackages: ["@safe-paws/shared", "@safe-paws/db"],
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
