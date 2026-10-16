"use server";

import { revalidatePath } from "next/cache";
import { canReach } from "@/lib/dashboard/access";
import type { DashboardData } from "@/lib/dashboard/data";
import { openDashboard } from "@/lib/dashboard/open";
import { refused, type WriteResult } from "@/lib/dashboard/write";
import { isPublishStep, type PublishStep } from "@/lib/content/versioned";
import type { SummitVersions } from "@/lib/outreach-editor";
import { checkSummitFields, parseSummitFields } from "@/lib/outreach-summit-fields";
import type { PostItem } from "@/lib/outreach-types";

// The Outreach list's writes (board 74, issue #289). Each opens the dashboard
// as the page did and checks the viewer reaches the Outreach page; the
// outreach editor then checks the site-content gate again and writes, to the
// database or, for a test developer, to their cookie. The database write
// refreshes the cached public read; /outreach and its post pages render again.

async function onOutreach<T>(run: (data: DashboardData) => Promise<WriteResult<T>>): Promise<WriteResult<T>> {
  const opening = await openDashboard();
  if (opening.kind !== "open") return refused("Sign in again to make changes.");
  if (!canReach(opening.data.viewer, "outreach")) return refused("You do not have this page.");
  const result = await run(opening.data);
  if (result.ok) revalidatePath("/outreach", "layout");
  return result;
}

/** Unpublish: the post leaves /outreach and stays in the list as a draft. */
export async function unpublishOutreachPost(postId: number): Promise<WriteResult<PostItem>> {
  if (!Number.isSafeInteger(postId)) return refused("Unknown post.");
  return onOutreach((data) => data.outreach.posts.unpublish(postId));
}

/** Delete: the post and its draft go from the list and the site. */
export async function deleteOutreachPost(postId: number): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(postId)) return refused("Unknown post.");
  return onOutreach((data) => data.outreach.posts.remove(postId));
}

/** Save draft or Publish on the featured summit. */
export async function saveOutreachSummit(step: PublishStep, input: unknown): Promise<WriteResult<SummitVersions>> {
  if (!isPublishStep(step)) return refused("Save a draft or publish.");
  const fields = parseSummitFields(input);
  if (fields === null) return refused("Fill in the summit's fields.");
  return onOutreach((data) => data.outreach.saveSummit(step, async (current) => checkSummitFields(fields, current)));
}
