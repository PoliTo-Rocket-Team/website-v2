import { z } from "zod";

// The Access page (boards 60, 60b, 60c and 60m for a division lead, issues
// #145 and #213; boards 65, 65b and 65m for a department head, issue #230):
// what the viewer may do in their unit, who holds access there with their
// role, who the viewer shared it with, and the Give access and Edit access
// rules. Each person holds each area at one level or not at all, in each
// place: one division, or a whole department. A viewer shares only what they
// hold, never more than they hold it, and only inside their own unit: a lead
// who can view Members cannot give anyone edit on Members, and a head gives
// nothing outside their department. Access that comes with a lead role is
// shown locked and never changes here.

/** The areas a grant opens: the `scopes.target` values a lead or head shares. */
export const ACCESS_TARGETS = ["positions", "applications", "members", "orders"] as const;
export type AccessTarget = (typeof ACCESS_TARGETS)[number];

export const ACCESS_TARGET_LABELS: Readonly<Record<AccessTarget, string>> = {
  positions: "Positions",
  applications: "Applications",
  members: "Members",
  orders: "Orders",
};

/** `scopes.access_level`: the two levels, on every area alike. */
export const ACCESS_LEVELS = ["view", "edit"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_LEVEL_LABELS: Readonly<Record<AccessLevel, string>> = {
  view: "Can view",
  edit: "Can edit",
};

/** The level on a phone card under "Your access" (board 60m): "View", "Edit". */
export const ACCESS_LEVEL_SHORT_LABELS: Readonly<Record<AccessLevel, string>> = {
  view: "View",
  edit: "Edit",
};

/** What Can view and Can edit open, as the drawers say it (boards 60b and 60c). */
export const ACCESS_LEVELS_EXPLAINED =
  "Can view lets them see an area. Can edit also lets them change it: edit positions, move and decide applications, update members, or request orders.";

/** The level held on each area; an area left out is not held. */
export type AreaLevels = Readonly<Partial<Record<AccessTarget, AccessLevel>>>;

export type AccessDivision = {
  readonly id: number;
  /** "Mission Analysis Division" */
  readonly name: string;
};

export type AccessDepartment = {
  readonly id: number;
  /** "Aerodynamics" */
  readonly name: string;
};

/** "Mission Analysis Division" reads "Mission Analysis" in a table cell. */
export function shortUnitName(name: string): string {
  return name.replace(/\s+Division$/, "");
}

/** "Aerodynamics" reads "Aerodynamics Department". */
export function departmentName(department: AccessDepartment): string {
  return /\bDepartment$/.test(department.name) ? department.name : `${department.name} Department`;
}

/**
 * The unit an Access page is about: a lead's division, or a head's
 * department with its open divisions, in the order its tabs show them.
 */
export type AccessUnit =
  | { readonly kind: "division"; readonly division: AccessDivision }
  | { readonly kind: "department"; readonly department: AccessDepartment; readonly divisions: readonly AccessDivision[] };

/** Where a grant applies: one division, or a whole department (a `scopes` row with only `dept_id` set). */
export type AccessPlace =
  | { readonly kind: "division"; readonly division: AccessDivision }
  | { readonly kind: "department"; readonly department: AccessDepartment };

/** The places a viewer gives access in: their division; or their whole department, then each of its divisions. */
export function placesOf(unit: AccessUnit): AccessPlace[] {
  if (unit.kind === "division") return [{ kind: "division", division: unit.division }];
  return [
    { kind: "department", department: unit.department },
    ...unit.divisions.map((division): AccessPlace => ({ kind: "division", division })),
  ];
}

/** The place Give access starts on: the lead's division, the head's whole department. */
export function homePlace(unit: AccessUnit): AccessPlace {
  return placesOf(unit)[0];
}

/** What the drawers send for a place: "department", or the division's id. */
export type PlaceKey = "department" | number;

export function placeKey(place: AccessPlace): PlaceKey {
  return place.kind === "department" ? "department" : place.division.id;
}

export function samePlace(a: AccessPlace, b: AccessPlace): boolean {
  return placeKey(a) === placeKey(b);
}

/** "Mission Analysis Division", or "Aerodynamics Department, all divisions" under an area in a drawer. */
export function placeLine(place: AccessPlace): string {
  return place.kind === "division" ? place.division.name : `${departmentName(place.department)}, all divisions`;
}

/** The unit as "Your access" names it (boards 60 and 65). */
export function unitLine(unit: AccessUnit): string {
  return placeLine(homePlace(unit));
}

/** One area the viewer holds in their unit (a chip under "Your access"). */
export type HeldAccess = {
  readonly target: AccessTarget;
  readonly level: AccessLevel;
};

/** A head's role holds every area at Can edit across their department (board 65). */
export const ROLE_HELD_ACCESS: readonly HeldAccess[] = ACCESS_TARGETS.map((target) => ({ target, level: "edit" }));

/** A lead or head of the unit, whose access comes with the role, or anyone else in it. */
export const PERSON_STANDINGS = ["lead", "member"] as const;
export type PersonStanding = (typeof PERSON_STANDINGS)[number];

export const PERSON_STANDING_LABELS: Readonly<Record<PersonStanding, string>> = {
  lead: "Lead",
  member: "Member",
};

export type AccessPerson = {
  readonly id: number;
  readonly name: string;
  readonly standing: PersonStanding;
  /** The division they are in; null for someone placed in none, such as another head. */
  readonly division: AccessDivision | null;
};

/** One stored grant: one person, one area, one level, in one place, and who gave it. */
export type AccessGrant = {
  readonly id: number;
  readonly person: AccessPerson;
  readonly place: AccessPlace;
  readonly target: AccessTarget;
  readonly level: AccessLevel;
  /** "You" when the viewer gave it, else the giver's name; null when nobody is on record. */
  readonly givenBy: string | null;
  /** ISO date; null when no date is on record. */
  readonly givenOn: string | null;
};

/**
 * A lead's or co-lead's access, which comes with their role (boards 60 and
 * 65): every area at Can edit in their whole division, shown "With the role"
 * and locked. It is no grant, so nothing on the page changes it.
 */
export type RoleAccess = {
  readonly person: AccessPerson;
  readonly place: AccessPlace;
};

export type AccessPage = {
  readonly unit: AccessUnit;
  readonly held: readonly HeldAccess[];
  /** The other leads of the unit, never the viewer (issue #230). */
  readonly roleAccess: readonly RoleAccess[];
  /** Grants to people who are not leads; a lead's access is in `roleAccess`. */
  readonly grants: readonly AccessGrant[];
  /** The people in the unit the viewer can give access to: everyone but the viewer. */
  readonly people: readonly AccessPerson[];
};

/** One row of the table (board 60): a person, their areas in the order given, and the latest giver. */
export type PersonAccess = {
  readonly person: AccessPerson;
  readonly grants: readonly AccessGrant[];
  readonly givenBy: string | null;
  readonly givenOn: string | null;
};

/** The grants grouped one row per person, people in the order they first appear. */
export function accessByPerson(grants: readonly AccessGrant[]): PersonAccess[] {
  const order: number[] = [];
  const byPerson = new Map<number, AccessGrant[]>();
  for (const grant of grants) {
    const mine = byPerson.get(grant.person.id);
    if (mine === undefined) {
      order.push(grant.person.id);
      byPerson.set(grant.person.id, [grant]);
    } else {
      mine.push(grant);
    }
  }
  return order.map((id) => {
    const mine = [...byPerson.get(id)!].sort((a, b) => a.id - b.id);
    const latest = mine[mine.length - 1];
    return { person: latest.person, grants: mine, givenBy: latest.givenBy, givenOn: latest.givenOn };
  });
}

/** What a person holds now in one place, area by area. */
export function areaLevelsOf(grants: readonly AccessGrant[], personId: number, place: AccessPlace): AreaLevels {
  const levels: Partial<Record<AccessTarget, AccessLevel>> = {};
  for (const g of grants) {
    if (g.person.id === personId && samePlace(g.place, place)) levels[g.target] = levels[g.target] === "edit" ? "edit" : g.level;
  }
  return levels;
}

/** The places a person holds any grant in, in the order of `placesOf`. */
export function placesHeldBy(unit: AccessUnit, grants: readonly AccessGrant[], personId: number): AccessPlace[] {
  return placesOf(unit).filter((place) => grants.some((g) => g.person.id === personId && samePlace(g.place, place)));
}

/** The highest level the viewer holds on an area, or null. */
export function heldLevel(held: readonly HeldAccess[], target: AccessTarget): AccessLevel | null {
  const levels = held.filter((h) => h.target === target).map((h) => h.level);
  if (levels.includes("edit")) return "edit";
  return levels.includes("view") ? "view" : null;
}

/** Whether the viewer holds `target` at `level` or above. */
function reaches(held: readonly HeldAccess[], target: AccessTarget, level: AccessLevel): boolean {
  const have = heldLevel(held, target);
  return have !== null && (level === "view" || have === "edit");
}

/**
 * What the viewer may do with one area of one person's access in a drawer:
 * nothing when the person is a lead, the viewer does not hold the area, or
 * the person holds it above the viewer; else tick or untick it, up to `highest`.
 */
export type AreaRule = { readonly changeable: false } | { readonly changeable: true; readonly highest: AccessLevel };

export function areaRule(held: readonly HeldAccess[], person: AccessPerson, target: AccessTarget, current: AccessLevel | null): AreaRule {
  const highest = heldLevel(held, target);
  if (person.standing === "lead" || highest === null) return { changeable: false };
  if (current !== null && !reaches(held, target, current)) return { changeable: false };
  return { changeable: true, highest };
}

/** Whether the viewer may change anything of this person's access in one place. */
export function canChangePerson(held: readonly HeldAccess[], person: AccessPerson, current: AreaLevels): boolean {
  return ACCESS_TARGETS.some((t) => areaRule(held, person, t, current[t] ?? null).changeable);
}

/** One change to one area of a person's access. */
export type AccessChange =
  | { readonly kind: "add"; readonly target: AccessTarget; readonly to: AccessLevel }
  | { readonly kind: "change"; readonly target: AccessTarget; readonly from: AccessLevel; readonly to: AccessLevel }
  | { readonly kind: "remove"; readonly target: AccessTarget; readonly from: AccessLevel };

/** The changes that take a person from `current` to `next`, area by area. */
export function accessChanges(current: AreaLevels, next: AreaLevels): AccessChange[] {
  return ACCESS_TARGETS.flatMap((target): AccessChange[] => {
    const from = current[target];
    const to = next[target];
    if (from === to) return [];
    if (from === undefined) return to === undefined ? [] : [{ kind: "add", target, to }];
    if (to === undefined) return [{ kind: "remove", target, from }];
    return [{ kind: "change", target, from, to }];
  });
}

/** The viewer's delegation limit on one change: the area is theirs to touch, at both ends, and never a lead's. */
function allowed(held: readonly HeldAccess[], person: AccessPerson, change: AccessChange): boolean {
  if (person.standing === "lead") return false;
  const from = change.kind === "add" ? null : change.from;
  const to = change.kind === "remove" ? null : change.to;
  return (from === null || reaches(held, change.target, from)) && (to === null || reaches(held, change.target, to));
}

/**
 * What the Give access and Edit access drawers send: the person's areas in
 * one place as they should be. `where` is left out on a lead's page: their
 * division is the only place.
 */
export type SaveAccess = {
  readonly personId: number;
  readonly where?: PlaceKey;
  readonly areas: AreaLevels;
};

/** A checked write: the person, the place, and the changes to make there, each within the viewer's limit. */
export type AccessWrite = {
  readonly personId: number;
  readonly place: AccessPlace;
  readonly changes: readonly AccessChange[];
};

const level = z.enum(ACCESS_LEVELS).optional();
const saveAccessSchema = z.object({
  personId: z.number().int().positive(),
  where: z.union([z.literal("department"), z.number().int().positive()]).optional(),
  areas: z.strictObject({ positions: level, applications: level, members: level, orders: level }),
});

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

type AccessFacts = Pick<AccessPage, "unit" | "held" | "people" | "grants">;

function outsideUnit(unit: AccessUnit): string {
  return unit.kind === "division"
    ? "You can give access only to people in your division."
    : "You can give access only to people in your department.";
}

function checkChanges(access: AccessFacts, personId: number, place: AccessPlace, next: AreaLevels): Checked<AccessWrite> {
  const person = access.people.find((p) => p.id === personId);
  if (person === undefined) return { ok: false, error: outsideUnit(access.unit) };
  const changes = accessChanges(areaLevelsOf(access.grants, personId, place), next);
  if (!changes.every((c) => allowed(access.held, person, c))) {
    return { ok: false, error: "You can only give or change access you have, up to your own level." };
  }
  return { ok: true, value: { personId, place, changes } };
}

/**
 * Checks a Give access or Edit access Save from the browser against what the
 * viewer holds, who is in their unit, and where they may give access: their
 * division, or their department or one of its divisions. The person's areas
 * in that place become exactly `areas`; every add, level change and removal
 * that takes must be within the viewer's own level, and a lead's access is
 * never touched. Every rule runs on the server: the drawer's own limits are
 * a convenience, not the check.
 */
export function checkSaveAccess(access: AccessFacts, input: unknown): Checked<AccessWrite> {
  const parsed = saveAccessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the form." };
  const where = parsed.data.where;
  const place = where === undefined ? homePlace(access.unit) : placesOf(access.unit).find((p) => placeKey(p) === where);
  if (place === undefined) return { ok: false, error: `You can give access only inside your ${access.unit.kind}.` };
  const areas: Partial<Record<AccessTarget, AccessLevel>> = {};
  for (const target of ACCESS_TARGETS) {
    const chosen = parsed.data.areas[target];
    if (chosen !== undefined) areas[target] = chosen;
  }
  if (Object.keys(areas).length === 0) return { ok: false, error: "Choose at least one area." };
  return checkChanges(access, parsed.data.personId, place, areas);
}

/** Checks Remove all access: every area the person holds, in every place of the unit, goes, each within the viewer's limit. */
export function checkRemoveAllAccess(access: AccessFacts, personId: unknown): Checked<readonly AccessWrite[]> {
  if (typeof personId !== "number" || !Number.isSafeInteger(personId)) return { ok: false, error: "Unknown person." };
  if (!access.people.some((p) => p.id === personId)) return { ok: false, error: outsideUnit(access.unit) };
  const writes: AccessWrite[] = [];
  for (const place of placesHeldBy(access.unit, access.grants, personId)) {
    const checked = checkChanges(access, personId, place, {});
    if (!checked.ok) return checked;
    writes.push(checked.value);
  }
  return { ok: true, value: writes };
}
