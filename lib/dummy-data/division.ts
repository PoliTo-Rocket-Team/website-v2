import { randomInt } from "node:crypto";
import {
  canGiveApproveOrders,
  checkRemoveAllAccess,
  checkRemoveGrant,
  checkSaveAccess,
  LEAD_ROLE_HELD_ACCESS,
  mergeHeld,
  NO_APPROVE_ORDERS,
  NO_ROLE,
  placesOf,
  roleAccessOf,
  roleCovers,
  samePlace,
  seatLine,
  UNIT_TARGETS,
  type AccessDepartmentUnit,
  type AccessDivision,
  type AccessGrant,
  type AccessLevel,
  type AccessPage,
  type AccessPerson,
  type AccessPlace,
  type AccessTarget,
  type AccessUnit,
  type ApproveOrdersAccess,
  type HeldAccess,
  type PersonRole,
  type UnitTarget,
} from "@/lib/dashboard/division-access";
import type { HeldSeat } from "@/lib/dashboard/hand-over";
import type { FlaggedSeat, FullAccessSeat } from "@/lib/dashboard/viewer";
import { headTitleOf, homeFirst, ledDivisionsOf, membershipsIn, type DivisionMembership, type Placement, type RosterEntry } from "@/lib/dashboard/team";
import type { ApproveOrdersChange } from "@/lib/dashboard/orders";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import type { TeamEdits } from "./edits";
import { departments, divisions, people, personFor, type DummyPerson } from "./team";

// The Access pages for the test developer (boards 60 to 60m, issues #145 and
// #213; the department head's Access, boards 65 and 65b, issue #230); their
// Orders page is ./orders.ts. The division lead is Marco Bianchi, who leads Mission Analysis
// with Pietro Ricci and Optimization and Analysis with Paolo Conti, so his
// Access page lists both divisions in one list (issue #185); the department head is Chiara Rinaldi, Aerodynamics;
// the operations lead, Giulia Rossi, has full access across the team (#238),
// and so does the team leader, Alessandro Greco, who alone gives "Approve
// orders" (boards 71 and 71b, issue #247).
// The people come from the roster as the test developer left it
// (./team-pages.ts), so someone moved to alumni has no access here any more.

export type DummyHeldAccess = {
  readonly personId: number;
  readonly target: UnitTarget;
  readonly level: AccessLevel;
};

/** What each lead holds in their own division ("Your access" on board 60). */
export const heldAccess = [
  { personId: 2, target: "positions", level: "edit" },
  { personId: 2, target: "applications", level: "edit" },
  { personId: 2, target: "members", level: "edit" },
  { personId: 2, target: "orders", level: "edit" },
] as const satisfies readonly DummyHeldAccess[];

/** Where a grant applies: one division, a whole department, or the whole team. */
export type DummyPlace = { readonly divisionId: number } | { readonly departmentId: number } | { readonly wholeTeam: true };

export type DummyGrant = {
  readonly id: number;
  readonly personId: number;
  readonly place: DummyPlace;
  readonly target: AccessTarget;
  readonly level: AccessLevel;
  readonly givenById: number;
  readonly givenOn: string;
};

/**
 * Board 60's table: Sara Conti, Luca Marino and Sofia Neri, each area in the
 * order given. Board 65 adds Optimization and Analysis's grants and one the
 * head gave across the whole department. The whole-team grants, Alumni and
 * Content, show on a team page only: no lead or head in the sample holds Content.
 */
