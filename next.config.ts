import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents/partialPrefetching stay OFF: on Cloudflare Workers they made
  // requests hang (Next.js warns its timers don't behave as expected in the
  // Workers runtime), and the OpenNext adapter doesn't support them yet.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The camera is needed from M1 (in-app photos) and location for
          // local weather in M4; nothing else is.
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

// Gives `next dev` access to Cloudflare bindings (wrangler.jsonc).
import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
