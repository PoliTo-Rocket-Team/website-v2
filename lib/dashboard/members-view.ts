import { departmentLine, peopleIn, type DepartmentMembers, type DepartmentPerson } from "./department-members";
import {
  headcount,
  matchesPerson,
  type DivisionHeader,
  type DivisionMembers,
  type DivisionPerson,
  type MemberPosition,
  type PersonPosition,
  type ReachMembers,
  type WaitingPerson,
} from "./division-members";
import type { DivisionQueue, Joining, MemberDirectory } from "./team";
import type { MemberTeamAddresses } from "./team-address";
import { wholeTeamLine, withPicks, type ColumnPicks, type TeamMember, type WholeTeamMembers } from "./team-members";
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

/** The person Edit details edits, as the division pages and the whole team list them alike. */
export type EditPerson = Pick<DivisionPerson, "id" | "name" | "signInEmail" | "photoUrl" | "since" | "details" | "divisions">;

/**
 * What the viewer may do to one row, on every page alike (issue #584): open
 * the one Edit details panel (board 61g) for the person, with its position
 * part (role title, lead or member, Remove from a division, Move to alumni),
 * and the row's ⋯ menu, which offers the same removals and leaving.
 */
export type MemberActions = {
  readonly person: EditPerson;
  readonly position: MemberPosition;
  /**
   * Whether Edit details may change their sign-in email (issues #741, #864):
   * set on the server, for full access only, whether or not a sign-in
   * account holds their user row (./sign-in-email.ts). A head's or a lead's page never offers it.
   */
  readonly correctsSignInEmail: boolean;
};

/** One person on the page, whichever role opens it; `actions` is null where the page offers no change to them. */
export type MemberEntry = TeamMember & { readonly actions: MemberActions | null };

/** Who waits to join one division: the people waiting for Confirm NDA, and the accepted applicants joining. */
export type MembersQueue = {
  readonly header: DivisionHeader;
  readonly waiting: readonly WaitingPerson[];
  readonly joining: readonly Joining[];
  /** Whether the viewer may change people in it (issue #351): Confirm NDA, Cancel add, Fill details. Confirm join asks `Joining.canConfirm`. */
  readonly editable: boolean;
};

