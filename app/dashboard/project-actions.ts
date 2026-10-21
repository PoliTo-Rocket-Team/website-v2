"use server";

import { revalidatePath } from "next/cache";
import { editorVersion, isPublishStep, type ContentItem, type PublishStep } from "@/lib/content/versioned";
import { uploadOf } from "@/lib/dashboard/form-upload";
import { openDashboard } from "@/lib/dashboard/open";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import type { PhotoSrc } from "@/lib/outreach-types";
import { readProjectFields } from "@/lib/project-content/fields";
import { readNewProject } from "@/lib/project-content/new-project";
import type { ProjectRecord } from "@/lib/project-content/record";

// The project editor's writes (boards 75 and 75c, issues #297 and #298). Each opens the
// dashboard as the page did; the projects editor checks the site-content gate
// and the fields again, and writes to the database or, for a test developer,
// to their cookie. The database write refreshes the cached public read; every
// page that shows a project renders again.

/** The pages a project shows on: its own page and /projects (both under the /projects layout), and Home. */
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

/**
 * New project on the Projects page (issue #301): a draft project with the
 * name, address and kind given, answered with the address its editor opens
 * at. A draft shows on no public page, so none is refreshed.
 */
export async function createProject(input: unknown): Promise<WriteResult<{ slug: string }>> {
  const project = readNewProject(input);
  if (project === null) return refused("Reload the page and try again.");
  const opening = await openDashboard();
  if (opening.kind !== "open") return refused("Sign in again to make changes.");
  const result = await opening.data.projects.create(project);
  return result.ok ? written({ slug: editorVersion(result.value.version).slug }) : result;
}

/**
 * A launch or gallery photo picked in the Edit <project> panel (issue #299),
 * stored at once, through the same path as Outreach's, so the page can show
 * it; a save puts it on the project.
 */
export async function uploadProjectPhoto(form: FormData): Promise<WriteResult<PhotoSrc>> {
  const photo = await uploadOf(form, "photo");
  if (photo === null) return refused("Choose a photo.");
  const opening = await openDashboard();
  if (opening.kind !== "open") return refused("Sign in again to make changes.");
  return opening.data.projects.uploadPhoto(photo);
}

/** A photo removed before a save used it: its file goes, unless a project version shows it. */
export async function discardProjectPhoto(src: string): Promise<WriteResult<null>> {
  const opening = await openDashboard();
  if (opening.kind !== "open") return refused("Sign in again to make changes.");
  return opening.data.projects.discardPhoto(String(src ?? ""));
}
