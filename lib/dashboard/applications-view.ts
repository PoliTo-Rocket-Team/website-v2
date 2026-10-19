import { inTab, tabCounts, type ApplicationStage, type ApplicationTab } from "./application-flow";
import { departmentLabel, divisionsOf, type ApplicationsPage, type PositionRef } from "./recruitment";

// The Applications page as one view for every role that opens it (Owner
// decision, 2026-10-19, issues #408 and #416): the team leader, the operations
// lead, the IT lead, a department head and a division lead get the same
// toolbar. Each role's page data is turned into one model here; what differs
// is only the rows it holds, and so the options its selects offer. Who may see
// or change what is still decided where the data is read
// (./database-recruitment.ts) and by the server action; this file adds nothing.

/**
 * Every tool the Applications page offers. The page renders a tool only when
 * the model lists it, and every model lists all of them.
 */
export const APPLICATIONS_TOOLS = ["department-filter", "division-filter", "stage-switch", "position-filter", "search", "sort"] as const;
export type ApplicationsTool = (typeof APPLICATIONS_TOOLS)[number];

/** How the list is ordered. The page's rows arrive newest first. */
export type ApplicationsSort = "newest" | "oldest" | "name";

export const APPLICATIONS_SORTS: readonly { readonly sort: ApplicationsSort; readonly label: string }[] = [
  { sort: "newest", label: "Newest first" },
  { sort: "oldest", label: "Oldest first" },
  { sort: "name", label: "Name A to Z" },
];

/** A department as the department and division selects offer it: only those the viewer's positions sit in. */
export type ApplicationsUnit = { readonly name: string; readonly divisions: readonly string[] };

export type ApplicationsModel = {
  readonly tools: readonly ApplicationsTool[];
  /** The line under the title. */
  readonly intro: string;
  readonly units: readonly ApplicationsUnit[];
};

/** The one place a model is made, so every role's model carries the same tools. */
export function applicationsModelOf(page: ApplicationsPage): ApplicationsModel {
  const departments = [...new Set(page.positions.map((p) => p.department))];
  return {
    tools: APPLICATIONS_TOOLS,
    intro: introOf(page),
    units: departments.map((name) => ({ name, divisions: divisionsOf(page.positions, name) })),
  };
}

/** The line under the title (boards 58b and 64). */
function introOf(page: ApplicationsPage): string {
  switch (page.scope.kind) {
    case "team":
      return "Applications for the positions you lead.";
    case "division":
      return page.scope.division ? `Applications for ${page.scope.division} roles.` : "Applications for the positions you lead.";
    case "department":
      return `Applications for ${departmentLabel(page.scope.department.name)} roles. Pick a division to narrow the list.`;
  }
}

// Narrowing the list: the same selects, switch, search and sort for every role

/** The toolbar's choices. Null is all departments, all divisions or all positions. */
export type ApplicationsFilter = {
  readonly department: string | null;
  readonly division: string | null;
  readonly position: PositionRef | null;
  readonly tab: ApplicationTab;
  readonly query: string;
  readonly sort: ApplicationsSort;
};

export const NO_APPLICATIONS_FILTER: ApplicationsFilter = {
  department: null,
  division: null,
  position: null,
  tab: "all",
  query: "",
  sort: "newest",
};

/** The division select's options: every division of the chosen department, or of every department when none is chosen. */
export function divisionOptions(units: readonly ApplicationsUnit[], department: string | null): string[] {
  return units.filter((u) => department === null || u.name === department).flatMap((u) => u.divisions);
}

/** The fields of a row the toolbar reads. */
type Row = {
  readonly state: { readonly stage: ApplicationStage };
  readonly applicant: { readonly name: string; readonly email: string };
  readonly position: { readonly ref: PositionRef; readonly title: string; readonly division: string };
};

export type ShownApplications<A extends Row> = {
  /** The division the select shows: a division left chosen from another department reads as all divisions. */
  readonly division: string | null;
  /** The positions filter's options: the positions the selects leave. */
  readonly positions: ApplicationsPage["positions"];
  /** The position the filter shows: one left chosen outside the selects reads as all positions. */
  readonly position: PositionRef | null;
  /** How many rows each stage tab holds, after the selects, the position filter and the search. */
  readonly counts: Record<ApplicationTab, number>;
  readonly rows: readonly A[];
};

/** What the toolbar leaves of the page's rows, in the order the sort asks for. */
export function shownApplications<A extends Row>(
  page: Pick<ApplicationsPage, "positions">,
  units: readonly ApplicationsUnit[],
  applications: readonly A[],
  filter: ApplicationsFilter,
): ShownApplications<A> {
  const division = filter.division !== null && divisionOptions(units, filter.department).includes(filter.division) ? filter.division : null;
  const positions = page.positions.filter(
    (p) => (filter.department === null || p.department === filter.department) && (division === null || p.division === division),
  );
  const refs = new Set(positions.map((p) => p.ref));
  const position = filter.position !== null && refs.has(filter.position) ? filter.position : null;
  const needle = filter.query.trim().toLowerCase();
  const narrowed = applications.filter(
    (a) =>
      refs.has(a.position.ref) &&
      (position === null || a.position.ref === position) &&
      (needle === "" || `${a.applicant.name} ${a.applicant.email} ${a.position.title}`.toLowerCase().includes(needle)),
  );
  return {
    division,
    positions,
    position,
    counts: tabCounts(narrowed.map((a) => a.state.stage)),
    rows: sorted(
      narrowed.filter((a) => inTab(a.state.stage, filter.tab)),
      filter.sort,
    ),
  };
}

function sorted<A extends Row>(rows: readonly A[], sort: ApplicationsSort): A[] {
  switch (sort) {
    case "newest":
      return [...rows];
    case "oldest":
      return [...rows].reverse();
    case "name":
      return [...rows].sort((a, b) => a.applicant.name.localeCompare(b.applicant.name));
  }
}
