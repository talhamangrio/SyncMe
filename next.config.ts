import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `output: "standalone"` is only used by the self-hosted sandbox runtime
  // (.zscripts build/start pipeline). On Vercel it must NOT be set: Vercel
  // manages its own serverless build output, and a standalone folder breaks
  // its function packaging (500 FUNCTION_INVOCATION_FAILED / missing routes).
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
