import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The background automation worker boots from instrumentation.ts in the
  // Node.js runtime. Keep the Prisma client external so it is not bundled.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  experimental: {
    // Server Actions receive post content and media payloads.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default config;
