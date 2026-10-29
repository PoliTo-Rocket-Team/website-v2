import { z } from "zod";
import type { Checked } from "./department-edit";
import type { TeamPerson } from "./division-edit";
import type { PersonRecord } from "./division-members";
import { HAND_OVER_OUTCOMES, ONE_SUCCESSOR_FOR_SEAT, seatHandOver, steppingDown, type HandOverOutcome, type SeatMove, type SteppingDown } from "./hand-over";
import {
  beyondTitle,
  defaultHeadTitle,
  divisionLabel,
  headDepartmentOf,
  homeFirst,
  isDivisionRole,
  mayChangeDivision,
  membershipsOfRoles,
  reachesDivision,
  roleIn,
  type DivisionRole,
  type OrgChart,
  type RoleSeat,
  type TeamActor,
} from "./team";

// Moving someone to another unit in one save (issue #647; Owner decisions,
// 2026-10-24): Members Edit details and the Team tree's Edit division both
// move a person through this one rule and the one server write behind it. A
// move ends one placement and starts the new one, under the rules of adding
// and removing a member: the viewer must be able to take them out of where
// they are and add them where they go, and a lead's place is changed only by
// whoever may change that division's leads. A department head is moved, or
// made a head, only by the team leader and full access, who manage
// departments; a department never has two heads, and one left with none
// stays empty until a head is picked. A team-level seat is never moved here:
// its holder changes on the Team tree.

/** Where a move takes someone from: a division they are a lead or member of, or the department they head. */
export type MoveFrom = { readonly kind: "division"; readonly divisionId: number } | { readonly kind: "head"; readonly departmentId: number };

/** Where a move takes them, and what they are there. A head of a department is set only when picked (Owner decision, 2026-10-24). */
export type MoveTo =
  | { readonly kind: "division"; readonly divisionId: number; readonly as: DivisionRole }
  | { readonly kind: "head"; readonly departmentId: number };

/** Whether two destinations are one unit: the same division, whatever the role there, or the same headship; null keeps them where they are. */
function sameUnit(a: MoveTo | null, b: MoveTo | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === "division") return b.kind === "division" && a.divisionId === b.divisionId;
  return b.kind === "head" && a.departmentId === b.departmentId;
}

/**
 * What a move form's role title box holds once its destination changes from
 * `from` to `to` (issue #777): the stored title when they stay where they are
 * (`to` null), and an empty box for a new unit, so a move never carries the
 * old unit's title there. Lead or member in the one division is not a new
 * unit, so what the editor typed stays. A blank title stays blank in a
 * division and reads "Head of <department>" for a head (`planMove`).
 */
export function titleOnMove(input: { readonly current: string; readonly stored: string | null; readonly from: MoveTo | null; readonly to: MoveTo | null }): string {
  const { current, stored, from, to } = input;
  if (sameUnit(from, to)) return current;
  return to === null ? (stored ?? "") : "";
}

/** One placement the viewer may move someone out of, as Edit details and the Team tree offer it. */
export type MovablePlace =
  | {
      readonly kind: "division";
      readonly divisionId: number;
      /** "Mission Analysis" */
      readonly short: string;
      /** "Operations" */
      readonly department: string;
      readonly role: DivisionRole;
      /** Their title there, as stored; null for none. */
      readonly title: string | null;
    }
  | {
      readonly kind: "head";
      readonly departmentId: number;
      /** "Propulsion" */
      readonly department: string;
      /** Their head role's title, as stored or by its default. */
      readonly title: string;
    };

/** Whether `actor` makes or moves department heads: the team leader and full access (`mayManageDepartments`). */
function movesHeads(actor: TeamActor): boolean {
  return actor.kind === "team";
}

/**
 * The places `actor` may move `record` out of: each division of theirs the
 * actor reaches, a lead's only where the actor may change its leads, never
 * an Advisor role; and their headship for the team leader and full access.
 * A team-level seat is never one (Owner decision, 2026-10-24).
 */
