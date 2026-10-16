import { z } from "zod";
import { checkApproveOrdersChange, type ApproveOrdersChange } from "./orders";
import type { FullAccessSeat } from "./viewer";

// The Access page (boards 60, 60b, 60c and 60m for a division lead, issues
// #145 and #213; boards 65, 65b and 65m for a department head, issue #230;
// the same page across the whole team for full access, issue #238):
// what the viewer may do in their unit, who holds access there with their
// role, who the viewer shared it with, and the Give access and Edit access
// rules. Each person holds each area at one level or not at all, in each
// place: one division, a whole department, or (from full access, issue #247)
// the whole team. A viewer shares only what they hold, never more than they
// hold it, and only inside their own unit: a lead who can view Members cannot
// give anyone edit on Members, and a head gives nothing outside their
// department. Access that comes with a role is shown locked and never changes
// here. The team leader's page adds Alumni and "Approve orders" (boards 71
// and 71b, issue #247).

/** The areas a lead or head shares inside their unit: the `scopes.target` values of a division or department grant. */
export const UNIT_TARGETS = ["positions", "applications", "members", "orders"] as const;
export type UnitTarget = (typeof UNIT_TARGETS)[number];

/**
 * Every area the Access page gives, in board 71b's order: the unit areas and
 * Alumni, which is site-content access (#234). Alumni has no unit: it is
 * given across the whole team or not at all.
 */
export const ACCESS_TARGETS = ["positions", "applications", "members", "alumni", "orders"] as const;
export type AccessTarget = (typeof ACCESS_TARGETS)[number];

