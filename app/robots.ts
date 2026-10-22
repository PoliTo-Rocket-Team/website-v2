import type { MetadataRoute } from "next";
import { robotsTxt, siteIndexable } from "@/lib/site-indexing";

// /robots.txt: disallows every path until SITE_INDEXABLE is "true" (issue #549).
export default function robots(): MetadataRoute.Robots {
  return robotsTxt(siteIndexable());
}
