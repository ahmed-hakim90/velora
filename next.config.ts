import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js development logs include Server Function arguments by default.
  // Those arguments can contain credentials (for example, a cashier PIN), so
  // keep request timings while never printing Server Function payloads.
  logging: {
    serverFunctions: false,
  },
  // Keep Arabic OG TTF available to ImageResponse serverless functions.
  outputFileTracingIncludes: {
    "/menu/[slug]/opengraph-image": [
      "./public/fonts/**/*.ttf",
      "./public/og/heroes/**/*",
    ],
    "/opengraph-image": ["./public/fonts/NotoSansArabic-Regular.ttf"],
  },
};

export default nextConfig;
