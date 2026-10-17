import type { DepartmentGroup } from "@/lib/about/types";

// How a departments group and the advisors sit on desktop (boards 26, 26b,
// 26d, 26e and 26f): a grid of person cells whose column count follows the
// group. On the boards three columns span 960px with 40px between them, so a
// column starts every 333⅓px. The phone layout does not read this; it is
// always one column.

/** The gap between columns, px. */
export const GAP = 40;
/** One person cell's column, px: three of them and two gaps make the boards' 960. */
const CELL = (960 - 2 * GAP) / 3;

export type GroupLayout = {
  columns: 2 | 3;
  /** The whole grid's width at full size, px: 960 for three columns, 626⅔ for two. */
  width: number;
};

/** A group whose heads have division leads, as Technical Departments has. */
const hasLeads = (group: DepartmentGroup) =>
  group.members.some((m) => m.kind === "head" && m.leads.length > 0);

/**
 * Heads with leads: 1 to 4 heads take 2 columns, 5 or more take 3 (10 heads
 * add a fourth row). Single people with no leads always take 2 columns.
 */
export function groupLayout(group: DepartmentGroup): GroupLayout {
  const columns = hasLeads(group) && group.members.length >= 5 ? 3 : 2;
  return { columns, width: gridWidth(columns) };
}

/** A grid of person cells at full size, px. */
export const gridWidth = (columns: number) => columns * CELL + (columns - 1) * GAP;
