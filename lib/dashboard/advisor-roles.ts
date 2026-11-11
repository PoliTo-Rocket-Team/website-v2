import { z } from "zod";
import type { Checked } from "./department-edit";
import { isAdvisorRowAt, type AdvisorPlace } from "./hand-over";
import { divisionLabel, type OrgChart, type Permission, type RoleSeat, type TeamActor, type TeamStanding } from "./team";

// Edit details' department and whole-team Advisor rows (issue #976; Owner
// decision, 2026-11-11). An Advisor role kept on a department or on the whole
// team holds no division, so it gets a row of its own in the Roles section,
// beside the division rows (boards 103b to 103d). Its pill moves the role to
// another place, or ends it. Only the team leader and full access reach a role
// beyond every division (`mayLeaveTeam`, ./team.ts), so for anyone else each
// choice is locked with that reason. The panel and the server both read the
// rules here.

/** Where an Advisor role with no division sits: a department, or the whole team. */
export type BeyondAdvisorPlace = Exclude<AdvisorPlace, { kind: "division" }>;

/** What a row's pill picks: advise at another place, or end the Advisor role. */
export type AdvisorPlaceChoice = { readonly kind: "advise"; readonly place: AdvisorPlace } | { readonly kind: "end" };

/** One item of the row's pill: the choice, its words, and whether the viewer may pick it. */
export type AdvisorPlaceOption = {
  readonly choice: AdvisorPlaceChoice;
  /** "Whole team", "Aerodynamics", "Mission Analysis", "End this role". */
  readonly label: string;
  /** The muted line under it: "Division in Aerodynamics"; null for none. */
  readonly detail: string | null;
  readonly permission: Permission;
};

/** One department or whole-team Advisor role, as Edit details' row shows it. */
export type AdvisorRoleChange = {
  readonly place: BeyondAdvisorPlace;
  /** "Aerodynamics", or "Whole team": the row's name. */
  readonly name: string;
  /** Where the role may go, the current place first, then End this role. */
  readonly options: readonly AdvisorPlaceOption[];
};

export const WHOLE_TEAM = "Whole team";
export const ONLY_TEAM_LEADER_CHANGES = "Only the team leader can do this";
export const ONLY_ROLE = "It is their only role. Leaves the team ends it.";
export const END_ADVISOR_ROLE = "End this role";
const NO_LONGER_ADVISES = "They no longer advise there. Reload and try again.";

const OPEN: Permission = { allowed: true };

function locked(reason: string): Permission {
  return { allowed: false, reason };
}

export function sameAdvisorPlace(a: AdvisorPlace, b: AdvisorPlace): boolean {
  if (a.kind === "team" || b.kind === "team") return a.kind === b.kind;
  if (a.kind === "department") return b.kind === "department" && a.departmentId === b.departmentId;
  return b.kind === "division" && a.divisionId === b.divisionId;
}

export function sameAdvisorChoice(a: AdvisorPlaceChoice, b: AdvisorPlaceChoice): boolean {
  return a.kind === "end" ? b.kind === "end" : b.kind === "advise" && sameAdvisorPlace(a.place, b.place);
}

/** The place's name: "Whole team", "Aerodynamics", "Mission Analysis"; null for a unit no longer open. */
export function advisorPlaceName(place: AdvisorPlace, org: OrgChart): string | null {
  switch (place.kind) {
    case "team":
      return WHOLE_TEAM;
    case "department":
      return org.departments.find((d) => d.id === place.departmentId)?.name ?? null;
    case "division": {
      const division = org.divisions.find((d) => d.id === place.divisionId);
      return division === undefined ? null : divisionLabel(division.name);
    }
  }
}

/**
 * Where an Advisor role at `from` may move (Owner decision, 2026-11-11), its
 * current place first: a department's to the whole team, the department
 * itself, or a division in it; the whole team's to the whole team or a
 * department. Only open units are offered.
 */
export function advisorTargets(from: BeyondAdvisorPlace, org: OrgChart): AdvisorPlace[] {
  if (from.kind === "team") return [from, ...org.departments.map((d): AdvisorPlace => ({ kind: "department", departmentId: d.id }))];
  return [
    from,
    { kind: "team" },
    ...org.divisions.filter((d) => d.departmentId === from.departmentId).map((d): AdvisorPlace => ({ kind: "division", divisionId: d.id })),
  ];
}

/** Why they cannot advise at `place`: they hold a role in that division already, or advise there already; null when they can. */
function heldThere(place: AdvisorPlace, standing: TeamStanding, org: OrgChart): string | null {
  const name = advisorPlaceName(place, org) ?? "";
  switch (place.kind) {
    case "division":
      return standing.memberships.some((m) => m.divisionId === place.divisionId) ? `Already in ${name}` : null;
    case "department":
      return standing.beyond.some((b) => b.kind === "advisor" && b.departmentId === place.departmentId) ? `Already advises ${name}` : null;
    case "team":
      return standing.beyond.some((b) => b.kind === "advisor" && b.departmentId === null) ? "Already advises the whole team" : null;
  }
}

/** Whether the Advisor role at `from` is the only role they hold: ending it is Leaves the team, never this row's. */
function onlyRole(standing: TeamStanding): boolean {
  return standing.memberships.length === 0 && standing.beyond.length === 1;
}

/**
 * Every item of the pill for the Advisor role at `from`, each open or locked
 * with its reason: the current place is always open; for anyone but the team
 * every other choice carries `ONLY_TEAM_LEADER_CHANGES`; a place where they
 * already hold a role is locked, and End this role is locked while it is
 * their only role.
 */
