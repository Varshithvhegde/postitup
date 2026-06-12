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

  silent: !process.env.CI,

  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },

  disableLogger: true,
  autoInstrumentServerFunctions: true,
});
