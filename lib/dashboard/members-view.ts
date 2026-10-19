import { departmentLine, type DepartmentMembers, type DepartmentPerson, type DivisionRemoval } from "./department-members";
import { headcountLine, matchesPerson, type DivisionHeader, type DivisionMembers, type DivisionPerson, type WaitingPerson } from "./division-members";
import { divisionLabel, type Joining, type MemberDirectory } from "./team";
import { wholeTeamLine, type TeamMember, type WholeTeamMembers } from "./team-members";
import type { ViewerStanding } from "./viewer";

// The Members page as one view for every role that opens it (Owner decision,
// 2026-10-19, issues #408 and #418): the team leader, the operations lead, the
// IT lead, a department head and a division lead get the same tools and views. Each role's page data (the whole team,
// a department, a division) is turned into one model here; what differs is
// only the rows it holds and the actions its data allows. Who may see or
// change what is still decided where the data is built (./access.ts,
// ./division-members.ts); this file passes it through and adds nothing.

/**
 * Every tool and view the Members page offers. The page renders a tool only
 * when the model lists it, and every model lists all of them.
 */
export const MEMBERS_TOOLS = [
  "department-filter",
  "division-filter",
  "search",
  "list-view",
  "table-view",
  "table-column-filters",
  "list-paging",
  "phone-cards",
] as const;
export type MembersTool = (typeof MEMBERS_TOOLS)[number];

/** What the viewer may do to one row: the division page's person the menu acts on, where they may be removed from, and where Edit details sets the title. */
export type MemberActions = {
  readonly person: DivisionPerson;
  readonly removals: readonly DivisionRemoval[];
  readonly division: DivisionHeader;
};

/** One person on the page, whichever role opens it; `actions` is null where the page offers no change to them. */
export type MemberEntry = TeamMember & { readonly actions: MemberActions | null };

/** One division the page holds as its own data: its people as that division lists them, and who waits to join it. */
export type MembersDivision = {
  readonly header: DivisionHeader;
  readonly people: readonly MemberEntry[];
  readonly waiting: readonly WaitingPerson[];
  readonly joining: readonly Joining[];
  /** Whether the viewer may change people in it (issue #351). */
  readonly editable: boolean;
};

/** A department as the department and division selects offer it. */
export type MembersUnit = {
  readonly name: string;
  readonly divisions: readonly { readonly id: number; readonly name: string; readonly code: string | null }[];
};

/** Where Add member adds to: one division, or a choice of divisions. */
export type MembersAdd =
  | { readonly kind: "division"; readonly division: DivisionHeader }
  | { readonly kind: "department"; readonly department: string; readonly divisions: readonly DivisionHeader[] };

export type MembersModel = {
  readonly tools: readonly MembersTool[];
  /** The line under the title. */
  readonly intro: string;
  /** A line about what the viewer cannot change here: "Leads are changed by the Head of Aerodynamics". */
  readonly notice: string | null;
  /** The selects' options: only the departments and divisions the viewer's rows come from. */
  readonly units: readonly MembersUnit[];
  /** Everyone once, heads and leads first. */
  readonly everyone: readonly MemberEntry[];
  /** The divisions held as their own data; empty on the whole team, where a division is a narrowing of `everyone`. */
  readonly divisions: readonly MembersDivision[];
  /**
   * The other divisions a division lead reaches, each loaded as its own page
   * (`?division=`); null when there is only one.
   */
  readonly switcher: { readonly current: number; readonly options: readonly { readonly id: number; readonly name: string }[] } | null;
  readonly add: MembersAdd | null;
  /** Whether the member panel offers Edit details. */
  readonly panelEdits: boolean;
};

/**
 * Whether the viewer's Members page is the whole team: true for every
 * full-access seat, the team leader, the operations lead and the IT lead
 * alike, and for full access from a scope row (issue #418). Anyone else reads
 * the units their roles reach, built where the data is read.
 */
export function opensWholeTeam(viewer: ViewerStanding): boolean {
  return viewer.kind === "operations-lead";
}

/** The one place a model is made, so every role's model carries the same tools. */
function model(parts: Omit<MembersModel, "tools">): MembersModel {
  return { tools: MEMBERS_TOOLS, ...parts };
}

/** The page for whatever the viewer's directory holds; null for no list at all. */
export function membersModelOf(directory: MemberDirectory): MembersModel | null {
  switch (directory.scope) {
    case "whole-team":
      return wholeTeamModel(directory);
    case "department":
      return departmentModel(directory);
    case "division":
      return divisionModel(directory);
    case "none":
      return null;
  }
}

/** A full-access seat's page (boards 73 to 73c, issue #418): the whole team, read only per row, with Add member. */
export function wholeTeamModel(page: WholeTeamMembers): MembersModel {
  return model({
    intro: wholeTeamLine(page),
    notice: null,
    units: page.departments.map((d) => ({ name: d.name, divisions: d.divisions })),
    everyone: page.people.map((p) => ({ ...p, actions: null })),
    divisions: [],
    switcher: null,
    add: page.divisions.length === 0 ? null : { kind: "department", department: "the team", divisions: page.divisions },
    panelEdits: false,
  });
}