export function advisorPlaceOptions(from: BeyondAdvisorPlace, standing: TeamStanding, org: OrgChart, actor: TeamActor): AdvisorPlaceOption[] {
  const team = actor.kind === "team";
  const places = advisorTargets(from, org).flatMap((place): AdvisorPlaceOption[] => {
    const label = advisorPlaceName(place, org);
    if (label === null) return [];
    const current = sameAdvisorPlace(place, from);
    const held = current ? null : heldThere(place, standing, org);
    const detail = place.kind === "division" ? `Division in ${advisorPlaceName(from, org) ?? ""}` : null;
    const permission = current ? OPEN : !team ? locked(ONLY_TEAM_LEADER_CHANGES) : held !== null ? locked(held) : OPEN;
    return [{ choice: { kind: "advise", place }, label, detail, permission }];
  });
  const end = !team ? locked(ONLY_TEAM_LEADER_CHANGES) : onlyRole(standing) ? locked(ONLY_ROLE) : OPEN;
  return [...places, { choice: { kind: "end" }, label: END_ADVISOR_ROLE, detail: end.allowed ? "They keep their other roles" : null, permission: end }];
}

/** Their department and whole-team Advisor roles as Edit details' rows, the whole team's first; a department no longer open is left out. */
export function advisorRolesOf(standing: TeamStanding, org: OrgChart, actor: TeamActor): AdvisorRoleChange[] {
  const places = standing.beyond.flatMap((b): BeyondAdvisorPlace[] =>
    b.kind !== "advisor" ? [] : b.departmentId === null ? [{ kind: "team" }] : [{ kind: "department", departmentId: b.departmentId }],
  );
  return [...places]
    .sort((a, b) => Number(a.kind !== "team") - Number(b.kind !== "team"))
    .flatMap((place) => {
      const name = advisorPlaceName(place, org);
      return name === null ? [] : [{ place, name, options: advisorPlaceOptions(place, standing, org, actor) }];
    });
}

/** "Advisor", "Advisor · Mission Analysis", "Ends on Save": the row's pill words for what is picked. */
export function advisorPillLabel(choice: AdvisorPlaceChoice, from: BeyondAdvisorPlace, options: readonly AdvisorPlaceOption[]): string {
  if (choice.kind === "end") return "Ends on Save";
  if (sameAdvisorPlace(choice.place, from)) return "Advisor";
  const name = options.find((o) => sameAdvisorChoice(o.choice, choice))?.label;
  return name === undefined ? "Advisor" : `Advisor · ${name}`;
}

// The write behind the row's pill: `changeAdvisorPlace`.

/** What the pill's Save sends: whose Advisor role, where it sits now, and where it goes (null: it ends). */
export type AdvisorPlaceChange = { readonly personId: number; readonly from: BeyondAdvisorPlace; readonly to: AdvisorPlace | null };

const id = z.number().int().positive();
const beyondPlace = z.discriminatedUnion("kind", [z.object({ kind: z.literal("team") }), z.object({ kind: z.literal("department"), departmentId: id })]);
const anyPlace = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("team") }),
  z.object({ kind: z.literal("department"), departmentId: id }),
  z.object({ kind: z.literal("division"), divisionId: id }),
]);
const changeSchema = z.object({ personId: id, from: beyondPlace, to: anyPlace.nullable() });

/** The pill's Save as sent, in its shape; the rules are `planAdvisorPlaceChange`'s. */
export function checkAdvisorPlaceChange(input: unknown): Checked<AdvisorPlaceChange> {
  const result = changeSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: "This change could not be saved." };
}

/** A menu reason as a refusal: "Already in Testing" ends with a period, one that has its own keeps it. */
function sentence(reason: string): string {
  return reason.endsWith(".") ? reason : `${reason}.`;
}

/** A checked change: the Advisor row that ends, and where a new one starts (null: none). */
export type AdvisorPlacePlan = { readonly ending: number; readonly start: AdvisorPlace | null };

/**
 * The pill's Save as the rules allow it, or the first reason it is refused,
 * by the same rule the pill shows (`advisorPlaceOptions`): only the team; the
 * Advisor role must still sit at `from`; the place picked must be one the
 * pill offers and one where they hold no role yet; and the role may end only
 * while they keep another.
 */
export function planAdvisorPlaceChange(input: {
  readonly actor: TeamActor;
  readonly org: OrgChart;
  readonly change: AdvisorPlaceChange;
  readonly roles: readonly RoleSeat[];
  readonly standing: TeamStanding;
}): Checked<AdvisorPlacePlan> {
  const { actor, org, change, roles, standing } = input;
  if (actor.kind !== "team") return { ok: false, error: sentence(ONLY_TEAM_LEADER_CHANGES) };
  const row = roles.find((r) => isAdvisorRowAt({ type: r.type, departmentId: r.departmentId, divisionId: r.divisionId }, change.from));
  if (row === undefined) return { ok: false, error: NO_LONGER_ADVISES };
  const choice: AdvisorPlaceChoice = change.to === null ? { kind: "end" } : { kind: "advise", place: change.to };
  const option = advisorPlaceOptions(change.from, standing, org, actor).find((o) => sameAdvisorChoice(o.choice, choice));
  if (option === undefined) return { ok: false, error: "They cannot advise there. Pick where they advise again." };
  if (!option.permission.allowed) return { ok: false, error: sentence(option.permission.reason) };
  if (change.to !== null && sameAdvisorPlace(change.to, change.from)) return { ok: false, error: "Nothing to change." };
  return { ok: true, value: { ending: row.id, start: change.to } };
}
