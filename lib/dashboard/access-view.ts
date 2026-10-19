import {
  departmentOfPlace,
  roleDivision,
  shortUnitName,
  type AccessDivision,
  type AccessPlace,
  type AccessUnit,
  type PersonAccess,
  type RoleAccess,
} from "./division-access";

// The Access page's toolbar as one view for every role that opens it (Owner
// decision, 2026-10-19, issues #408 and #415): the team leader, the operations
// lead, the IT lead, a department head and a division lead of one or several
// divisions get the same selects, switch, search and sort. Each role's unit is
// turned into one model here; what differs is only the rows it holds, and so
// the options its selects offer. Who may see or change what is still decided
// where the data is read (./database-division.ts), by the server actions and
// by ./division-access.ts; this file adds nothing.

/**
 * Every tool and view the Access page offers. The page renders a tool only
 * when the model lists it, and every model lists all of them.
 */
export const ACCESS_TOOLS = ["department-filter", "division-filter", "show-switch", "search", "sort", "table-view", "phone-cards"] as const;
export type AccessTool = (typeof ACCESS_TOOLS)[number];

/** The "Show people" switch (board 71): everyone, the full-access seats, and the holders of "Approve orders". */
export const ACCESS_SHOWS = ["everyone", "full-access", "approve-orders"] as const;
export type AccessShow = (typeof ACCESS_SHOWS)[number];

export const ACCESS_SHOW_LABELS: Readonly<Record<AccessShow, string>> = {
  everyone: "Everyone",
  "full-access": "Full access",
  "approve-orders": "Approve orders",
};

/** How the list is ordered. The page lists the leads with the role first, then each person in the order their access was given. */
export type AccessSort = "leads-first" | "name" | "recent";

export const ACCESS_SORTS: readonly { readonly sort: AccessSort; readonly label: string }[] = [
  { sort: "leads-first", label: "Leads first" },
  { sort: "name", label: "Name A to Z" },
  { sort: "recent", label: "Recently given" },
];

/** A division as the division select offers it: its full name, the shorter label, and the department it is in when the page knows it. */
export type AccessViewDivision = {
  /** "Mission Analysis Division" */
  readonly name: string;
  /** "Mission Analysis" */
  readonly label: string;
  readonly department: string | null;
};

export type AccessModel = {
  readonly tools: readonly AccessTool[];
  /** The departments the department select offers: only those the viewer's unit names. */
  readonly departments: readonly string[];
  /** The divisions the division select offers: only those in the viewer's unit. */
  readonly divisions: readonly AccessViewDivision[];
};

function viewDivision(division: AccessDivision, department: string | null): AccessViewDivision {
  return { name: division.name, label: shortUnitName(division.name), department };
}

/**
 * The one place a model is made, so every role's model carries the same tools.
 * The selects offer the unit the viewer reaches: every department and division
 * from full access, a head's department and its divisions, a lead's divisions.
 * A lead's page names no department, so its department select offers only all
 * departments.
 */
export function accessModelOf(unit: AccessUnit): AccessModel {
  switch (unit.kind) {
    case "team":
      return {
        tools: ACCESS_TOOLS,
        departments: unit.departments.map((d) => d.department.name),
        divisions: unit.departments.flatMap((d) => d.divisions.map((v) => viewDivision(v, d.department.name))),
      };
    case "department":
      return { tools: ACCESS_TOOLS, departments: [unit.department.name], divisions: unit.divisions.map((v) => viewDivision(v, unit.department.name)) };
    case "division":
      return { tools: ACCESS_TOOLS, departments: [], divisions: unit.divisions.map((d) => viewDivision(d.division, null)) };
  }
}

// The rows of the table

/** A row of the table: a lead whose access comes with the role, or someone the viewer's unit shared access with. */
export type AccessRow = { readonly kind: "role"; readonly role: RoleAccess } | { readonly kind: "grants"; readonly access: PersonAccess };

/** The division a row names and files under: a role row's own, else the person's. */
export function divisionOfRow(row: AccessRow): AccessDivision | null {
  return row.kind === "role" ? roleDivision(row.role) : row.access.person.division;
}

