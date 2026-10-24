import "server-only";

import { isDatabaseConfigured } from "@/db/client";
import { cachedPublishedOutreach } from "@/lib/dashboard/database-outreach";
import { publicOutreach } from "./outreach-editor";
import { importedOutreach } from "./outreach-import";
import type { OutreachContent } from "./outreach-types";

// What /outreach and its post pages show (issue #287): the published posts,
// the featured ones among them (issue #496), and the tag list. Read from the environment alone, so
// the pages still prerender: the database's cached read, which every outreach
// write refreshes, or the imported record where production has no database
// or no outreach tables yet. Under `next dev` and on previews a run with no
// database stops instead (lib/database-required.ts).

export async function publishedOutreach(): Promise<OutreachContent> {
  const record = () => publicOutreach(importedOutreach());
  if (!isDatabaseConfigured()) return record();
  return (await cachedPublishedOutreach()) ?? record();
}
