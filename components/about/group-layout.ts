import type { DepartmentGroup } from "@/lib/about/types";

// How a departments group sits on desktop (boards 26, 26d, 26e and 26f): a
// grid of person cells whose column count follows the group. The phone layout
// does not read this; it is always one column.

/** One person cell's column, and the gaps between columns: heads with leads, single people. All px. */
export const CELL = 310;
export const HEAD_GAP = 15;
const PERSON_GAP = 0;

export type GroupLayout = {
  columns: 2 | 3;
  /** The column gap, px. */
  gap: number;
  /** The whole grid's width at full size, px: 960 for three head columns, 620 for two people columns. */
  width: number;
};

/** A group whose heads have division leads, as Technical Departments has. */
const hasLeads = (group: DepartmentGroup) =>
  group.members.some((m) => m.kind === "head" && m.leads.length > 0);

/**
 * Heads with leads: 1 to 4 heads take 2 columns, 5 or more take 3 (10 heads
 * add a fourth row). Single people with no leads always take 2 narrower
 * columns, centred.
 */
export function groupLayout(group: DepartmentGroup): GroupLayout {
  const leads = hasLeads(group);
  const columns = leads && group.members.length >= 5 ? 3 : 2;
  const gap = leads ? HEAD_GAP : PERSON_GAP;
  return { columns, gap, width: gridWidth(columns, gap) };
}

/** A grid of person cells at full size, px. */
export const gridWidth = (columns: number, gap: number) => columns * CELL + (columns - 1) * gap;
