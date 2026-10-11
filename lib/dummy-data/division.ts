import { randomInt } from "node:crypto";
import {
  checkRemoveAllAccess,
  checkSaveAccess,
  placesOf,
  ROLE_HELD_ACCESS,
  samePlace,
  ACCESS_TARGETS,
  type AccessDivision,
  type AccessGrant,
  type AccessLevel,
  type AccessPage,
  type AccessPerson,
  type AccessPlace,
  type AccessTarget,
  type AccessUnit,
  type HeldAccess,
  type RoleAccess,
} from "@/lib/dashboard/division-access";
import { homeFirst, ledDivisionOf, membershipsIn, type DivisionMembership, type RosterEntry } from "@/lib/dashboard/team";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import { departments, divisions, people, type DummyPerson } from "./team";

// The Access pages for the test developer (boards 60 to 60m, issues #145 and
// #213; the department head's Access, boards 65 and 65b, issue #230); their
// Orders page is ./orders.ts. The division lead is Marco Bianchi, Mission Analysis, who leads
// it with Pietro Ricci; the department head is Chiara Rinaldi, Aerodynamics.
// The people come from the roster as the test developer left it
// (./team-pages.ts), so someone moved to alumni has no access here any more.

export type DummyHeldAccess = {
  readonly personId: number;
  readonly target: AccessTarget;
  readonly level: AccessLevel;
};

/** What each lead holds in their own division ("Your access" on board 60). */
export const heldAccess = [
  { personId: 2, target: "positions", level: "edit" },
  { personId: 2, target: "applications", level: "edit" },
  { personId: 2, target: "members", level: "edit" },
  { personId: 2, target: "orders", level: "edit" },
] as const satisfies readonly DummyHeldAccess[];

/** Where a grant applies: one division, or a whole department. */
export type DummyPlace = { readonly divisionId: number } | { readonly departmentId: number };

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
 * head gave across the whole department.
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
] as const satisfies readonly DummyGrant[];

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

/** The viewers an Access page is for. */
export type AccessViewerKind = "division-lead" | "department-head";

/**
 * The unit a viewer's Access page is about: a lead's division, a head's
 * department; null when their place is neither. A lead of several divisions
 * gets the oldest they lead until #185 gives them all.
 */
function unitOf(kind: AccessViewerKind, viewer: DummyPerson, closed: ReadonlySet<number>): AccessUnit | null {
  const placement = viewer.placement;
  if (kind === "division-lead") {
    const divisionId = ledDivisionOf(placement);
    return divisionId === null ? null : { kind: "division", division: accessDivision(divisionId) };
  }
  if (placement.role === "head") {
    const department = departments.find((d) => d.id === placement.departmentId)!;
    return {
      kind: "department",
      department,
      divisions: divisions
        .filter((d) => d.departmentId === department.id && !closed.has(d.id))
        .map((d) => accessDivision(d.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
  return null;
}

function unitDivisionIds(unit: AccessUnit): readonly number[] {
  return unit.kind === "division" ? [unit.division.id] : unit.divisions.map((d) => d.id);
}

/** Their memberships inside the unit, home division first (issue #229). */
function membershipsInUnit(entry: RosterEntry, unit: AccessUnit): readonly DivisionMembership[] {
  const ids = unitDivisionIds(unit);
  return homeFirst(membershipsIn(entry.placement)).filter((m) => ids.includes(m.divisionId));
}

/**
 * The person as the unit's Access page shows them: a lead when they lead a
 * division of the unit, named by the first division of the unit they lead,
 * else the first they are in.
 */
function accessPerson(entry: RosterEntry, unit: AccessUnit): AccessPerson {
  const inUnit = membershipsInUnit(entry, unit);
  const shown = inUnit.find((m) => m.role === "lead") ?? inUnit[0];
  return {
    id: entry.id,
    name: entry.name,
    standing: shown?.role === "lead" ? "lead" : "member",
    division: shown === undefined ? null : accessDivision(shown.divisionId),
  };
}

function placeOf(unit: AccessUnit, place: DummyPlace): AccessPlace | null {
  return placesOf(unit).find((p) =>
    "divisionId" in place ? p.kind === "division" && p.division.id === place.divisionId : p.kind === "department" && p.department.id === place.departmentId,
  ) ?? null;
}

function heldBy(viewer: DummyPerson, unit: AccessUnit): readonly HeldAccess[] {
  if (unit.kind === "department") return ROLE_HELD_ACCESS;
  return ACCESS_TARGETS.flatMap((target) =>
    heldAccess.filter((h) => h.personId === viewer.id && h.target === target).map((h) => ({ target, level: h.level })),
  );
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
): AccessPage | null {
  const unit = unitOf(kind, viewer, closed);
  if (unit === null) return null;
  const inside = roster.filter((e) => e.id !== viewer.id && membershipsInUnit(e, unit).length > 0);
  const onTeam = new Map(inside.map((e) => [e.id, accessPerson(e, unit)]));
  const roleAccess = inside.flatMap((e): RoleAccess[] => {
    const person = onTeam.get(e.id)!;
    return membershipsInUnit(e, unit)
      .filter((m) => m.role === "lead")
      .map((m) => ({ person, place: { kind: "division", division: accessDivision(m.divisionId) } }));
  });
  const grants = accessGrants.flatMap((g): AccessGrant[] => {
    const person = onTeam.get(g.personId);
    const place = placeOf(unit, g.place);
    if (person === undefined || person.standing === "lead" || place === null) return [];
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
  return { unit, held: heldBy(viewer, unit), roleAccess, grants, people: [...onTeam.values()] };
}

/**
 * Checks a Give access or Edit access Save as the database side does and
 * answers the person's grants as they would read; nothing is stored. An area
 * left as it was keeps its grant; a new or changed one is given by "You"
 * today. A grant given on the page lives only in the page's state, so the
 * check runs against the stored grants alone.
 */
export function dummySaveAccess(
  kind: AccessViewerKind,
  viewer: DummyPerson,
  roster: readonly RosterEntry[],
  input: unknown,
  closed: ReadonlySet<number> = new Set(),
): WriteResult<readonly AccessGrant[]> {
  const access = dummyAccessPage(kind, viewer, roster, closed);
  if (access === null) return refused("Only a division lead or a department head gives access here.");
  const checked = checkSaveAccess(access, input);
  if (!checked.ok) return refused(checked.error);
  const { personId, place, changes } = checked.value;
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
  return written([...kept, ...given]);
}

/** Checks Remove all access as the database side does; nothing is stored. */
export function dummyRemoveAllAccess(
  kind: AccessViewerKind,
  viewer: DummyPerson,
  roster: readonly RosterEntry[],
  personId: number,
  closed: ReadonlySet<number> = new Set(),
): WriteResult<null> {
  const access = dummyAccessPage(kind, viewer, roster, closed);
  if (access === null) return refused("Only a division lead or a department head removes access here.");
  const checked = checkRemoveAllAccess(access, personId);
  return checked.ok ? written(null) : refused(checked.error);
}

