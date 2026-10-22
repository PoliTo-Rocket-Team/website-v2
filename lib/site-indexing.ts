import type { MetadataRoute } from "next";

// Whether search engines may index the site (issue #549). The new site runs
// on v2.politorocketteam.it before politorocketteam.it moves to it, and until
// then it must stay out of search results. One environment variable decides:
// indexing is on only when SITE_INDEXABLE is exactly "true", so a missing or
// mistyped value keeps the site hidden. The root layout's metadata and
// app/robots.ts both read it here, so the two cannot disagree. A changed value
// takes effect on the next deployment.

/** The environment the switch reads; `process.env` in the app, a plain object in tests. */
export type IndexingEnv = Readonly<Record<string, string | undefined>>;

/** Whether the site may be indexed: only when `SITE_INDEXABLE` is exactly `"true"`. */
export function siteIndexable(env: IndexingEnv = process.env): boolean {
  return env.SITE_INDEXABLE === "true";
}

/** The root `metadata.robots`: every page says noindex, nofollow unless the site is indexable. */
export function rootRobots(indexable: boolean): { index: boolean; follow: boolean } {
  return { index: indexable, follow: indexable };
}

/** What `/robots.txt` serves: every path allowed for every crawler when indexable, every path disallowed otherwise. */
export function robotsTxt(indexable: boolean): MetadataRoute.Robots {
  return {
    rules: indexable
      ? { userAgent: "*", allow: "/" }
      : { userAgent: "*", disallow: "/" },
  };
}