export function movablePlacesOf(record: Pick<PersonRecord, "memberships" | "beyondDivisions" | "titles" | "advising">, org: OrgChart, actor: TeamActor): MovablePlace[] {
  const department = (id: number | null) => org.departments.find((d) => d.id === id)?.name ?? null;
  const heads = movesHeads(actor)
    ? record.beyondDivisions.flatMap((b): MovablePlace[] => {
        if (b.kind !== "head" || b.departmentId === null) return [];
        const name = department(b.departmentId);
        return name === null ? [] : [{ kind: "head", departmentId: b.departmentId, department: name, title: beyondTitle(b, org) }];
      })
    : [];
  const divisions = homeFirst(record.memberships).flatMap((m): MovablePlace[] => {
    const division = org.divisions.find((d) => d.id === m.divisionId);
    if (!division || record.advising.includes(m.divisionId) || !reachesDivision(actor, m.divisionId, org)) return [];
    if (m.role === "lead" && !mayChangeDivision(actor, m.divisionId, org).allowed) return [];
    return [
      {
        kind: "division",
        divisionId: division.id,
        short: divisionLabel(division.name),
        department: department(division.departmentId) ?? "",
        role: m.role,
        title: record.titles[division.id] ?? null,
      },
    ];
  });
  return [...heads, ...divisions];
}

/** Someone the move's pickers name: a head now, or who may take a headship over. */
export type MovePerson = { readonly id: number; readonly name: string; readonly photoUrl: string | null };

/** A division a move may go to. */
export type MoveDivision = {
  readonly id: number;
  /** "Engines" */
  readonly name: string;
  readonly code: string | null;
  /** Whether the viewer may make someone its lead (`mayChangeDivision`). */
  readonly lead: boolean;
};

/** A department, with the divisions of it a move may go to. */
export type MoveDepartment = {
  readonly id: number;
  readonly name: string;
  readonly code: string | null;
  /** Who heads it now: a move that makes someone its head replaces them. */
  readonly head: MovePerson | null;
  /** Whether the viewer may make someone its head: the team leader and full access. */
  readonly headable: boolean;
  readonly divisions: readonly MoveDivision[];
  /**
   * Who may take its headship over when its head moves away: the people in its
   * divisions other than its head, whatever other seat they hold, which they
   * keep (Owner decision, issue #837); none unless `headable`.
   */
  readonly successors: readonly MovePerson[];
};

/** Where the viewer may move someone, as Edit details and the Team tree load it; none for a viewer who may not move them. */
export type MoveLookup = { readonly kind: "targets"; readonly departments: readonly MoveDepartment[] } | { readonly kind: "none" };

/** A person as the targets name them: who they are and where they sit. */
export type MoveRecord = Pick<PersonRecord, "id" | "name" | "photoUrl" | "memberships" | "beyondDivisions">;

/**
 * Every unit `actor` may move someone into (Owner decision, 2026-10-24): the
 * divisions they may add to, each saying whether they may make a lead there,
 * by department; and for the team leader and full access every department,
 * with its head and who may take its headship over.
 */
export function moveTargetsOf(records: readonly MoveRecord[], org: OrgChart, actor: TeamActor): MoveDepartment[] {
  const person = (r: MoveRecord): MovePerson => ({ id: r.id, name: r.name, photoUrl: r.photoUrl });
  return org.departments.flatMap((department): MoveDepartment[] => {
    const headable = movesHeads(actor);
    const own = org.divisions.filter((d) => d.departmentId === department.id);
    const divisions = own
      .filter((d) => reachesDivision(actor, d.id, org))
      .map((d) => ({ id: d.id, name: divisionLabel(d.name), code: d.code ?? null, lead: mayChangeDivision(actor, d.id, org).allowed }));
    if (divisions.length === 0 && !headable) return [];
    const headsHere = (r: MoveRecord) => r.beyondDivisions.some((b) => b.kind === "head" && b.departmentId === department.id);
    const head = records.find(headsHere);
    const successors = headable
      ? records
          .filter((r) => !headsHere(r) && r.memberships.some((m) => own.some((d) => d.id === m.divisionId)))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(person)
      : [];
    return [{ id: department.id, name: department.name, code: department.code ?? null, head: head ? person(head) : null, headable, divisions, successors }];
  });
}

// The move as sent, and as the rules allow it

/** What a move sends: who, from where to where, their title there, and the two head choices a head move may need. */
export type MoveRequest = {
  readonly personId: number;
  readonly from: MoveFrom;
  readonly to: MoveTo;
  /** Their role title in the new place; blank keeps none in a division, and a head's blank reads "Head of <department>". */
  readonly title: string;
  /** What the head of the department they are made head of does next; null when it has none (the replace-head choice). */
  readonly replaced: HandOverOutcome | null;
  /** Who heads the department they stop heading; null leaves it with no head, to be set on the Team tree. */
  readonly successor: number | null;
};

