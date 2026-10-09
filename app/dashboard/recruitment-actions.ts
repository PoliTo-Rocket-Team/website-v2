"use server";

import { refresh } from "next/cache";
import { DashboardRefused, type DashboardData } from "@/lib/dashboard/data";
import { openDashboard } from "@/lib/dashboard/open";
import { isApplicationStage, type ApplicationStage } from "@/lib/dashboard/recruitment";

// The writes of the Positions and Applications pages (issue #142). Each goes
// through the dashboard data interface, which decides what the viewer may
// change: a test developer's write changes only a cookie, an account's the
// database. The browser's arguments are checked here, never trusted.

export type WriteResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

async function write(run: (data: DashboardData) => Promise<void>): Promise<WriteResult> {
  const opening = await openDashboard();
  if (opening.kind !== "open") return { ok: false, message: "Your session has ended. Sign in again." };
  try {
    await run(opening.data);
  } catch (error) {
    if (error instanceof DashboardRefused) return { ok: false, message: "You cannot change this." };
    throw error;
  }
  refresh();
  return { ok: true };
}

const isId = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;

export async function setPositionOpen(positionId: number, open: boolean): Promise<WriteResult> {
  if (!isId(positionId) || typeof open !== "boolean") return { ok: false, message: "That change is not valid." };
  return write((data) => data.setPositionOpen(positionId, open));
}

export async function setApplicationStage(applicationId: number, stage: ApplicationStage): Promise<WriteResult> {
  if (!isId(applicationId) || !isApplicationStage(stage)) return { ok: false, message: "That change is not valid." };
  return write((data) => data.setApplicationStage(applicationId, stage));
}

/** The site-wide switch is #121's: its own write answers a refusal rather than throwing one. */
export async function setRecruitment(open: boolean): Promise<WriteResult> {
  if (typeof open !== "boolean") return { ok: false, message: "That change is not valid." };
  return write(async (data) => {
    const result = await data.setRecruitment({ isOpen: open });
    if (result.status === "refused") throw new DashboardRefused("the recruitment switch");
  });
}
