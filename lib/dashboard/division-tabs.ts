// The division tabs a department head's Positions, Applications and Access
// pages open with (boards 63, 64 and 65; phone boards 63m to 65m; issue #230).
// "All divisions" comes first and is where every page starts (Owner decision,
// 2026-10-11); then one tab per division of the department, each with how
// many rows it holds. A division lead has one division and sees no tabs.

/** The open tab: null is "All divisions", else a division's full name. */
export type DivisionTab = string | null;

export const ALL_DIVISIONS_LABEL = "All divisions";

export type DivisionTabOption = {
  readonly division: DivisionTab;
  /** "All divisions", "Mission Analysis" */
  readonly label: string;
  readonly count: number;
};

/** "Mission Analysis Division" reads "Mission Analysis" on a tab. */
function tabLabel(name: string): string {
  return name.replace(/\s+Division$/, "");
}

/**
 * The tabs over a list: All divisions with every row, then each division with
 * its own. `rowDivisions` names each row's division; a row in none counts
 * only under All divisions. Fewer than two divisions need no tabs: null.
 */
export function divisionTabs(divisions: readonly string[], rowDivisions: readonly (string | null)[]): DivisionTabOption[] | null {
  if (divisions.length < 2) return null;
  return [
    { division: null, label: ALL_DIVISIONS_LABEL, count: rowDivisions.length },
    ...divisions.map((division) => ({
      division,
      label: tabLabel(division),
      count: rowDivisions.filter((d) => d === division).length,
    })),
  ];
}

/** Whether a row in `division` shows under the open tab. */
export function inDivisionTab(division: string | null, tab: DivisionTab): boolean {
  return tab === null || division === tab;
}
