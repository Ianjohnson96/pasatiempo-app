import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The merchandise program page is assembled at request time from these files.
  outputFileTracingIncludes: {
    "/merch": ["./merchandise/app/src/**/*", "./merchandise/app/host/**/*"],
  },
};

export default nextConfig;