export const accessGrants = [
  { id: 1, personId: 7, place: { divisionId: 1 }, target: "applications", level: "view", givenById: 2, givenOn: "2026-10-02" },
  { id: 2, personId: 7, place: { divisionId: 1 }, target: "positions", level: "edit", givenById: 2, givenOn: "2026-10-02" },
  { id: 3, personId: 4, place: { divisionId: 1 }, target: "positions", level: "view", givenById: 2, givenOn: "2026-09-28" },
  { id: 4, personId: 4, place: { divisionId: 1 }, target: "applications", level: "edit", givenById: 2, givenOn: "2026-09-28" },
  { id: 5, personId: 3, place: { divisionId: 1 }, target: "members", level: "view", givenById: 2, givenOn: "2026-10-02" },
  { id: 6, personId: 32, place: { divisionId: 2 }, target: "positions", level: "view", givenById: 20, givenOn: "2026-09-28" },
  { id: 7, personId: 32, place: { divisionId: 2 }, target: "applications", level: "edit", givenById: 20, givenOn: "2026-09-28" },
  { id: 8, personId: 13, place: { departmentId: 1 }, target: "members", level: "view", givenById: 15, givenOn: "2026-10-02" },
  // Board 71: Alumni across the whole team, which only full access gives.
  { id: 9, personId: 3, place: { wholeTeam: true }, target: "alumni", level: "edit", givenById: 1, givenOn: "2026-10-03" },
  // Content across the whole team, at Can edit, which only full access or a Content holder gives (issue #504).
  { id: 10, personId: 4, place: { wholeTeam: true }, target: "content", level: "edit", givenById: 1, givenOn: "2026-10-21" },
] as const satisfies readonly DummyGrant[];

/** Someone holding "Approve orders", and the day the team leader gave it. */
export type ApproveOrdersHolding = { readonly personId: number; readonly givenOn: string };

/**
 * Who the team leader gave "Approve orders" (board 71): Sara Conti, a member
 * of Mission Analysis. None of the test developer's viewers holds it until
 * the team leader gives it on the Access page (`approveOrdersHoldersOf`).
 */
export const approveOrdersHolders: readonly ApproveOrdersHolding[] = [{ personId: 7, givenOn: "2026-10-06" }];

/**
 * Who holds "Approve orders" once what the team leader gave and removed on
 * the Access page (issue #270) is laid over board 71's holders. Every page
 * reads this one list, so someone given it is a holder on Access, decides on
 * Orders, and carries it in their standing when the test developer switches
 * to them (`dummyViewer`, ./index.ts).
 */
export function approveOrdersHoldersOf(edits: Pick<TeamEdits, "approveOrders">): ApproveOrdersHolding[] {
  const kept = approveOrdersHolders.filter((h) => edits.approveOrders[h.personId] === undefined);
  const given = Object.entries(edits.approveOrders).flatMap(([id, e]) => (e.holds ? [{ personId: Number(id), givenOn: e.givenOn }] : []));
  return [...kept, ...given];
}

/**
 * The edits after the team leader gave "Approve orders" today, or removed
 * it. Removing it from someone board 71 never gave it to leaves nothing to
 * keep.
 */
export function withApproveOrdersChange(edits: TeamEdits, change: ApproveOrdersChange): TeamEdits {
  const { [change.personId]: _dropped, ...others } = edits.approveOrders;
  if (change.holds) return { ...edits, approveOrders: { ...others, [change.personId]: { holds: true, givenOn: today() } } };
  const heldAtStart = approveOrdersHolders.some((h) => h.personId === change.personId);
  return { ...edits, approveOrders: heldAtStart ? { ...others, [change.personId]: { holds: false } } : others };
}

/** The team leader: they decide orders and give "Approve orders". */
export const TEAM_LEADER_ID = personFor["team-leader"].id;

/**
 * The head roles flagged with a full-access seat in the dummy data, by
 * department, as `roles.full_access` flags a role row on the database: the
 * head of Operations is the operations lead. The sample team has no IT lead,
 * and its board seats carry no flag.
 */
const FLAGGED_HEAD_ROLES: Readonly<Record<number, FlaggedSeat>> = { 6: "operations-lead" };

/**
 * The full-access seat a role gives (issues #238, #501): the team leader's,
 * and a flagged head role's. The seat follows the role, never a person:
 * whoever holds the role on the roster as the test developer left it holds
 * the seat, so Change head and a confirmed head hand-over on Operations move
 * it to the successor and away from the person who handed it over.
 */
function seatOfPlacement(placement: Placement): FullAccessSeat | null {
  if (placement.role === "team-leader") return "team-leader";
  return placement.role === "head" ? (FLAGGED_HEAD_ROLES[placement.departmentId] ?? null) : null;
}

