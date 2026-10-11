"use server";

import { revalidatePath } from "next/cache";
import { canReach, type DashboardPageKey } from "@/lib/dashboard/access";
import type { TeamWrites } from "@/lib/dashboard/data";
import { openDashboard } from "@/lib/dashboard/open";
import { checkDeparture, isPromoteMode, type EditableRole, type PromoteMode } from "@/lib/dashboard/team";

// The Team pages' writes (issues #143 and #172). Each goes through the dashboard data
// interface, so a test developer's change lands in their cookie and nowhere
// else; a source that stores none answers false.

export type TeamActionResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

const REFUSED: TeamActionResult = { ok: false, error: "This change could not be saved." };

async function writesOn(page: DashboardPageKey): Promise<TeamWrites | null> {
  const opening = await openDashboard();
  if (opening.kind !== "open" || !canReach(opening.data.viewer, page)) return null;
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

export async function promote(personId: number, mode: PromoteMode): Promise<TeamActionResult> {
  const writes = await writesOn("members");
  if (!writes || !isId(personId) || !isPromoteMode(mode)) return REFUSED;
  return done(await writes.promote(personId, mode));
}

/** Board 59d: the years as typed ("2024 – 2026") and the reason, or none. */
export async function moveToAlumni(personId: number, years: string, reason: string | null): Promise<TeamActionResult> {
  const writes = await writesOn("members");
  if (!writes || !isId(personId) || typeof years !== "string") return REFUSED;
  const departure = checkDeparture({ years, reason: typeof reason === "string" ? reason : null }, new Date().getUTCFullYear());
  if (!departure.ok) return { ok: false, error: departure.error };
  return done(await writes.moveToAlumni(personId, departure.value));
}

export async function confirmJoin(applicationId: number): Promise<TeamActionResult> {
  const writes = await writesOn("members");
  if (!writes || !isId(applicationId)) return REFUSED;
  return done(await writes.confirmJoin(applicationId));
}