/** A department head's page (boards 69 to 69c): every division of the department, each as its lead's page. */
export function departmentModel(page: DepartmentMembers): MembersModel {
  const headers = page.tabs.map((t) => t.division);
  const divisionFor = (person: DepartmentPerson): DivisionHeader | null =>
    page.tabs.find((t) => t.division.id === person.divisions[0]?.divisionId)?.division ?? null;
  return model({
    intro: departmentLine(page),
    notice: null,
    units: [{ name: page.department.name, divisions: headers.map(unitDivision) }],
    everyone: page.everyone.map((p) => {
      const division = divisionFor(p);
      return entryOf(p, division === null ? null : { person: p, removals: p.removals, division });
    }),
    divisions: page.tabs.map((tab) => sliceOf(tab)),
    switcher: null,
    add: headers.length === 0 ? null : { kind: "department", department: page.department.name, divisions: headers },
    panelEdits: true,
  });
}

/** A division lead's page (boards 61e to 61h2): one division they reach. A grant at Can view offers no change (issue #351). */
export function divisionModel(page: DivisionMembers): MembersModel {
  const { division } = page;
  const slice = sliceOf(page);
  return model({
    intro: [division.name, division.code, headcountLine(page)].filter(Boolean).join(" · "),
    notice: division.leadsHint,
    units: [{ name: division.department, divisions: [unitDivision(division)] }],
    everyone: slice.people,
    divisions: [slice],
    switcher: page.divisions.length > 1 ? { current: division.id, options: page.divisions } : null,
    add: page.editable ? { kind: "division", division } : null,
    panelEdits: page.editable,
  });
}

function unitDivision(d: DivisionHeader): MembersUnit["divisions"][number] {
  return { id: d.id, name: d.name, code: d.code };
}

function sliceOf(page: DivisionMembers): MembersDivision {
  const short = divisionLabel(page.division.name);
  return {
    header: page.division,
    people: page.people.map((p) =>
      entryOf(p, page.editable ? { person: p, removals: [{ divisionId: page.division.id, short, removal: p.removal }], division: page.division } : null),
    ),
    waiting: page.waiting,
    joining: page.joining,
    editable: page.editable,
  };
}

/** A division page's person as a row of the shared list and table. */
function entryOf(person: DivisionPerson, actions: MemberActions | null): MemberEntry {
  const lead = person.role === "lead";
  return {
    id: person.id,
    name: person.name,
    signInEmail: person.signInEmail,
    photoUrl: person.photoUrl,
    since: person.since,
    role: lead ? "division-lead" : "member",
    roleLabel: lead ? "Division Lead" : (person.title ?? "Member"),
    departmentIds: [],
    divisionIds: person.divisions.map((d) => d.divisionId),
    chips: person.chips,
    divisions: person.divisions,
    details: person.details,
    nda: person.nda,
    self: person.self,
    actions,
  };
}

// Narrowing the page: the same selects and search for every role

/** The selects and the search. Null is all departments or all divisions. */
export type MembersFilter = {
  readonly department: string | null;
  readonly divisionId: number | null;
  readonly query: string;
};

export const NO_MEMBERS_FILTER: MembersFilter = { department: null, divisionId: null, query: "" };

/** The division select's options: every division of the chosen department, or of every department when none is chosen. */
export function divisionOptions(units: readonly MembersUnit[], department: string | null): MembersUnit["divisions"] {
  return units.filter((u) => department === null || u.name === department).flatMap((u) => u.divisions);
}

/** A waiting row matches the search by its email or the name given. */
export function matchesWaiting(waiting: Pick<WaitingPerson, "email" | "name">, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === "" || waiting.email.includes(q) || (waiting.name ?? "").toLowerCase().includes(q);
}

export type ShownMembers = {
  /** The one division chosen in the select, for every role: its bar shows above the rows. */
  readonly division: MembersUnit["divisions"][number] | null;
  readonly people: readonly MemberEntry[];
  readonly waiting: readonly { readonly waiting: WaitingPerson; readonly division: DivisionHeader; readonly editable: boolean }[];
  readonly joining: readonly { readonly joining: Joining; readonly division: string; readonly editable: boolean }[];
};

/**
 * What the selects and the search leave. A division held as its own data
 * lists its people as that division does (their role and title there, Remove
 * from it); otherwise the selects narrow everyone. A division left chosen
 * from another department reads as all divisions.
 */
export function shownMembers(page: MembersModel, filter: MembersFilter): ShownMembers {
  const options = divisionOptions(page.units, filter.department);
  const divisionId = options.some((d) => d.id === filter.divisionId) ? filter.divisionId : null;
  const inDepartment = (id: number) => options.some((d) => d.id === id);
  const slice = divisionId === null ? null : (page.divisions.find((d) => d.header.id === divisionId) ?? null);
  const base = slice?.people ?? page.everyone;
  const people = base.filter(
    (p) =>
      (filter.department === null || p.divisionIds.some(inDepartment)) &&
      (divisionId === null || slice !== null || p.divisionIds.includes(divisionId)) &&
      matchesPerson(p, filter.query),
  );
  const slices = slice ? [slice] : page.divisions.filter((d) => inDepartment(d.header.id));
  return {
    division: options.find((d) => d.id === divisionId) ?? null,
    people,
    waiting: slices.flatMap((s) =>
      s.waiting.filter((w) => matchesWaiting(w, filter.query)).map((w) => ({ waiting: w, division: s.header, editable: s.editable })),
    ),
    joining: slices.flatMap((s) => s.joining.map((j) => ({ joining: j, division: s.header.name, editable: s.editable }))),
  };
}
