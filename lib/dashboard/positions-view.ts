import {
  departmentLabel,
  divisionsOf,
  filterPositions,
  positionTabCounts,
  type PositionRow,
  type PositionsPage,
  type PositionTab,
} from "./recruitment";

// The Positions page as one view for every role that opens it (Owner
// decision, 2026-10-19, issues #408 and #417): the team leader, the operations
// lead, the IT lead, a department head and a division lead get the same
// toolbar and the same columns. Each role's page data is turned into one model
// here; what differs is only the rows it holds, and so the options its selects
// offer. Who may see or change what is still decided where the data is read
// (./database-recruitment.ts) and by the server actions; this file adds nothing.

/**
 * Every tool and view the Positions page offers. The page renders a tool only
 * when the model lists it, and every model lists all of them.
 */
export const POSITIONS_TOOLS = ["department-filter", "division-filter", "status-switch", "search", "sort", "table-view", "phone-cards"] as const;
export type PositionsTool = (typeof POSITIONS_TOOLS)[number];

/** The table's columns, the same for every role. */
export const POSITIONS_COLUMNS = ["position", "department", "applications", "updated", "status"] as const;
export type PositionsColumn = (typeof POSITIONS_COLUMNS)[number];

/** How the list is ordered. The page's rows arrive newest first. */
export type PositionsSort = "newest" | "oldest" | "title" | "applications";

export const POSITIONS_SORTS: readonly { readonly sort: PositionsSort; readonly label: string }[] = [
  { sort: "newest", label: "Newest first" },
  { sort: "oldest", label: "Oldest first" },
  { sort: "title", label: "Title A to Z" },
  { sort: "applications", label: "Most applications" },
];

/** A department as the department and division selects offer it: only what the viewer reaches. */
export type PositionsUnit = { readonly name: string; readonly divisions: readonly string[] };

export type PositionsModel = {
  readonly tools: readonly PositionsTool[];
  readonly columns: readonly PositionsColumn[];
  /** The line under the title. */
  readonly intro: string;
  readonly units: readonly PositionsUnit[];
};

/** The one place a model is made, so every role's model carries the same tools and columns. */
export function positionsModelOf(page: PositionsPage): PositionsModel {
  // A head's department names its divisions even before they hold a role, so
  // the Overview's `?division=` link always finds its division in the select.
  const own = page.scope === "department" ? page.department.divisions.map((d) => ({ department: page.department.name, division: d.name })) : [];
  const reached = [...page.positions, ...own];
  const departments = [...new Set(reached.map((r) => r.department))];
  return {
    tools: POSITIONS_TOOLS,
    columns: POSITIONS_COLUMNS,
    intro: introOf(page),
    units: departments.map((name) => ({ name, divisions: divisionsOf(reached, name) })),
  };
}

/** The line under the title (boards 41, 57 and 63). */
function introOf(page: PositionsPage): string {
  const after = "Open roles show on the site while recruitment is on.";
  switch (page.scope) {
    case "team":
      return `Open or close roles. ${after}`;
    case "department":
      return `Roles in every division of the ${departmentLabel(page.department.name)}. ${after}`;
    case "division":
      return `Roles in ${page.division ? `the ${page.division}` : "your division"}. ${after}`;
  }
}

// Narrowing the list: the same selects, switch, search and sort for every role

/** The toolbar's choices. Null is all departments or all divisions. */
export type PositionsFilter = {
  readonly department: string | null;
  readonly division: string | null;
  readonly tab: PositionTab;
  readonly query: string;
  readonly sort: PositionsSort;
};

export const NO_POSITIONS_FILTER: PositionsFilter = { department: null, division: null, tab: "all", query: "", sort: "newest" };

/** The division select's options: every division of the chosen department, or of every department when none is chosen. */
export function divisionOptions(units: readonly PositionsUnit[], department: string | null): string[] {
  return units.filter((u) => department === null || u.name === department).flatMap((u) => u.divisions);
}

export type ShownPositions = {
  /** The division the select shows: a division left chosen from another department reads as all divisions. */
  readonly division: string | null;
  /** How many rows each status tab holds, after the selects and the search. */
  readonly counts: Record<PositionTab, number>;
  readonly rows: readonly PositionRow[];
};

/** What the toolbar leaves of the page's rows, in the order the sort asks for. */
export function shownPositions(units: readonly PositionsUnit[], positions: readonly PositionRow[], filter: PositionsFilter): ShownPositions {
  const division = filter.division !== null && divisionOptions(units, filter.department).includes(filter.division) ? filter.division : null;
  const narrowed = filterPositions(positions, { tab: "all", department: filter.department, division, search: filter.query });
  return {
    division,
    counts: positionTabCounts(narrowed),
    rows: sorted(filterPositions(narrowed, { tab: filter.tab, department: null, search: "" }), filter.sort),
  };
}

function sorted(rows: readonly PositionRow[], sort: PositionsSort): PositionRow[] {
  switch (sort) {
    case "newest":
      return [...rows];
    case "oldest":
      return [...rows].reverse();
    case "title":
      return [...rows].sort((a, b) => a.title.localeCompare(b.title));
    case "applications":
      // A role whose applications the viewer does not read counts below one with none (issue #477).
      return [...rows].sort((a, b) => (b.applications?.total ?? -1) - (a.applications?.total ?? -1));
  }
}
