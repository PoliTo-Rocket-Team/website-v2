import "server-only";

import { isDatabaseConfigured } from "@/db/client";
import { publicItems } from "@/lib/content/versioned";
import { cachedPublishedPartners } from "@/lib/dashboard/database-partners";
import type { Partner } from "./partners";
import { importedPartners } from "./partners-import";

// What /partners and the home logo strip show (issue #256): the published
// partners in site order. Read from the environment alone, so both pages
// still prerender: the database's cached read, which every partner write
// refreshes, or the imported record where production has no database or no
// partners table yet. Under `next dev` and on previews a run with no
// database stops instead (lib/database-required.ts).

export async function publishedPartners(): Promise<readonly Partner[]> {
  const record = () => publicItems(importedPartners());
  if (!isDatabaseConfigured()) return record();
  return (await cachedPublishedPartners()) ?? record();
}
