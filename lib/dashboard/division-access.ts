import { z } from "zod";

// The division lead's Access page (boards 60, 60b, 60c and 60m; issues #145
// and #213): what the lead may do in their division, who they shared it with,
// and the Give access and Edit access rules. Each person holds each area at
// one level or not at all. A lead shares only what they hold, and never more
// than they hold it: a lead who can view Members cannot give anyone edit on
// Members.

/** The areas a grant opens: the `scopes.target` values a division lead shares. */
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

/** "Mission Analysis Division" reads "Mission Analysis" in a table cell. */
export function shortUnitName(name: string): string {
  return name.replace(/\s+Division$/, "");
}

/** One area the lead holds in their division (a chip under "Your access"). */
export type HeldAccess = {
  readonly target: AccessTarget;
  readonly level: AccessLevel;
};

/** A lead or head of the division, or anyone else in it. */
export const PERSON_STANDINGS = ["lead", "member"] as const;
export type PersonStanding = (typeof PERSON_STANDINGS)[number];

export const PERSON_STANDING_LABELS: Readonly<Record<PersonStanding, string>> = {
  lead: "Division lead",
  member: "Member",
};

export type AccessPerson = {
  readonly id: number;
  readonly name: string;
  readonly standing: PersonStanding;
};

/** One stored grant: one person, one area, one level, and who gave it. */
export type AccessGrant = {
  readonly id: number;
  readonly person: AccessPerson;
  readonly target: AccessTarget;
  readonly level: AccessLevel;
  /** "You" when the viewer gave it, else the giver's name; null when nobody is on record. */
  readonly givenBy: string | null;
  /** ISO date; null when no date is on record. */
  readonly givenOn: string | null;
};

export type DivisionAccess = {
  readonly division: AccessDivision;
  readonly held: readonly HeldAccess[];
  readonly grants: readonly AccessGrant[];
  /** The people in the division the lead can give access to: everyone but the lead. */
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

/** What a person holds now, area by area. */
export function areaLevelsOf(grants: readonly AccessGrant[], personId: number): AreaLevels {
  const levels: Partial<Record<AccessTarget, AccessLevel>> = {};
  for (const g of grants) {
    if (g.person.id === personId) levels[g.target] = levels[g.target] === "edit" ? "edit" : g.level;
  }
  return levels;
}

/** The highest level the lead holds on an area, or null. */
export function heldLevel(held: readonly HeldAccess[], target: AccessTarget): AccessLevel | null {
  const levels = held.filter((h) => h.target === target).map((h) => h.level);
  if (levels.includes("edit")) return "edit";
  return levels.includes("view") ? "view" : null;
}

/** Whether the lead holds `target` at `level` or above. */
function reaches(held: readonly HeldAccess[], target: AccessTarget, level: AccessLevel): boolean {
  const have = heldLevel(held, target);
  return have !== null && (level === "view" || have === "edit");
}

/**
 * What the lead may do with one area of one person's access in a drawer:
 * nothing when the person is a lead, the lead does not hold the area, or the
 * person holds it above the lead; else tick or untick it, up to `highest`.
 */
export type AreaRule = { readonly changeable: false } | { readonly changeable: true; readonly highest: AccessLevel };

export function areaRule(held: readonly HeldAccess[], person: AccessPerson, target: AccessTarget, current: AccessLevel | null): AreaRule {
  const highest = heldLevel(held, target);
  if (person.standing === "lead" || highest === null) return { changeable: false };
  if (current !== null && !reaches(held, target, current)) return { changeable: false };
  return { changeable: true, highest };
}

/** Whether the lead may change anything of this person's access. */
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

/** The lead's delegation limit on one change: the area is theirs to touch, at both ends. */
function allowed(held: readonly HeldAccess[], person: AccessPerson, change: AccessChange): boolean {
  if (person.standing === "lead") return false;
  const from = change.kind === "add" ? null : change.from;
  const to = change.kind === "remove" ? null : change.to;
  return (from === null || reaches(held, change.target, from)) && (to === null || reaches(held, change.target, to));
}

/** What the Give access and Edit access drawers send: the person's areas as they should be. */
export type SaveAccess = {
  readonly personId: number;
  readonly areas: AreaLevels;
};

/** A checked write: the person and the changes to make, each within the lead's limit. */
export type AccessWrite = {
  readonly personId: number;
  readonly changes: readonly AccessChange[];
};

const level = z.enum(ACCESS_LEVELS).optional();
const saveAccessSchema = z.object({
  personId: z.number().int().positive(),
  areas: z.strictObject({ positions: level, applications: level, members: level, orders: level }),
});

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

function checkChanges(
  access: Pick<DivisionAccess, "held" | "people" | "grants">,
  personId: number,
  next: AreaLevels,
): Checked<AccessWrite> {
  const person = access.people.find((p) => p.id === personId);
  if (person === undefined) return { ok: false, error: "You can give access only to people in your division." };
  const changes = accessChanges(areaLevelsOf(access.grants, personId), next);
  if (!changes.every((c) => allowed(access.held, person, c))) {
    return { ok: false, error: "You can only give or change access you have, up to your own level." };
  }
  return { ok: true, value: { personId, changes } };
}

/**
 * Checks a Give access or Edit access Save from the browser against what the
 * lead holds and who is in their division. The person's areas become exactly
 * `areas`; every add, level change and removal that takes must be within the
 * lead's own level. Every rule runs on the server: the drawer's own limits
 * are a convenience, not the check.
 */
export function checkSaveAccess(access: Pick<DivisionAccess, "held" | "people" | "grants">, input: unknown): Checked<AccessWrite> {
  const parsed = saveAccessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the form." };
  const areas: Partial<Record<AccessTarget, AccessLevel>> = {};
  for (const target of ACCESS_TARGETS) {
    const chosen = parsed.data.areas[target];
    if (chosen !== undefined) areas[target] = chosen;
  }
  if (Object.keys(areas).length === 0) return { ok: false, error: "Choose at least one area." };
  return checkChanges(access, parsed.data.personId, areas);
}

/** Checks Remove all access: every area the person holds goes, each within the lead's limit. */
export function checkRemoveAllAccess(access: Pick<DivisionAccess, "held" | "people" | "grants">, personId: unknown): Checked<AccessWrite> {
  if (typeof personId !== "number" || !Number.isSafeInteger(personId)) return { ok: false, error: "Unknown person." };
  return checkChanges(access, personId, {});
}