const id = z.number().int().positive();
const moveSchema = z.object({
  personId: id,
  from: z.discriminatedUnion("kind", [z.object({ kind: z.literal("division"), divisionId: id }), z.object({ kind: z.literal("head"), departmentId: id })]),
  to: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("division"), divisionId: id, as: z.enum(["lead", "member"]) }),
    z.object({ kind: z.literal("head"), departmentId: id }),
  ]),
  title: z.string().trim().max(80, "The role title is too long."),
  replaced: z.enum(HAND_OVER_OUTCOMES).nullable().default(null),
  successor: id.nullable().default(null),
});

/** A move as sent, in its shape; the rules are `planMove`'s. */
export function checkMove(input: unknown): Checked<MoveRequest> {
  const result = moveSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: result.error.issues[0]?.message ?? "Check the form." };
}

/** One active head row, as the move reads who heads what. */
export type HeadRow = Pick<RoleSeat, "id" | "departmentId" | "divisionId" | "fullAccess"> & { readonly memberId: number };

/** The role row a move starts for the person. */
export type MoveStart =
  | { readonly kind: "division"; readonly divisionId: number; readonly type: "lead" | "core"; readonly title: string }
  | { readonly kind: "head"; readonly departmentId: number; readonly title: string; readonly seat: SeatMove | null };

/**
 * A checked move: the person's rows that end and the access of the unit they
 * leave, the row that starts, the head it replaces (their rows, and what
 * becomes of them) and the head picked for the department they leave.
 */
export type MovePlan = {
  readonly personId: number;
  /** Never empty: a move always ends the place they leave. */
  readonly end: readonly [number, ...number[]];
  /** The unit whose access rows of theirs go: the division they leave, or the department they stop heading. */
  readonly leaves: MoveFrom;
  readonly start: MoveStart;
  readonly replaced: { readonly memberId: number; readonly rows: readonly number[]; readonly steppingDown: SteppingDown } | null;
  readonly successor: { readonly memberId: number; readonly departmentId: number; readonly title: string; readonly seat: SeatMove | null } | null;
  /** The people the move makes a lead or a head: each is owed an alias request (issue #543). */
  readonly newLeads: readonly number[];
};

export const MOVE_NOT_IN_SCOPE = "You can move only people your Members page lets you change.";
export const ONLY_TEAM_MOVES_HEADS = "Only the team leader can move a department head or make someone one.";
export const HEAD_SEAT_NEEDS_SUCCESSOR = "This head holds a full-access seat. Pick a new head to take it over.";

function no<T>(error: string): Checked<T> {
  return { ok: false, error };
}

/**
 * The move as the rules allow it, or the first reason it is refused.
 * `roles` are the person's active rows, `heads` every active head row,
 * `team` the people on the team. Nothing is written for a refused move, and a
 * move is one batch, so a person is never left in two places or none.
 */
