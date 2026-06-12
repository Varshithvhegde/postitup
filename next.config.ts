import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.ko-fi.com" },
    ],
  },
  async headers() {
    return [
      {
        // Allow the /embed route to be iframed from anywhere
        source: "/embed/:path*",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        // embed.js script must be serveable cross-origin
        source: "/embed.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Content-Type", value: "application/javascript" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "varshith-v-hegde",
  project: "postitup",

  // Only upload source maps in CI/production to keep local builds fast
  silent: !process.env.CI,

  // Disable source map upload if SENTRY_AUTH_TOKEN is not set (local dev)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  // Tree-shake Sentry logger statements from client bundle
  disableLogger: true,

  // Automatically instrument Next.js server components
  autoInstrumentServerFunctions: true,
});
