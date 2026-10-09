import { z } from "zod";

// The division lead's Access page (board 43, issue #145): what the lead may
// do in their division, who they shared it with, and the Give access rules.
// A lead shares only what they hold, and never more than they hold it: a
// lead who can view Members cannot give anyone edit on Members.

/** What a grant opens: the `scopes.target` values a division lead shares. */
export const ACCESS_TARGETS = ["positions", "applications", "members"] as const;
export type AccessTarget = (typeof ACCESS_TARGETS)[number];

export const ACCESS_TARGET_LABELS: Readonly<Record<AccessTarget, string>> = {
  positions: "Positions",
  applications: "Applications",
  members: "Members",
};

/** `scopes.access_level`. */
export const ACCESS_LEVELS = ["view", "edit"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** Edit on Applications is deciding on them: changing their status. */
export function levelLabel(target: AccessTarget | null, level: AccessLevel): string {
  if (level === "view") return "Can view";
  return target === "applications" ? "Can decide" : "Can edit";
}

/** The edit label for a set of targets: "Can decide" when the set is Applications alone. */
export function editLabelFor(targets: readonly AccessTarget[]): string {
  return targets.length > 0 && targets.every((t) => t === "applications") ? "Can decide" : "Can edit";
}

export type AccessDivision = {
  readonly id: number;
  /** "Mission Analysis Division" */
  readonly name: string;
};

/** "Mission Analysis Division" reads "Mission Analysis" in a table cell. */
export function shortUnitName(name: string): string {
  return name.replace(/\s+Division$/, "");
}

/** One thing the lead holds in their division (a card under "Your access"). */
export type HeldAccess = {
  readonly target: AccessTarget;
  readonly level: AccessLevel;
};

export type AccessPerson = {
  readonly id: number;
  readonly name: string;
  /** "Member" */
  readonly role: string;
};

/** One row of the table: a person, what they were given, and by whom. */
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

/** What the Give access drawer sends. */
export type GiveAccess = {
  readonly personId: number;
  readonly targets: readonly AccessTarget[];
  readonly level: AccessLevel;
};

const giveAccessSchema = z.object({
  personId: z.number().int().positive(),
  targets: z.array(z.enum(ACCESS_TARGETS)).min(1, "Choose at least one kind of access."),
  level: z.enum(ACCESS_LEVELS),
});

/** The highest level the lead may give on a target: what they hold, or nothing. */
function heldLevel(held: readonly HeldAccess[], target: AccessTarget): AccessLevel | null {
  const levels = held.filter((h) => h.target === target).map((h) => h.level);
  if (levels.includes("edit")) return "edit";
  return levels.includes("view") ? "view" : null;
}

/** Whether the lead may give `level` on every one of `targets`. */
export function canGive(held: readonly HeldAccess[], targets: readonly AccessTarget[], level: AccessLevel): boolean {
  return targets.every((target) => {
    const have = heldLevel(held, target);
    return have !== null && (level === "view" || have === "edit");
  });
}

/**
 * Checks a Give access request from the browser against what the lead holds
 * and who is in their division. Every rule runs on the server: the drawer's
 * own limits are a convenience, not the check.
 */
export function checkGiveAccess(
  access: Pick<DivisionAccess, "held" | "people">,
  input: unknown,
): { ok: true; value: GiveAccess } | { ok: false; error: string } {
  const parsed = giveAccessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { personId, level } = parsed.data;
  const targets = ACCESS_TARGETS.filter((t) => parsed.data.targets.includes(t));
  if (!access.people.some((p) => p.id === personId)) {
    return { ok: false, error: "You can give access only to people in your division." };
  }
  if (!canGive(access.held, targets, level)) {
    return { ok: false, error: "You can only give access you have." };
  }
  return { ok: true, value: { personId, targets, level } };
}

const WHAT_VIEW: Readonly<Record<AccessTarget, (unit: string) => string>> = {
  applications: (unit) => `read applications for ${unit} roles, but not change their status`,
  positions: (unit) => `see ${unit} positions, but not change them`,
  members: (unit) => `see the ${unit} member list, but not change it`,
};

const WHAT_EDIT: Readonly<Record<AccessTarget, (unit: string) => string>> = {
  applications: (unit) => `read applications for ${unit} roles and change their status`,
  positions: (unit) => `open, edit and close ${unit} positions`,
  members: (unit) => `edit the ${unit} member list`,
};

function joinClauses(clauses: readonly string[]): string {
  if (clauses.length <= 1) return clauses.join("");
  return `${clauses.slice(0, -1).join(", ")}, and ${clauses[clauses.length - 1]}`;
}

/** The line under the drawer's level switch: what the person will be able to do. */
export function grantSummary(
  personName: string,
  targets: readonly AccessTarget[],
  level: AccessLevel,
  unitName: string,
): string | null {
  if (targets.length === 0) return null;
  const what = level === "view" ? WHAT_VIEW : WHAT_EDIT;
  return `${personName} will be able to ${joinClauses(targets.map((t) => what[t](unitName)))}.`;
}