/** One division the page holds as its own data: its people as that division lists them, and who waits to join it. */
export type MembersDivision = MembersQueue & {
  readonly people: readonly MemberEntry[];
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
  /** The line under the title while no select narrows the page: the viewer's whole scope (`membersHeader`). */
  readonly scopeLine: string;
  /** The selects' options: only the departments and divisions in the viewer's scope. */
  readonly units: readonly MembersUnit[];
  /** Everyone once, heads and leads first. */
  readonly everyone: readonly MemberEntry[];
  /** The divisions held as their own data; empty on the whole team, where a division is a narrowing of `everyone`. */
  readonly divisions: readonly MembersDivision[];
  /**
   * Who waits to join each division the page lists, on every page alike: the
   * held divisions' own, and on the whole team every open division's (issue #584).
   */
  readonly queues: readonly MembersQueue[];
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

/** Everyone the page may open the member drawer for, each once: whose email alias it reads (epic #538). */
export function memberIdsOf(page: MembersModel): number[] {
  return [...new Set([...page.everyone, ...page.divisions.flatMap((d) => d.people)].map((p) => p.id))];
}

/** The one place a model is made, so every role's model carries the same tools; a page's queues are its held divisions' unless it names others. */
function model(parts: Omit<MembersModel, "tools" | "queues"> & { readonly queues?: readonly MembersQueue[] }): MembersModel {
  return { tools: MEMBERS_TOOLS, ...parts, queues: parts.queues ?? parts.divisions };
}

/** The page for whatever the viewer's directory holds; null for no list at all. */
export function membersModelOf(directory: MemberDirectory): MembersModel | null {
  switch (directory.scope) {
    case "whole-team":
      return wholeTeamModel(directory);
    case "department":
      return departmentModel(directory);
    case "divisions":
      return reachModel(directory);
    case "none":
      return null;
  }
}

/**
 * A full-access seat's page (boards 73 to 73c, issue #418): the whole team,
 * with Add member. Each person the viewer may edit opens the same Edit
 * details panel a division page opens (issue #584), with the position the
 * directory holds for them; the team leader included (Owner decision,
 * 2026-10-19, issue #444). Every open division's people waiting for Confirm
 * NDA and joining are listed too, as a head or a lead sees their own units'
 * (Owner decision, 2026-10-22, issue #584).
 */
export function wholeTeamModel(
  page: WholeTeamMembers & {
    readonly positions: readonly PersonPosition[];
    readonly queues: readonly DivisionQueue[];
    readonly correctsSignInEmail: readonly number[];
  },
): MembersModel {
  const actionsOf = (person: EditPerson): MemberActions | null => {
    const position = page.positions.find((e) => e.id === person.id);
    return position === undefined ? null : { person, position, correctsSignInEmail: page.correctsSignInEmail.includes(person.id) };
  };
  const queues = page.queues.flatMap((q): MembersQueue[] => {
    const header = page.divisions.find((d) => d.id === q.divisionId);
    return header === undefined ? [] : [{ header, waiting: q.waiting, joining: q.joining, editable: q.editable }];
  });
  return model({
    scopeLine: wholeTeamLine(page),
    units: page.departments.map((d) => ({ name: d.name, divisions: d.divisions })),
    everyone: page.people.map((p) => ({ ...p, actions: actionsOf(p) })),
    divisions: [],
    queues,
    add: page.divisions.length === 0 ? null : { kind: "department", department: "the team", divisions: page.divisions },
    panelEdits: true,
  });
}

/** A department head's page (boards 69 to 69c): every division of the department, each as its lead's page. */
export function departmentModel(page: DepartmentMembers): MembersModel {
  const headers = page.tabs.map((t) => t.division);
  return model({
    scopeLine: departmentLine(page),
    units: [{ name: page.department.name, divisions: headers.map(unitDivision) }],
    everyone: page.everyone.map((p: DepartmentPerson) => entryOf(p, actionsOf(p))),
    divisions: page.tabs.map((tab) => sliceOf(tab)),
    add: headers.length === 0 ? null : { kind: "department", department: page.department.name, divisions: headers },
    panelEdits: true,
  });
}

/**
 * A division lead's page (boards 61e to 61h2, issue #903): every division they
 * reach, their own and every one a grant gives them, all at once, so a
 * whole-team grant lists the whole team. A grant at Can view offers no change
 * (issue #351).
 */
export function reachModel(page: ReachMembers): MembersModel {
  const slices = page.divisions.map(sliceOf);
  const headers = page.divisions.map((d) => d.division);
  const addable = page.divisions.filter((d) => d.editable).map((d) => d.division);
  const everyone = everyoneOnce(slices);
  const [only] = slices;
  return model({
    scopeLine: slices.length === 1 && only !== undefined ? divisionLine(only.header, only.people, only.waiting.length) : `Your divisions · ${peopleIn(everyone.length, slices.length)}`,
    units: unitsOf(headers),
    everyone,
    divisions: slices,
    add: addOf(addable),
    panelEdits: addable.length > 0,
  });
}

/** The departments and divisions of `headers`, each department once, in the order they first come. */
function unitsOf(headers: readonly DivisionHeader[]): MembersUnit[] {
  return [...new Set(headers.map((h) => h.department))].map((name) => ({
    name,
    divisions: headers.filter((h) => h.department === name).map(unitDivision),
  }));
}

/** Add member on a lead's page: the one division they may add to, a choice where they may add to several, or none. */
function addOf(divisions: readonly DivisionHeader[]): MembersAdd | null {
  const [first] = divisions;
  if (first === undefined) return null;
  if (divisions.length === 1) return { kind: "division", division: first };
  const departments = new Set(divisions.map((d) => d.department));
  return { kind: "department", department: departments.size === 1 ? first.department : "the team", divisions };
}

/**
 * Everyone in the held divisions once, as the first division that may change
 * them lists them (else the first that lists them): leads first, then by
 * division and name, as a department head's page orders them.
 */
function everyoneOnce(slices: readonly MembersDivision[]): MemberEntry[] {
  const rows = new Map<number, { readonly entry: MemberEntry; readonly at: number }>();
  slices.forEach((slice, at) => {
    for (const entry of slice.people) {
      const held = rows.get(entry.id);
      if (held === undefined || (held.entry.actions === null && entry.actions !== null)) rows.set(entry.id, { entry, at });
    }
  });
  return [...rows.values()]
    .sort((a, b) => Number(b.entry.role === "division-lead") - Number(a.entry.role === "division-lead") || a.at - b.at || a.entry.name.localeCompare(b.entry.name))
    .map((r) => r.entry);
}

/** "Mission Analysis Division · MA · 2 leads, 7 members": a division as the table lists it, those waiting included. */
function divisionLine(division: Pick<DivisionHeader, "id" | "name" | "code">, people: readonly MemberEntry[], waiting: number): string {
  const leads = people.filter((p) => p.divisions.some((d) => d.divisionId === division.id && d.role === "lead")).length;
  return [division.name, division.code, headcount(leads, people.length + waiting)].filter(Boolean).join(" · ");
}

function unitDivision(d: DivisionHeader): MembersUnit["divisions"][number] {
  return { id: d.id, name: d.name, code: d.code };
}

/** A division page's person's actions: none on a page at Can view, or on their own row (`position` is null there). */
function actionsOf(person: DivisionPerson): MemberActions | null {
  return person.position === null ? null : { person, position: person.position, correctsSignInEmail: false };
}

function sliceOf(page: DivisionMembers): MembersDivision {
  return {
    header: page.division,
    people: page.people.map((p) => entryOf(p, page.editable ? actionsOf(p) : null)),
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
    departments: [...new Set(person.divisions.map((d) => d.department).filter((name) => name !== ""))],
    divisionIds: person.divisions.map((d) => d.divisionId),
    chips: person.chips,
    divisions: person.divisions,
    places: person.places,
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

/**
 * Where the selects start (issue #903): on the division `asked` names
 * (`?division=`) and its department, where the scope holds it; on the one
 * division a one-division scope holds, so the selects name it and never read
 * "All …"; else on "All …", which is the viewer's whole scope.
 */
export function startingFilter(page: Pick<MembersModel, "units">, asked: number | null): MembersFilter {
  const held = page.units.flatMap((u) => u.divisions.map((d) => ({ department: u.name, divisionId: d.id })));
  const start = held.find((d) => d.divisionId === asked) ?? (held.length === 1 ? held[0] : undefined);
  return start === undefined ? NO_MEMBERS_FILTER : { ...start, query: "" };
}

/** The line under the title and the notice under the selects, for what the selects leave. */
export type MembersHeader = {
  readonly intro: string;
  /** What the viewer cannot change in the division shown: "Leads are changed by the Head of Aerodynamics". */
  readonly notice: string | null;
};

/**
 * The header for what the table shows (issue #903): the viewer's whole scope
 * while no select narrows it, else the chosen department or division, counted
 * as the selects leave it. The search does not change it.
 */
export function membersHeader(page: MembersModel, filter: Pick<MembersFilter, "department" | "divisionId">): MembersHeader {
  const shown = shownMembers(page, { ...filter, query: "" });
  const held = page.divisions.length === 1 ? page.divisions[0] : page.divisions.find((d) => d.header.id === shown.division?.id);
  const notice = held?.header.leadsHint ?? null;
  if (shown.division !== null) return { intro: divisionLine(shown.division, shown.people, shown.waiting.length), notice };
  const unit = page.units.find((u) => u.name === filter.department);
  if (unit !== undefined) return { intro: `${unit.name} Department · ${peopleIn(shown.people.length, unit.divisions.length)}`, notice };
  return { intro: page.scopeLine, notice };
}

/** The division select's options: every division of the chosen department, or of every department when none is chosen. */
export function divisionOptions(units: readonly MembersUnit[], department: string | null): MembersUnit["divisions"] {
  return units.filter((u) => department === null || u.name === department).flatMap((u) => u.divisions);
}

/** A waiting row matches the search by its email or the name given. */
export function matchesWaiting(waiting: Pick<WaitingPerson, "email" | "name">, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === "" || waiting.email.includes(q) || (waiting.name ?? "").toLowerCase().includes(q);
}

/** One person waiting for Confirm NDA, with the division they wait for and whether the viewer may act there. */
export type WaitingEntry = { readonly waiting: WaitingPerson; readonly division: DivisionHeader; readonly editable: boolean };

export type ShownMembers = {
  /** The one division chosen in the select, for every role: its bar shows above the rows. */
  readonly division: MembersUnit["divisions"][number] | null;
  readonly people: readonly MemberEntry[];
  readonly waiting: readonly WaitingEntry[];
  readonly joining: readonly { readonly joining: Joining; readonly division: string }[];
};

/** One row of the Members Table: a person waiting for Confirm NDA, or a member. */
export type MembersTableRow = { readonly kind: "waiting"; readonly entry: WaitingEntry } | { readonly kind: "member"; readonly person: MemberEntry };

/**
 * The Members Table's rows (issue #890): every waiting person the selects and
 * the search leave, as in the List view, then the members the column filters
 * leave. Waiting rows always come first, above every member row, whatever
 * order the member rows take (Owner decision on #890); the column filters
 * read member fields a waiting person does not have, so they narrow members
 * only.
 */
export function membersTableRows(shown: Pick<ShownMembers, "people" | "waiting">, picks: ColumnPicks): MembersTableRow[] {
  return [
    ...shown.waiting.map((entry): MembersTableRow => ({ kind: "waiting", entry })),
    ...withPicks(shown.people, picks).map((person): MembersTableRow => ({ kind: "member", person })),
  ];
}

/**
 * What the selects and the search leave. A division held as its own data
 * lists its people as that division does (their role and title there, Remove
 * from it); otherwise the selects narrow everyone. A division left chosen
 * from another department reads as all divisions. The search also matches
 * every shared team address a person holds (issue #800), read from the
 * Team addresses rows the page already carries for the side view.
 */
export function shownMembers(
  page: MembersModel,
  filter: MembersFilter,
  teamAddresses: Pick<MemberTeamAddresses, "rows"> = { rows: {} },
): ShownMembers {
  const heldBy = (id: number) => (teamAddresses.rows[id]?.lines ?? []).map((line) => line.address);
  const options = divisionOptions(page.units, filter.department);
  const divisionId = options.some((d) => d.id === filter.divisionId) ? filter.divisionId : null;
  const inDepartment = (id: number) => options.some((d) => d.id === id);
  const slice = divisionId === null ? null : (page.divisions.find((d) => d.header.id === divisionId) ?? null);
  const base = slice?.people ?? page.everyone;
  const people = base.filter(
    (p) =>
      (filter.department === null || p.divisionIds.some(inDepartment)) &&
      (divisionId === null || slice !== null || p.divisionIds.includes(divisionId)) &&
      matchesPerson(p, filter.query, heldBy(p.id)),
  );
  const queues = page.queues.filter((q) => (divisionId === null ? inDepartment(q.header.id) : q.header.id === divisionId));
  return {
    division: options.find((d) => d.id === divisionId) ?? null,
    people,
    waiting: queues.flatMap((s) =>
      s.waiting.filter((w) => matchesWaiting(w, filter.query)).map((w) => ({ waiting: w, division: s.header, editable: s.editable })),
    ),
    joining: queues.flatMap((s) => s.joining.map((j) => ({ joining: j, division: s.header.name }))),
  };
}