export function planMove(input: {
  readonly actor: TeamActor | null;
  readonly org: OrgChart;
  readonly viewerId: number | null;
  readonly request: MoveRequest;
  readonly roles: readonly RoleSeat[];
  readonly heads: readonly HeadRow[];
  readonly team: readonly TeamPerson[];
}): Checked<MovePlan> {
  const { actor, org, request, roles, heads, team } = input;
  const { personId, from, to } = request;
  if (actor === null || personId === input.viewerId || roles.length === 0) return no(MOVE_NOT_IN_SCOPE);
  const name = (memberId: number) => team.find((p) => p.id === memberId)?.name ?? "They";
  const departmentName = (departmentId: number) => org.departments.find((d) => d.id === departmentId)?.name ?? null;
  const divisionOf = (divisionId: number) => org.divisions.find((d) => d.id === divisionId) ?? null;
  const headsOf = (departmentId: number) => heads.filter((h) => headDepartmentOf(h, org) === departmentId);

  // Where they leave.
  let ending: readonly RoleSeat[];
  let fromDepartment: number | null = null;
  if (from.kind === "division") {
    if (divisionOf(from.divisionId) === null || !reachesDivision(actor, from.divisionId, org)) return no(MOVE_NOT_IN_SCOPE);
    ending = roles.filter((r) => r.divisionId === from.divisionId && isDivisionRole(r) && r.type !== "advisor");
    if (ending.length === 0) return no(`${name(personId)} is not a lead or member of ${divisionLabel(divisionOf(from.divisionId)!.name)}.`);
    const role = roleIn(membershipsOfRoles(ending), from.divisionId);
    if (role === "lead") {
      const change = mayChangeDivision(actor, from.divisionId, org);
      if (!change.allowed) return no(change.reason);
    }
  } else {
    if (!movesHeads(actor)) return no(ONLY_TEAM_MOVES_HEADS);
    if (departmentName(from.departmentId) === null) return no("That department is closed.");
    ending = roles.filter((r) => r.type === "head" && headDepartmentOf(r, org) === from.departmentId);
    if (ending.length === 0) return no(`${name(personId)} does not head ${departmentName(from.departmentId)}.`);
    fromDepartment = from.departmentId;
  }

  // Where they go.
  const memberships = membershipsOfRoles(roles.filter(isDivisionRole));
  let start: MoveStart;
  let replaced: MovePlan["replaced"] = null;
  if (to.kind === "division") {
    const division = divisionOf(to.divisionId);
    if (division === null) return no("That division is closed.");
    if (!reachesDivision(actor, to.divisionId, org)) return no("You can move people only to a division your Members page lets you change.");
    if (roleIn(memberships, to.divisionId) !== null) return no(`${name(personId)} is already in ${divisionLabel(division.name)}.`);
    if (to.as === "lead") {
      const change = mayChangeDivision(actor, to.divisionId, org);
      if (!change.allowed) return no(change.reason);
    }
    start = { kind: "division", divisionId: to.divisionId, type: to.as === "lead" ? "lead" : "core", title: request.title };
  } else {
    if (!movesHeads(actor)) return no(ONLY_TEAM_MOVES_HEADS);
    const department = departmentName(to.departmentId);
    if (department === null) return no("That department is closed.");
    // One person may hold several seats (Owner decision, issue #837): a new head keeps every other seat they hold
    // (an advisor role, a team-level seat, another department's headship), and only the headship being filled is refused.
    const current = headsOf(to.departmentId);
    if (fromDepartment === to.departmentId || current.some((h) => h.memberId === personId)) return no(`${name(personId)} already heads ${department}.`);
    const seat = seatHandOver(current, [personId]);
    if (!seat.ok) return no(seat.error);
    if (current.length > 0) {
      if (request.replaced === null) return no(`Choose what happens to ${name(current[0].memberId)}: Become an advisor or Leave the team.`);
      replaced = {
        memberId: current[0].memberId,
        rows: current.map((h) => h.id),
        steppingDown: steppingDown({ kind: "head", departmentId: to.departmentId }, request.replaced),
      };
    }
    start = { kind: "head", departmentId: to.departmentId, title: request.title === "" ? defaultHeadTitle(department) : request.title, seat: seat.value };
  }

  // The department they stop heading: a head picked now, or none until the Team tree sets one.
  let successor: MovePlan["successor"] = null;
  if (request.successor !== null) {
    if (fromDepartment === null) return no("Only a head who moves leaves a department to pick a head for.");
    const next = team.find((p) => p.id === request.successor);
    const departmentDivisions = org.divisions.filter((d) => d.departmentId === fromDepartment).map((d) => d.id);
    if (!next || next.id === personId || !next.memberships.some((m) => departmentDivisions.includes(m.divisionId))) {
      return no(`Pick the new head from the people in ${departmentName(fromDepartment)}.`);
    }
    // A successor who holds another seat keeps it (issue #837). The head this move replaces cannot both leave the team and head here.
    if (replaced !== null && replaced.memberId === next.id && replaced.steppingDown.kind === "leave") {
      return no(`${next.name} cannot leave the team and head ${departmentName(fromDepartment)}. Pick another new head, or choose Become an advisor.`);
    }
    successor = { memberId: next.id, departmentId: fromDepartment, title: defaultHeadTitle(departmentName(fromDepartment)!), seat: null };
  }
  // A full-access seat on a row that ends follows the role to the one who takes it over; nobody takes a division role over here.
  const handed = seatHandOver(ending, successor === null ? [] : [successor.memberId]);
  if (!handed.ok) return no(from.kind === "head" ? HEAD_SEAT_NEEDS_SUCCESSOR : ONE_SUCCESSOR_FOR_SEAT);
  if (successor !== null) successor = { ...successor, seat: handed.value };

  // Both branches above refuse a person with no row in the place they leave.
  const [first, ...rest] = ending;
  return {
    ok: true,
    value: {
      personId,
      end: [first.id, ...rest.map((r) => r.id)],
      leaves: from,
      start,
      replaced,
      successor,
      newLeads: [...(start.kind === "head" || (start.kind === "division" && start.type === "lead") ? [personId] : []), ...(successor ? [successor.memberId] : [])],
    },
  };
}
