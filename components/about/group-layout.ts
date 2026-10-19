import type { DepartmentGroup } from "@/lib/about/types";

// How a departments group and the advisors sit on desktop (boards 26, 26b,
// 26d, 26e and 26f): a grid of person cells whose column count follows the
// group. On the boards three columns span 960px with 40px between them, so a
// column starts every 333⅓px. The phone layout does not read this; it is
// always one column.
//
// Issue #411 asks for wider groups, so a lead's name fits on one line in the
// common case. The chosen approach: a group whose heads have division leads
// takes two wide columns instead, each wide enough for two lead cells side by
// side. The carousel shrinks a group that is wider than its column
// (`departments.tsx`).

/** The gap between columns, px. */
export const GAP = 40;
/** One person cell's column, px: three of them and two gaps make the boards' 960. */
const CELL = (960 - 2 * GAP) / 3;

/** From lg, a head's leads sit this far in: the 1px rule and `lg:pl-5` in `departments.tsx`, px. */
const LEAD_INDENT = 1 + 20;
/** From lg, the gap between a head's two lead columns: `lg:gap-x-3` in `departments.tsx`, px. */
const LEAD_GAP = 12;
/** One division lead's cell at full size, px: the 40px photo, its 12px gap and about 208px of text. */
const LEAD_CELL = 260;
/** The column of a head with leads, px: two lead cells under the head. */
const HEAD_CELL = LEAD_INDENT + 2 * LEAD_CELL + LEAD_GAP;

export type GroupLayout = {
  columns: 2;
  /** The whole grid's width at full size, px: 1146 for heads with leads, 626⅔ for single people. */
  width: number;
};

/** A group whose heads have division leads, as Technical Departments has. */
const hasLeads = (group: DepartmentGroup) =>
  group.members.some((m) => m.kind === "head" && m.leads.length > 0);

/**
 * Every group takes two columns: wide ones when its heads have leads, the
 * boards' person cells when it holds single people with no leads.
 */
export function groupLayout(group: DepartmentGroup): GroupLayout {
  return { columns: 2, width: hasLeads(group) ? 2 * HEAD_CELL + GAP : gridWidth(2) };
}

/** A grid of person cells at full size, px. */
export const gridWidth = (columns: number) => columns * CELL + (columns - 1) * GAP;
