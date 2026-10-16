import "server-only";

import { isDatabaseConfigured } from "@/db/client";
import { publicItems } from "@/lib/content/versioned";
import { cachedPublishedProjects } from "@/lib/dashboard/database-projects";
import { dummyProjectSeed } from "@/lib/dummy-data/projects";
import { dummyDataOn } from "@/lib/dummy-data/mode";
import { importedProjects } from "./import";
import type { ProjectRecord } from "./record";

// What the project pages, the home Projects section and /projects show
// (issue #295): the published projects in site order. Read from the
// environment alone, so every one of those pages still prerenders: the
// database's cached read, which every project write refreshes; the dummy
// seed's published versions on previews (lib/dummy-data/mode.ts), which is
// the import; and the import where there is no database or no projects table
// yet. A draft never reaches any of them.

export async function publishedProjects(): Promise<readonly ProjectRecord[]> {
  if (dummyDataOn()) return publicItems(dummyProjectSeed());
  const imported = () => publicItems(importedProjects());
  if (!isDatabaseConfigured()) return imported();
  return (await cachedPublishedProjects()) ?? imported();
}
