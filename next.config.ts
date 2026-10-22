import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // The application form sends its PDFs through a server action: a CV
    // and a motivation letter, up to 2 MB each (MAX_PDF_BYTES), plus the
    // text fields. Two 2 MB PDFs plus the text fields fit under Vercel's
    // 4.5 MB request body limit, which refuses anything larger before this
    // code runs. The default limit is 1 MB.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  // The share images (issue #454) read their fonts and images from disk.
  // Most are built ahead, but a project or post published later is drawn on
  // its first visit, so the files it may name ship with those functions.
  outputFileTracingIncludes: {
    "/**/opengraph-image*": [
      "./components/share-image/fonts/*.ttf",
      "./design/cavour-render-vert.png",
      "./public/brand/prt-logo-white.svg",
      "./public/design/news/tex-streaks.jpg",
      "./public/design/*/stage-poster.webp",
      "./public/textures/**/*",
      "./public/outreach/**/*",
      "./public/team/team-*.jpg",
      "./public/about/**/*",
    ],
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
