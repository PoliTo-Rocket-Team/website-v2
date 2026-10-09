"use server";

import { revalidatePath } from "next/cache";
import { canReach, type DashboardPageKey } from "@/lib/dashboard/access";
import type { TeamWrites } from "@/lib/dashboard/data";
import { openDashboard } from "@/lib/dashboard/open";
import type { EditableRole } from "@/lib/dashboard/team";

// The Team pages' writes (issue #143). Each goes through the dashboard data
// interface, so a test developer's change lands in their cookie and nowhere
// else; a source that stores none answers false.

export type TeamActionResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

const REFUSED: TeamActionResult = { ok: false, error: "This change could not be saved." };

async function writesOn(page: DashboardPageKey): Promise<TeamWrites | null> {
  const opening = await openDashboard();
  if (opening.kind !== "open" || !canReach(opening.data.viewer.kind, page)) return null;
  return opening.data.teamWrites;
}

function isId(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function done(ok: boolean): TeamActionResult {
  if (!ok) return REFUSED;
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function setShownOnSite(alumnusId: number, shown: boolean): Promise<TeamActionResult> {
  const writes = await writesOn("alumni");
  if (!writes || !isId(alumnusId) || typeof shown !== "boolean") return REFUSED;
  return done(await writes.setShownOnSite(alumnusId, shown));
}

export async function saveMember(
  personId: number,
  role: EditableRole | null,
  pageTitle: string | null,
): Promise<TeamActionResult> {
  const writes = await writesOn("members");
  if (!writes || !isId(personId) || (role !== null && role !== "division-lead" && role !== "member")) return REFUSED;
  if (pageTitle !== null && typeof pageTitle !== "string") return REFUSED;
  return done(await writes.saveMember(personId, { role, pageTitle }));
}

export async function moveToAlumni(personId: number): Promise<TeamActionResult> {
  const writes = await writesOn("members");
  if (!writes || !isId(personId)) return REFUSED;
  return done(await writes.moveToAlumni(personId));
}
