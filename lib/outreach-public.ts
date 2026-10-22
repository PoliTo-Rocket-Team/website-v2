import "server-only";

import { isDatabaseConfigured } from "@/db/client";
import { cachedPublishedOutreach } from "@/lib/dashboard/database-outreach";
import { dummyDataOn } from "@/lib/dummy-data/mode";
import { publicOutreach } from "./outreach-editor";
import { importedOutreach } from "./outreach-import";
import type { OutreachContent } from "./outreach-types";

// What /outreach and its post pages show (issue #287): the published posts,
// the featured ones among them (issue #496), and the tag list. Read from the environment alone, so
// the pages still prerender: the database's cached read, which every outreach
// write refreshes, or the imported record where there is no database
// (previews, lib/dummy-data/mode.ts) or no outreach tables yet. A test
// developer's changes on a preview stay in their dashboard and never reach
// these pages.

export async function publishedOutreach(): Promise<OutreachContent> {
  const record = () => publicOutreach(importedOutreach());
  if (dummyDataOn() || !isDatabaseConfigured()) return record();
  return (await cachedPublishedOutreach()) ?? record();
}
