import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL must be set for production builds");
}

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
};

export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(nextConfig);
