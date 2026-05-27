import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "iixpsfsqyfnllggvsvfl.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Phase 4 — Génération PDF via Puppeteer serverless.
  // @sparticuz/chromium + puppeteer-core ne doivent PAS être bundlés par
  // Webpack (ils contiennent le binaire Chromium ~55 MB et des paths fs natifs).
  // Next 16 : la clé moderne est `serverExternalPackages` (ex-experimental).
  serverExternalPackages: [
    "@sparticuz/chromium",
    "puppeteer-core",
  ],
};

export default nextConfig;