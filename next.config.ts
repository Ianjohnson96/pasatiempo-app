import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The merchandise program page is assembled at request time from these files.
  // Server actions accept 1 MB by default; event logos may be up to 2 MB.
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
  },
  outputFileTracingIncludes: {
    "/merch": ["./merchandise/app/src/**/*", "./merchandise/app/host/**/*"],
  },
};

export default nextConfig;
