"use server";

import { refresh } from "next/cache";
import { DashboardRefused, type DashboardData } from "@/lib/dashboard/data";
import { openDashboard } from "@/lib/dashboard/open";
import { parseLeadMove } from "@/lib/dashboard/application-flow";
import type { CreatedPosition } from "@/lib/dashboard/new-position";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";

// The writes of the Positions and Applications pages (issues #142, #171).
// Each goes through the dashboard data interface, which decides what the
// viewer may change and, for an application, whether the move is legal
// (lib/dashboard/application-flow.ts): a test developer's write changes only
// a cookie, an account's the database. The browser's arguments are checked
// here, never trusted.

async function answer<T>(run: (data: DashboardData) => Promise<WriteResult<T>>): Promise<WriteResult<T>> {
  const opening = await openDashboard();
  if (opening.kind !== "open") return refused("Your session has ended. Sign in again.");
  let result: WriteResult<T>;
  try {
    result = await run(opening.data);
  } catch (error) {
    if (error instanceof DashboardRefused) return refused("You cannot change this.");
    throw error;
  }
  if (result.ok) refresh();
  return result;
}

function write(run: (data: DashboardData) => Promise<void>): Promise<WriteResult<null>> {
  return answer(async (data) => {
    await run(data);
    return written(null);
  });
}

const isId = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;

export async function setPositionOpen(positionId: number, open: boolean): Promise<WriteResult<null>> {
  if (!isId(positionId) || typeof open !== "boolean") return refused("That change is not valid.");
  return write((data) => data.setPositionOpen(positionId, open));
}

/** One step on an application: open it, offer interview times, accept, reject, tick the NDA, confirm the join. */
export async function moveApplication(applicationId: number, move: unknown): Promise<WriteResult<null>> {
  const parsed = parseLeadMove(move);
  if (!isId(applicationId) || parsed === null) return refused("That change is not valid.");
  return answer((data) => data.moveApplication(applicationId, parsed));
}

/** New position (boards 57a, 57b): the drawer's fields, checked by the data interface. */
export async function createPosition(input: unknown): Promise<WriteResult<CreatedPosition>> {
  return answer((data) => data.createPosition(input));
}

/** The site-wide switch is #121's: its own write answers a refusal rather than throwing one. */
export async function setRecruitment(open: boolean): Promise<WriteResult<null>> {
  if (typeof open !== "boolean") return refused("That change is not valid.");
  return write(async (data) => {
    const result = await data.setRecruitment({ isOpen: open });
    if (result.status === "refused") throw new DashboardRefused("the recruitment switch");
  });
}