/** The flagged roles on `roster` as the hand-over screens read them (`HeldSeat`, issue #501): whoever heads a flagged department holds its seat. */
export function dummySeatsOf(roster: readonly RosterEntry[]): HeldSeat[] {
  return roster.flatMap((e): HeldSeat[] => {
    if (e.placement.role !== "head") return [];
    const seat = FLAGGED_HEAD_ROLES[e.placement.departmentId];
    return seat === undefined ? [] : [{ seat, personId: e.id, role: { kind: "head", departmentId: e.placement.departmentId } }];
  });
}

function personOf(id: number): DummyPerson {
  return people.find((p) => p.id === id)!;
}

function divisionOf(id: number) {
  return divisions.find((d) => d.id === id)!;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** An id for a row a test developer adds: it lives only in the page's state. */
function localId(): number {
  return randomInt(1_000_000, 2_000_000_000);
}

function accessDivision(id: number): AccessDivision {
  return { id, name: divisionOf(id).name };
}

/** The viewers an Access page is for: full access (the operations lead, issue #238), a head, a lead. */
export type AccessViewerKind = "operations-lead" | "division-lead" | "department-head";

/** A department and its divisions still open (`closed` are the ones the test developer closed, #232). */
function departmentUnit(departmentId: number, closed: ReadonlySet<number> = new Set()): AccessDepartmentUnit {
  return {
    department: departments.find((d) => d.id === departmentId)!,
    divisions: divisions
      .filter((d) => d.departmentId === departmentId && !closed.has(d.id))
      .map((d) => accessDivision(d.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** What a lead holds in their divisions ("Your access" on board 60): the same areas in each one they lead. */
function leadHeld(viewer: DummyPerson): readonly HeldAccess[] {
  // The role's own areas first (issue #591), then what they hold on top.
  const granted = UNIT_TARGETS.flatMap((target) =>
    heldAccess.filter((h) => h.personId === viewer.id && h.target === target).map((h) => ({ target, level: h.level })),
  );
  return mergeHeld(LEAD_ROLE_HELD_ACCESS, granted);
}

/**
 * The unit a viewer's Access page is about: the whole team for full access,
 * every open division a lead leads, home first (issue #185), a head's
 * department; null when their place is none of these.
 */
function unitOf(kind: AccessViewerKind, viewer: DummyPerson, closed: ReadonlySet<number>): AccessUnit | null {
  const placement = viewer.placement;
  if (kind === "operations-lead") {
    const byName = [...departments].sort((a, b) => a.name.localeCompare(b.name));
    return { kind: "team", departments: byName.map((d) => departmentUnit(d.id, closed)) };
  }
  if (kind === "division-lead") {
    const held = leadHeld(viewer);
    const [first, ...rest] = ledDivisionsOf(placement)
      .filter((id) => !closed.has(id))
      .map((id) => ({ division: accessDivision(id), held }));
    return first === undefined ? null : { kind: "division", divisions: [first, ...rest] };
  }
  if (placement.role === "head") return { kind: "department", ...departmentUnit(placement.departmentId, closed) };
  return null;
}

function unitDivisionIds(unit: AccessUnit): readonly number[] {
  switch (unit.kind) {
    case "division":
      return unit.divisions.map((d) => d.division.id);
    case "department":
      return unit.divisions.map((d) => d.id);
    case "team":
      return unit.departments.flatMap((d) => d.divisions.map((v) => v.id));
  }
}

/** Their memberships inside the unit, home division first (issue #229). */
function membershipsInUnit(entry: RosterEntry, unit: AccessUnit): readonly DivisionMembership[] {
  const ids = unitDivisionIds(unit);
  return homeFirst(membershipsIn(entry.placement)).filter((m) => ids.includes(m.divisionId));
}

/** Whether the unit's Access page holds them: on a team page everyone on the roster, else anyone in one of its divisions. */
function inUnit(entry: RosterEntry, unit: AccessUnit): boolean {
  return unit.kind === "team" || membershipsInUnit(entry, unit).length > 0;
}

/**
 * The person as the unit's Access page shows them: a lead when they lead a
 * division of the unit, named by the first division of the unit they lead,
 * else the first they are in. On a team page a head, a board seat and the
 * team leader stand as leads too: their access comes with the role.
 */
function accessPerson(entry: RosterEntry, unit: AccessUnit): AccessPerson {
  const memberships = membershipsInUnit(entry, unit);
  const shown = memberships.find((m) => m.role === "lead") ?? memberships[0];
  const [firstLed, ...moreLed] = memberships.filter((m) => m.role === "lead").map((m) => accessDivision(m.divisionId));
  // What their role gives on this page (issue #591), as the database side reads it.
  const seat = unit.kind === "team" ? seatOfPlacement(entry.placement) : null;
  const placement = entry.placement;
  const headed = unit.kind === "team" && placement.role === "head" ? unit.departments.find((d) => d.department.id === placement.departmentId) : undefined;
  // A head's and a seat's line under the name is their role's title as stored (issue #625).
  const headTitle = placement.role === "head" ? placement.title : "";
  const role: PersonRole =
    seat !== null
      ? { kind: "full", seat, title: seatLine(seat, headTitle) }
      : headed !== undefined
        ? { kind: "head", department: headed, title: headTitleOf(headTitle, headed.department.name) }
        : firstLed !== undefined
          ? { kind: "lead", divisions: [firstLed, ...moreLed] }
          : NO_ROLE;
  return {
    id: entry.id,
    name: entry.name,
    role,
    division: shown === undefined ? null : accessDivision(shown.divisionId),
  };
}

function placeOf(unit: AccessUnit, place: DummyPlace): AccessPlace | null {
  return (
    placesOf(unit).find((p) => {
      if ("wholeTeam" in place) return p.kind === "team";
      if ("divisionId" in place) return p.kind === "division" && p.division.id === place.divisionId;
      return p.kind === "department" && p.department.id === place.departmentId;
    }) ?? null
  );
}

/** "Approve orders" on a team page: who holds it, and whether the viewer gives it; nothing on a lead's or head's. */
function approveOrdersOf(
  viewer: DummyPerson,
  unit: AccessUnit,
  onTeam: ReadonlyMap<number, AccessPerson>,
  holders: readonly ApproveOrdersHolding[],
): ApproveOrdersAccess {
  if (unit.kind !== "team") return NO_APPROVE_ORDERS;
  const canGive = canGiveApproveOrders(seatOfPlacement(viewer.placement));
  return {
    canGive,
    yours: canGive || holders.some((h) => h.personId === viewer.id),
    holders: holders.flatMap((h) => {
      const person = onTeam.get(h.personId);
      if (person === undefined) return [];
      return [{ person, givenBy: viewer.id === TEAM_LEADER_ID ? "You" : personOf(TEAM_LEADER_ID).name, givenOn: h.givenOn }];
    }),
  };
}

/**
 * Boards 60 and 60b for a lead, 65 and 65b for a head; null for anyone else.
 * Only people on `roster` hold access: a grant to someone moved to alumni is
 * gone. The other leads of the unit show with the access their role gives,
 * one row for each division of the unit they lead.
 */
export function dummyAccessPage(
  kind: AccessViewerKind,
  viewer: DummyPerson,
  roster: readonly RosterEntry[],
  closed: ReadonlySet<number> = new Set(),
  holders: readonly ApproveOrdersHolding[] = approveOrdersHolders,
): AccessPage | null {
  const unit = unitOf(kind, viewer, closed);
  if (unit === null) return null;
  const inside = roster.filter((e) => e.id !== viewer.id && inUnit(e, unit));
  const onTeam = new Map(inside.map((e) => [e.id, accessPerson(e, unit)]));
  // A full-access seat covers the whole team on a team page (board 71), read off the role they hold now (issue #501); a head's their department; a lead each division they lead.
  const roleAccess = inside.flatMap((e) => roleAccessOf(onTeam.get(e.id)!));
  const grants = accessGrants.flatMap((g): AccessGrant[] => {
    const person = onTeam.get(g.personId);
    const place = placeOf(unit, g.place);
    // A lead's or head's grants show beside their role row (issue #591); never an area their role gives.
    if (person === undefined || place === null || roleCovers(person, place, g.target)) return [];
    return [
      {
        id: g.id,
        person,
        place,
        target: g.target,
        level: g.level,
        givenBy: g.givenById === viewer.id ? "You" : personOf(g.givenById).name,
        givenOn: g.givenOn,
      },
    ];
  });
  // Full access first (board 71), then the heads and the leads.
  const ordered = [...roleAccess].sort((a, b) => Number(b.place.kind === "team") - Number(a.place.kind === "team"));
  return {
    unit,
    roleAccess: ordered,
    grants,
    people: [...onTeam.values()],
    approveOrders: approveOrdersOf(viewer, unit, onTeam, holders),
  };
}

/**
 * A checked Save: the person's grants as they would read, and the "Approve
 * orders" change it carries, which the caller keeps (issue #270).
 */
export type DummyAccessSave = {
  readonly grants: readonly AccessGrant[];
  readonly approveOrders: ApproveOrdersChange | null;
};

/**
 * Checks a Give access or Edit access Save as the database side does and
 * answers the person's grants as they would read. An area left as it was
 * keeps its grant; a new or changed one is given by "You" today. A grant
 * given on the page lives only in the page's state, so the check runs
 * against the stored grants alone; only "Approve orders" is handed back to
 * be kept, since the person's own pages read it.
 */
export function dummySaveAccess(
  kind: AccessViewerKind,
  viewer: DummyPerson,
  roster: readonly RosterEntry[],
  input: unknown,
  closed: ReadonlySet<number> = new Set(),
  holders: readonly ApproveOrdersHolding[] = approveOrdersHolders,
): WriteResult<DummyAccessSave> {
  const access = dummyAccessPage(kind, viewer, roster, closed, holders);
  if (access === null) return refused("Only a division lead or a department head gives access here.");
  const checked = checkSaveAccess(access, input);
  if (!checked.ok) return refused(checked.error);
  const { personId, place, changes, approveOrders } = checked.value;
  const person = access.people.find((p) => p.id === personId)!;
  const kept = access.grants.filter(
    (g) => g.person.id === personId && !(samePlace(g.place, place) && changes.some((c) => c.target === g.target)),
  );
  const givenOn = today();
  // Ids rise in area order, as one database insert's do, so the chips read in that order.
  const first = localId();
  const given = changes
    .flatMap((c) => (c.kind === "remove" ? [] : [c]))
    .map((c, i): AccessGrant => ({ id: first + i, person, place, target: c.target, level: c.to, givenBy: "You", givenOn }));
  return written({ grants: [...kept, ...given], approveOrders });
}

/**
 * Checks Remove all access as the database side does. It answers the
 * "Approve orders" removal it carries for the caller to keep, or null.
 */
export function dummyRemoveAllAccess(
  kind: AccessViewerKind,
  viewer: DummyPerson,
  roster: readonly RosterEntry[],
  personId: number,
  closed: ReadonlySet<number> = new Set(),
  holders: readonly ApproveOrdersHolding[] = approveOrdersHolders,
): WriteResult<ApproveOrdersChange | null> {
  const access = dummyAccessPage(kind, viewer, roster, closed, holders);
  if (access === null) return refused("Only a division lead or a department head removes access here.");
  const checked = checkRemoveAllAccess(access, personId);
  if (!checked.ok) return refused(checked.error);
  return written(checked.value.find((w) => w.approveOrders !== null)?.approveOrders ?? null);
}

/**
 * Checks Remove on one grant as the database side does (issue #483) and
 * answers the person's grants as they would read: every one but the removed
 * area in that place. As with a Save, the check runs against the stored grants.
 */
export function dummyRemoveGrant(
  kind: AccessViewerKind,
  viewer: DummyPerson,
  roster: readonly RosterEntry[],
  input: unknown,
  closed: ReadonlySet<number> = new Set(),
  holders: readonly ApproveOrdersHolding[] = approveOrdersHolders,
): WriteResult<readonly AccessGrant[]> {
  const access = dummyAccessPage(kind, viewer, roster, closed, holders);
  if (access === null) return refused("Only a division lead or a department head removes access here.");
  const checked = checkRemoveGrant(access, input);
  if (!checked.ok) return refused(checked.error);
  const { personId, place, changes } = checked.value;
  return written(access.grants.filter((g) => g.person.id === personId && !(samePlace(g.place, place) && changes.some((c) => c.target === g.target))));
}