export const ACCESS_TARGET_LABELS: Readonly<Record<AccessTarget, string>> = {
  positions: "Positions",
  applications: "Applications",
  members: "Members",
  alumni: "Alumni",
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

/** A department with its open divisions, in the order its tabs show them. */
export type AccessDepartmentUnit = {
  readonly department: AccessDepartment;
  readonly divisions: readonly AccessDivision[];
};

/**
 * The unit an Access page is about: a lead's division, a head's department
 * with its open divisions, or, with full access (issue #238), the whole team:
 * every open department with its open divisions, by name.
 */
export type AccessUnit =
  | { readonly kind: "division"; readonly division: AccessDivision }
  | ({ readonly kind: "department" } & AccessDepartmentUnit)
  | { readonly kind: "team"; readonly departments: readonly AccessDepartmentUnit[] };

/**
 * Where a grant applies: one division, a whole department (a `scopes` row
 * with only `dept_id` set), or, given from full access, the whole team (a
 * `team` row in no unit, issue #247), every department and any added later.
 */
export type AccessPlace =
  | { readonly kind: "division"; readonly division: AccessDivision }
  | { readonly kind: "department"; readonly department: AccessDepartment }
  | { readonly kind: "team" };

/** The whole team as a place. */
export const WHOLE_TEAM_PLACE = { kind: "team" } as const satisfies AccessPlace;

/** The areas a place offers: every area across the whole team, the unit areas in a department or a division. */
export function targetsAt(place: AccessPlace): readonly AccessTarget[] {
  return place.kind === "team" ? ACCESS_TARGETS : UNIT_TARGETS;
}

function departmentPlaces(unit: AccessDepartmentUnit): AccessPlace[] {
  return [
    { kind: "department", department: unit.department },
    ...unit.divisions.map((division): AccessPlace => ({ kind: "division", division })),
  ];
}

/**
 * The places a viewer gives access in: their division; or their whole
 * department, then each of its divisions; or, from full access, the whole
 * team, then each department in turn, whole and then each of its divisions
 * (board 71b).
 */
export function placesOf(unit: AccessUnit): AccessPlace[] {
  switch (unit.kind) {
    case "division":
      return [{ kind: "division", division: unit.division }];
    case "department":
      return departmentPlaces(unit);
    case "team":
      return [WHOLE_TEAM_PLACE, ...unit.departments.flatMap(departmentPlaces)];
  }
}

/** The place Give access starts on: the lead's division, the head's whole department, the whole team from full access. */
export function homePlace(unit: AccessUnit): AccessPlace {
  return placesOf(unit)[0];
}

/** The department a place is in on a team page (issue #238); null when the unit is not the team or holds no such place. */
export function departmentOfPlace(unit: AccessUnit, place: AccessPlace): AccessDepartment | null {
  if (unit.kind !== "team" || place.kind === "team") return null;
  const found = unit.departments.find((d) =>
    place.kind === "department" ? d.department.id === place.department.id : d.divisions.some((v) => v.id === place.division.id),
  );
  return found?.department ?? null;
}

/** What the drawers send for a place: "team", "department-<id>", or the division's id. */
export type PlaceKey = "team" | `department-${number}` | number;

export function placeKey(place: AccessPlace): PlaceKey {
  switch (place.kind) {
    case "team":
      return "team";
    case "department":
      return `department-${place.department.id}`;
    case "division":
      return place.division.id;
  }
}

export function samePlace(a: AccessPlace, b: AccessPlace): boolean {
  return placeKey(a) === placeKey(b);
}

/** "Mission Analysis Division", "Aerodynamics Department, all divisions" or "Whole team" under an area in a drawer. */
export function placeLine(place: AccessPlace): string {
  switch (place.kind) {
    case "team":
      return "Whole team";
    case "department":
      return `${departmentName(place.department)}, all divisions`;
    case "division":
      return place.division.name;
  }
}

/** The unit as "Your access" names it (boards 60 and 65): on a team page, "the whole team". */
export function unitLine(unit: AccessUnit): string {
  return unit.kind === "team" ? "the whole team" : placeLine(homePlace(unit));
}

/** One area the viewer holds in their unit (a chip under "Your access"). */
export type HeldAccess = {
  readonly target: AccessTarget;
  readonly level: AccessLevel;
};

/** A head's role holds every unit area at Can edit across their department (board 65). */
export const ROLE_HELD_ACCESS: readonly HeldAccess[] = UNIT_TARGETS.map((target) => ({ target, level: "edit" }));

/** Full access holds every area at Can edit across the team (issue #238), Alumni included (#234, board 71). */
export const FULL_HELD_ACCESS: readonly HeldAccess[] = ACCESS_TARGETS.map((target) => ({ target, level: "edit" }));

/** Whether `held` is every area at Can edit: "Your access" then reads "Every area · Can edit" (board 71). */
export function holdsEveryArea(held: readonly HeldAccess[]): boolean {
  return ACCESS_TARGETS.every((target) => heldLevel(held, target) === "edit");
}

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
 * Access that comes with a role, shown "With the role" and locked: a lead's
 * or co-lead's whole division, a head's whole department (boards 60 and 65),
 * or, on a team page, a full-access seat's whole team (board 71, issue #247).
 * It is no grant, so nothing on the page changes it.
 */
export type RoleAccess =
  | { readonly person: AccessPerson; readonly place: Exclude<AccessPlace, { kind: "team" }> }
  | { readonly person: AccessPerson; readonly place: { readonly kind: "team" }; readonly seat: FullAccessSeat };

/** The seat under a full-access person's name (board 71): "Operations lead", "IT lead". */
export const SEAT_LABELS: Readonly<Record<FullAccessSeat, string>> = {
  "team-leader": "Team leader",
  "operations-lead": "Operations lead",
  "it-lead": "IT lead",
};

/**
 * Only the team leader gives or removes "Approve orders" (issue #233): the
 * checkbox renders for them alone (board 71b), and the server refuses it from
 * anyone else (`checkApproveOrdersChange`, ./orders.ts).
 */
export function canGiveApproveOrders(seat: FullAccessSeat | null): boolean {
  return seat === "team-leader";
}

/** Someone the team leader gave "Approve orders", with who gave it and when. */
export type ApproveOrdersHolder = {
  readonly person: AccessPerson;
  /** "You" when the viewer gave it, else the giver's name; null when nobody is on record. */
  readonly givenBy: string | null;
  /** ISO date; null when no date is on record. */
  readonly givenOn: string | null;
};

/** "Approve orders" on an Access page (boards 71 and 71b). */
export type ApproveOrdersAccess = {
  /** Whether the viewer gives and removes it (`canGiveApproveOrders`). */
  readonly canGive: boolean;
  /** Whether the viewer decides orders: "Your access" carries the chip. */
  readonly yours: boolean;
  /** Who holds it; listed on a team page only. */
  readonly holders: readonly ApproveOrdersHolder[];
};

/** A lead's or head's page: "Approve orders" is not theirs to see or give. */
export const NO_APPROVE_ORDERS: ApproveOrdersAccess = { canGive: false, yours: false, holders: [] };

export type AccessPage = {
  readonly unit: AccessUnit;
  readonly held: readonly HeldAccess[];
  /** The other leads of the unit, never the viewer (issue #230). */
  readonly roleAccess: readonly RoleAccess[];
  /** Grants to people who are not leads; a lead's access is in `roleAccess`. */
  readonly grants: readonly AccessGrant[];
  /** The people in the unit the viewer can give access to: everyone but the viewer. */
  readonly people: readonly AccessPerson[];
  /** "Approve orders": who holds it, and whether the viewer gives it (board 71). */
  readonly approveOrders: ApproveOrdersAccess;
};

/** One row of the table (boards 60 and 71): a person, "Approve orders" when they hold it, their areas in the order given, and the latest giver. */
export type PersonAccess = {
  readonly person: AccessPerson;
  readonly approveOrders: boolean;
  readonly grants: readonly AccessGrant[];
  readonly givenBy: string | null;
  readonly givenOn: string | null;
};

/**
 * The grants and the "Approve orders" holders grouped one row per person,
 * people in the order they first appear, holders first. A row's giver is
 * whoever gave its newest grant, else "Approve orders".
 */
export function accessByPerson(grants: readonly AccessGrant[], holders: readonly ApproveOrdersHolder[] = []): PersonAccess[] {
  const order: number[] = [];
  const byPerson = new Map<number, AccessGrant[]>();
  const add = (id: number) => {
    if (!byPerson.has(id)) {
      order.push(id);
      byPerson.set(id, []);
    }
  };
  for (const holder of holders) add(holder.person.id);
  for (const grant of grants) {
    add(grant.person.id);
    byPerson.get(grant.person.id)!.push(grant);
  }
  return order.map((id) => {
    const mine = [...byPerson.get(id)!].sort((a, b) => a.id - b.id);
    const holder = holders.find((h) => h.person.id === id);
    const latest = mine[mine.length - 1] ?? holder!;
    return { person: latest.person, approveOrders: holder !== undefined, grants: mine, givenBy: latest.givenBy, givenOn: latest.givenOn };
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

/** Whether the person holds "Approve orders" now. */
export function holdsApproveOrders(access: Pick<AccessPage, "approveOrders">, personId: number): boolean {
  return access.approveOrders.holders.some((h) => h.person.id === personId);
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
  // Every area, so a stray Alumni grant outside the whole team is still taken away.
  return ACCESS_TARGETS.flatMap((target): AccessChange[] => {
    const from = current[target];
    const to = next[target];
    if (from === to) return [];
    if (from === undefined) return to === undefined ? [] : [{ kind: "add", target, to }];
    if (to === undefined) return [{ kind: "remove", target, from }];
    return [{ kind: "change", target, from, to }];
  });
}

/** The viewer's delegation limit on one change: the area is theirs to touch, at both ends, offered in the place, and never a lead's. */
function allowed(held: readonly HeldAccess[], person: AccessPerson, place: AccessPlace, change: AccessChange): boolean {
  if (person.standing === "lead") return false;
  if (change.kind !== "remove" && !targetsAt(place).includes(change.target)) return false;
  const from = change.kind === "add" ? null : change.from;
  const to = change.kind === "remove" ? null : change.to;
  return (from === null || reaches(held, change.target, from)) && (to === null || reaches(held, change.target, to));
}

/**
 * What the Give access and Edit access drawers send: the person's areas in
 * one place as they should be, and, from the team leader, whether they hold
 * "Approve orders" (board 71b). `where` is left out on a lead's page: their
 * division is the only place.
 */
export type SaveAccess = {
  readonly personId: number;
  readonly where?: PlaceKey;
  readonly areas: AreaLevels;
  readonly approveOrders?: boolean;
};

/**
 * A checked write: the person, the place, the changes to make there, each
 * within the viewer's limit, and the "Approve orders" change, if any.
 */
export type AccessWrite = {
  readonly personId: number;
  readonly place: AccessPlace;
  readonly changes: readonly AccessChange[];
  readonly approveOrders: ApproveOrdersChange | null;
};

const level = z.enum(ACCESS_LEVELS).optional();
const saveAccessSchema = z.object({
  personId: z.number().int().positive(),
  where: z.union([z.literal("team"), z.string().regex(/^department-[1-9]\d*$/), z.number().int().positive()]).optional(),
  areas: z.strictObject({ positions: level, applications: level, members: level, alumni: level, orders: level }),
  approveOrders: z.boolean().optional(),
});

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

type AccessFacts = Pick<AccessPage, "unit" | "held" | "people" | "grants" | "approveOrders">;

function outsideUnit(unit: AccessUnit): string {
  switch (unit.kind) {
    case "division":
      return "You can give access only to people in your division.";
    case "department":
      return "You can give access only to people in your department.";
    case "team":
      return "You can give access only to people on the team.";
  }
}

function checkChanges(access: AccessFacts, personId: number, place: AccessPlace, next: AreaLevels): Checked<Omit<AccessWrite, "approveOrders">> {
  const person = access.people.find((p) => p.id === personId);
  if (person === undefined) return { ok: false, error: outsideUnit(access.unit) };
  if (next.alumni !== undefined && place.kind !== "team") return { ok: false, error: "Alumni access is given to the whole team only." };
  const changes = accessChanges(areaLevelsOf(access.grants, personId, place), next);
  if (!changes.every((c) => allowed(access.held, person, place, c))) {
    return { ok: false, error: "You can only give or change access you have, up to your own level." };
  }
  return { ok: true, value: { personId, place, changes } };
}

/**
 * The "Approve orders" change a save asks for, checked by the one rule
 * (`checkApproveOrdersChange`): null when it asks none or leaves it as it is.
 */
function checkApproveOrders(access: AccessFacts, personId: number, holds: boolean | undefined): Checked<ApproveOrdersChange | null> {
  if (holds === undefined || holds === holdsApproveOrders(access, personId)) return { ok: true, value: null };
  return checkApproveOrdersChange(
    {
      byTeamLeader: access.approveOrders.canGive,
      team: access.people.map((p) => p.id),
      // The team leader is the viewer, never one of `people`.
      teamLeaders: [],
      holders: access.approveOrders.holders.map((h) => h.person.id),
    },
    { personId, holds },
  );
}

/**
 * Checks a Give access or Edit access Save from the browser against what the
 * viewer holds, who is in their unit, and where they may give access: their
 * division, their department or one of its divisions, or, from full access,
 * the whole team, a department or a division (board 71b). The person's areas
 * in that place become exactly `areas`; every add, level change and removal
 * that takes must be within the viewer's own level, Alumni goes only to the
 * whole team, and a lead's access is never touched. "Approve orders" changes
 * only from the team leader. The Activity log is no area, so it is never
 * given. Every rule runs on the server: the drawer's own limits are a
 * convenience, not the check.
 */
export function checkSaveAccess(access: AccessFacts, input: unknown): Checked<AccessWrite> {
  const parsed = saveAccessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the form." };
  const { personId, where } = parsed.data;
  const place = where === undefined ? homePlace(access.unit) : placesOf(access.unit).find((p) => placeKey(p) === where);
  if (place === undefined) return { ok: false, error: `You can give access only inside your ${access.unit.kind}.` };
  const areas: Partial<Record<AccessTarget, AccessLevel>> = {};
  for (const target of ACCESS_TARGETS) {
    const chosen = parsed.data.areas[target];
    if (chosen !== undefined) areas[target] = chosen;
  }
  const approve = checkApproveOrders(access, personId, parsed.data.approveOrders);
  if (!approve.ok) return approve;
  const approves = parsed.data.approveOrders ?? holdsApproveOrders(access, personId);
  if (Object.keys(areas).length === 0 && !approves) return { ok: false, error: "Choose at least one area." };
  const checked = checkChanges(access, personId, place, areas);
  return checked.ok ? { ok: true, value: { ...checked.value, approveOrders: approve.value } } : checked;
}

/**
 * Checks Remove all access: every area the person holds, in every place of
 * the unit, goes, each within the viewer's limit, and "Approve orders" with
 * them, which only the team leader removes.
 */
export function checkRemoveAllAccess(access: AccessFacts, personId: unknown): Checked<readonly AccessWrite[]> {
  if (typeof personId !== "number" || !Number.isSafeInteger(personId)) return { ok: false, error: "Unknown person." };
  if (!access.people.some((p) => p.id === personId)) return { ok: false, error: outsideUnit(access.unit) };
  const approve = checkApproveOrders(access, personId, false);
  if (!approve.ok) return approve;
  const writes: AccessWrite[] = [];
  for (const place of placesHeldBy(access.unit, access.grants, personId)) {
    const checked = checkChanges(access, personId, place, {});
    if (!checked.ok) return checked;
    writes.push({ ...checked.value, approveOrders: null });
  }
  if (approve.value !== null) writes.push({ personId, place: homePlace(access.unit), changes: [], approveOrders: approve.value });
  return { ok: true, value: writes };
}

/** A grant as the `scopes` table stores it (issue #247). */
export type GrantRow = {
  readonly scope: "division" | "department" | "team" | "website";
  /** The area, or `all` on a `website` row: site-content access is the Alumni area. */
  readonly target: UnitTarget | "all";
  readonly deptId: number | null;
  readonly divisionId: number | null;
};

/**
 * The `scopes` row one area in one place is stored as. Alumni is site-content
 * access, a `website` row in no unit, which the Alumni page already reads
 * (`viewerStandingOf`, ./viewer.ts; `canReach`, ./access.ts). A whole-team
 * area is a `team` row in no unit; a department's has only `dept_id`; a
 * division's only `division_id`.
 */
export function grantRowOf(place: AccessPlace, target: AccessTarget): GrantRow {
  if (target === "alumni") return { scope: "website", target: "all", deptId: null, divisionId: null };
  switch (place.kind) {
    case "team":
      return { scope: "team", target, deptId: null, divisionId: null };
    case "department":
      return { scope: "department", target, deptId: place.department.id, divisionId: null };
    case "division":
      return { scope: "division", target, deptId: null, divisionId: place.division.id };
  }
}
