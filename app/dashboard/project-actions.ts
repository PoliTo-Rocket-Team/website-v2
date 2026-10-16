"use server";

import { revalidatePath } from "next/cache";
import { isPublishStep, type ContentItem, type PublishStep } from "@/lib/content/versioned";
import { openDashboard } from "@/lib/dashboard/open";
import { refused, type WriteResult } from "@/lib/dashboard/write";
import { readProjectFields } from "@/lib/project-content/fields";
import type { ProjectRecord } from "@/lib/project-content/record";

// The project editor's writes (board 75c, issue #298). Each opens the
// dashboard as the page did; the projects editor checks the site-content gate
// and the fields again, and writes to the database or, for a test developer,
// to their cookie. The database write refreshes the cached public read; every
// page that shows a project renders again.

/** The pages a project shows on: its own page, the other pages' next-project cards, /projects and Home. */
function refreshPublicProjects(): void {
  revalidatePath("/projects", "layout");
  revalidatePath("/");
}

/** Save draft or Publish on a project, with the Edit <project> panel's fields. */
export async function saveProject(projectId: number, step: PublishStep, input: unknown): Promise<WriteResult<ContentItem<ProjectRecord>>> {
  if (!Number.isSafeInteger(projectId)) return refused("Unknown project.");
  if (!isPublishStep(step)) return refused("Save a draft or publish.");
  const fields = readProjectFields(input);
  if (fields === null) return refused("Reload the page and try again.");
  const opening = await openDashboard();
  if (opening.kind !== "open") return refused("Sign in again to make changes.");
  const result = await opening.data.projects.saveFields(projectId, step, fields);
  if (result.ok) refreshPublicProjects();
  return result;
}
