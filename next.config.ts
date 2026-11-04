import type { NextConfig } from "next";

/**
 * Remote Grow Solutions runs on its own host (rgs.glazedweb.com until it has a
 * domain of its own). There is no pitch/demo split here: the public pages ARE
 * the product's front door, and everything behind a login is noindexed by its
 * own layout. Any vercel.app preview is still noindex, same as every other
 * Glazed Web build.
 */
const PREVIEW_HOSTS = "([a-z0-9-]+\\.vercel\\.app)";

const nextConfig: NextConfig = {
  // Both drivers load at runtime through dynamic import and neither bundles:
  // pg wants its native-optional friends left alone, and PGlite ships WASM.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  async headers() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: PREVIEW_HOSTS }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