/**
 * The department a row files under: on a team page its division's, else the
 * department its access is in (issue #238); a head's own department on theirs;
 * none on a lead's page, which names no department.
 */
export function departmentOfRow(row: AccessRow, unit: AccessUnit): string | null {
  switch (unit.kind) {
    case "division":
      return null;
    case "department":
      return unit.department.name;
    case "team": {
      const division = divisionOfRow(row);
      const place: AccessPlace | undefined =
        division !== null ? { kind: "division", division } : row.kind === "role" ? row.role.place : row.access.grants[0]?.place;
      return place === undefined ? null : (departmentOfPlace(unit, place)?.name ?? null);
    }
  }
}

/** Whether a row shows under a choice of the "Show people" switch (board 71). */
export function inShow(row: AccessRow, show: AccessShow): boolean {
  switch (show) {
    case "everyone":
      return true;
    case "full-access":
      return row.kind === "role" && row.role.place.kind === "team";
    case "approve-orders":
      return row.kind === "grants" && row.access.approveOrders;
  }
}

// Narrowing the list: the same selects, switch, search and sort for every role

/** The toolbar's choices. Null is all departments or all divisions. */
export type AccessFilter = {
  readonly department: string | null;
  readonly division: string | null;
  readonly show: AccessShow;
  readonly query: string;
  readonly sort: AccessSort;
};

export const NO_ACCESS_FILTER: AccessFilter = { department: null, division: null, show: "everyone", query: "", sort: "leads-first" };

/** The division select's options: every division of the chosen department, or every division when none is chosen. */
export function divisionOptions(model: AccessModel, department: string | null): AccessViewDivision[] {
  return model.divisions.filter((d) => department === null || d.department === department);
}

export type ShownAccess = {
  /** The division the select shows: a division left chosen from another department reads as all divisions. */
  readonly division: string | null;
  /** How many rows each choice of the switch holds, after the selects and the search. */
  readonly counts: Record<AccessShow, number>;
  readonly rows: readonly AccessRow[];
};

function personName(row: AccessRow): string {
  return row.kind === "role" ? row.role.person.name : row.access.person.name;
}

function matches(row: AccessRow, needle: string): boolean {
  if (needle === "") return true;
  const division = divisionOfRow(row);
  return `${personName(row)} ${division?.name ?? ""}`.toLowerCase().includes(needle);
}

/** What the toolbar leaves of the page's rows, in the order the sort asks for. */
export function shownAccess(model: AccessModel, unit: AccessUnit, rows: readonly AccessRow[], filter: AccessFilter): ShownAccess {
  const division =
    filter.division !== null && divisionOptions(model, filter.department).some((d) => d.name === filter.division) ? filter.division : null;
  const needle = filter.query.trim().toLowerCase();
  const narrowed = rows.filter(
    (row) =>
      (filter.department === null || departmentOfRow(row, unit) === filter.department) &&
      (division === null || divisionOfRow(row)?.name === division) &&
      matches(row, needle),
  );
  const counts = Object.fromEntries(ACCESS_SHOWS.map((show) => [show, narrowed.filter((row) => inShow(row, show)).length])) as Record<
    AccessShow,
    number
  >;
  return {
    division,
    counts,
    rows: sorted(
      narrowed.filter((row) => inShow(row, filter.show)),
      filter.sort,
    ),
  };
}

/** When a row's access was given: a grants row's latest date; a role row has none. */
function givenOn(row: AccessRow): string | null {
  return row.kind === "grants" ? row.access.givenOn : null;
}

function sorted(rows: readonly AccessRow[], sort: AccessSort): AccessRow[] {
  switch (sort) {
    case "leads-first":
      return [...rows];
    case "name":
      return [...rows].sort((a, b) => personName(a).localeCompare(personName(b)));
    case "recent":
      // Newest given first; rows with no date, such as access with the role, keep their order after them.
      return [...rows].sort((a, b) => {
        const x = givenOn(a);
        const y = givenOn(b);
        if (x === y) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return y.localeCompare(x);
      });
  }
}
