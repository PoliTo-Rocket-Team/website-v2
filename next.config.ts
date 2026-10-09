import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // The application form sends its PDFs through a server action: a CV
    // and a motivation letter, up to 20 MB each (MAX_PDF_BYTES), plus the
    // text fields. The default limit is 1 MB.
    serverActions: { bodySizeLimit: "41mb" },
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
