import { z } from "zod";
import type { Checked } from "./department-edit";
import type { FoundPerson, TeamPerson } from "./division-edit";
import {
  fullAccessMovesLine,
  HAND_OVER_OUTCOMES,
  seatOfHandedRole,
  steppingDown,
  type HandedRole,
  type HandOverOutcome,
  type HeldSeat,
  type SteppingDown,
} from "./hand-over";
import { handOverAnsweredNotice, type AddressedNotice } from "./notices";
import { divisionShortName, type AttentionItem } from "./overview";
import type { OrgChart } from "./team";
import type { FullAccessSeat } from "./viewer";
import { shortDate } from "./write";

// Hand over your role from My profile (issue #262, boards 55d and 62c; Owner
// decisions, 2026-10-16). A division lead or a department head picks who
// takes over and what they do next, and sends it: nothing changes yet. The
// next level up confirms or declines it from a row on their Overview: a head
// of the lead's department for a division lead, the team leader for a
// department head. Confirm runs the hand-over of #253 (./hand-over.ts) at
// once; both answers notify the sender. This module owns who may send, who
// may answer, and what each answer does; both data sources store what it says.

/** The role a lead or a head hands over from My profile. The team leader's is handed over from the Team Leader box (board 77i). */
export type RequestedRole = Exclude<HandedRole, { readonly kind: "team-leader" }>;

/** Who confirms a request: a head of the lead's department, or the team leader for a head. */
export type Approver = "department-head" | "team-leader";

export function approverOf(role: RequestedRole): Approver {
  return role.kind === "lead" ? "department-head" : "team-leader";
}

/** "your department head", "the team leader": who confirms, as the sender reads it. */
export function approverName(role: RequestedRole): string {
  return approverOf(role) === "department-head" ? "your department head" : "the team leader";
}

/** A request waiting for the next level up. */
export type HandOverRequest = {
  readonly id: number;
  readonly fromId: number;
  readonly role: RequestedRole;
  readonly toId: number;
  readonly outcome: HandOverOutcome;
  /** When it was sent, an ISO timestamp. */
  readonly sentAt: string;
};

/** "Mission Analysis", "Aerodynamics": the unit the role is in, and where an advisor stays. */
export function unitOf(role: RequestedRole, org: OrgChart): string {
  if (role.kind === "lead") return divisionShortName(org.divisions.find((d) => d.id === role.divisionId)?.name ?? "the division");
  return org.departments.find((d) => d.id === role.departmentId)?.name ?? "the department";
}

/** "Lead of Mission Analysis", "Head of Aerodynamics": the role as My profile names it (board 55d). */
export function roleTitle(role: RequestedRole, org: OrgChart): string {
  return `${role.kind === "lead" ? "Lead" : "Head"} of ${unitOf(role, org)}`;
}

/** "Mission Analysis lead", "Aerodynamics head": the role as the approver's row names it (board 62c). */
export function roleName(role: RequestedRole, org: OrgChart): string {
  return `${unitOf(role, org)} ${role.kind}`;
}

function sameRole(a: RequestedRole, b: RequestedRole): boolean {
  return a.kind === "lead" ? b.kind === "lead" && a.divisionId === b.divisionId : b.kind === "head" && a.departmentId === b.departmentId;
}

/** Whether the person holds the role now. */
export function holdsRole(person: TeamPerson, role: RequestedRole): boolean {
  return role.kind === "lead"
    ? person.memberships.some((m) => m.divisionId === role.divisionId && m.role === "lead")
    : person.beyond.some((b) => b.kind === "head" && b.departmentId === role.departmentId);
}

/**
 * The role My profile offers to hand over: the department they head, else
 * the oldest division they lead. None for the team leader (board 77i hands
 * that role over) and none for anyone who leads nothing: a member with no
 * role keeps "Leave the team".
 */
export function roleToHandOver(person: TeamPerson): RequestedRole | null {
  if (person.beyond.some((b) => b.kind === "team-leader")) return null;
  for (const b of person.beyond) if (b.kind === "head" && b.departmentId !== null) return { kind: "head", departmentId: b.departmentId };
  const led = person.memberships.find((m) => m.role === "lead");
  return led ? { kind: "lead", divisionId: led.divisionId } : null;
}

/** Someone who may take over: "Pietro Ricci · Mission Analysis" in the select (board 55d). */
export type Successor = { readonly id: number; readonly name: string; readonly unit: string };

/**
 * Who may take over: everyone else in the lead's division (a co-lead
 * included), or everyone in a division of the head's department who does not
 * head it already.
 */
export function successorsFor(role: RequestedRole, senderId: number, team: readonly TeamPerson[], org: OrgChart): Successor[] {
  const inUnit = (divisionId: number) =>
    role.kind === "lead" ? divisionId === role.divisionId : org.divisions.some((d) => d.id === divisionId && d.departmentId === role.departmentId);
  return team.flatMap((person): Successor[] => {
    if (person.id === senderId || (role.kind === "head" && holdsRole(person, role))) return [];
    const membership = person.memberships.find((m) => inUnit(m.divisionId));
    if (!membership) return [];
    const division = org.divisions.find((d) => d.id === membership.divisionId);
    return [{ id: person.id, name: person.name, unit: divisionShortName(division?.name ?? "") }];
  });
}

/**
 * Who may confirm or decline a request: each head of the lead's department,
 * or the team leader for a head. Never the sender, so nobody answers their
 * own request.
 */
export function approverIdsOf(role: RequestedRole, senderId: number, team: readonly TeamPerson[], org: OrgChart): number[] {
  const departmentId = role.kind === "lead" ? (org.divisions.find((d) => d.id === role.divisionId)?.departmentId ?? null) : null;
  return team
    .filter((p) => p.id !== senderId)
    .filter((p) =>
      role.kind === "lead"
        ? departmentId !== null && p.beyond.some((b) => b.kind === "head" && b.departmentId === departmentId)
        : p.beyond.some((b) => b.kind === "team-leader"),
    )
    .map((p) => p.id);
}

/** What My profile offers a lead or a head (board 55d): the role, who may take over, and the request waiting, if any. */
export type HandOverOffer = {
  readonly role: RequestedRole;
  /** "Lead of Mission Analysis" */
  readonly title: string;
  /** Where they stay as an advisor: "Mission Analysis". */
  readonly unit: string;
  readonly approver: Approver;
  /** Who may take over, each with their stored photo for their row in the field (issue #656). */
  readonly successors: readonly (Successor & { readonly photoUrl: string | null })[];
  /** The full-access seat the role carries, which moves to whoever takes over (`fullAccessMovesLine`); null for a role with none. */
  readonly seat: FullAccessSeat | null;
  /** The request they sent, until the next level up answers it. */
  readonly waiting: { readonly to: string; readonly outcome: HandOverOutcome; readonly sentAt: string } | null;
};

/**
 * My profile's offer for `person`, or null when they hold no role to hand
 * over from there. `seats` are the full-access seats on the team's roles
 * (`HeldSeat`); none when the team holds none.
 */
export function handOverOfferOf(
  person: TeamPerson,
  team: readonly FoundPerson[],
  org: OrgChart,
  waiting: HandOverRequest | null,
  seats: readonly HeldSeat[] = [],
): HandOverOffer | null {
  const role = roleToHandOver(person);
  if (role === null) return null;
  const pending = waiting !== null && waiting.fromId === person.id && sameRole(waiting.role, role) ? waiting : null;
  const photos = new Map(team.map((p) => [p.id, p.photoUrl]));
  return {
    role,
    title: roleTitle(role, org),
    unit: unitOf(role, org),
    approver: approverOf(role),
    successors: successorsFor(role, person.id, team, org).map((s) => ({ ...s, photoUrl: photos.get(s.id) ?? null })),
    seat: seatOfHandedRole(seats, person.id, role),
    waiting:
      pending === null
        ? null
        : { to: team.find((p) => p.id === pending.toId)?.name ?? "Someone", outcome: pending.outcome, sentAt: pending.sentAt },
  };
}

// A request that lapsed ----------------------------------------------------------

/**
 * Whether a waiting request has lapsed: its sender left the team, or the role
 * My profile offers them is no longer the one it hands over (removed as lead,
 * a division or department closed, made a head). A lapsed request is closed,
 * never answered: nobody sees it, and it blocks no new send.
 */
export function hasLapsed(request: HandOverRequest, team: readonly TeamPerson[]): boolean {
  const sender = team.find((p) => p.id === request.fromId);
  const offered = sender ? roleToHandOver(sender) : null;
  return offered === null || !sameRole(offered, request.role);
}

/** Someone's roles as the hand-over rules read them: the divisions they are in and how, and every role beyond them. */
function rolesKey(person: TeamPerson | undefined): string {
  if (!person) return "";
  const memberships = person.memberships.map((m) => `${m.divisionId}:${m.role}`).sort();
  const beyond = person.beyond.map((b) => JSON.stringify(b)).sort();
  return JSON.stringify([memberships, beyond]);
}

/**
 * The waiting requests a change to the team closes as lapsed: each whose
 * sender's roles it changed, and each that had lapsed already. A request is
 * for the roles its sender held when they sent it, so any change to them
 * closes it for good: it never comes back with its old successor, even once
 * the sender holds the role again, and they send a new one if they still want
 * to. The database closes them the same way, from a trigger on `roles`
 * (drizzle/0029_hand_over_requests_lapse.sql).
 */
export function lapsedBy(waiting: readonly HandOverRequest[], before: readonly TeamPerson[], after: readonly TeamPerson[]): number[] {
  const changed = (id: number) => rolesKey(before.find((p) => p.id === id)) !== rolesKey(after.find((p) => p.id === id));
  return waiting.filter((r) => changed(r.fromId) || hasLapsed(r, after)).map((r) => r.id);
}

// Send for confirmation (board 55d) --------------------------------------------

/** What "Send for confirmation" sends: the role, who takes over, and what the sender does next. */
export type HandOverSend = { readonly role: RequestedRole; readonly to: number; readonly outcome: HandOverOutcome };

const id = z.number().int().positive();
const sendSchema = z.object({
  role: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("lead"), divisionId: id }),
    z.object({ kind: z.literal("head"), departmentId: id }),
  ]),
  to: id,
  outcome: z.enum(HAND_OVER_OUTCOMES),
});

/** "Send for confirmation" as sent, in its shape; the rules are `planHandOverSend`'s. */
export function checkHandOverSend(input: unknown): Checked<HandOverSend> {
  const result = sendSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: "Pick who takes over and what you do next." };
}

/** "Send for confirmation" as planned: the request to store, and the sender's lapsed requests it closes first. */
export type HandOverSendPlan = { readonly send: HandOverSend; readonly lapsed: readonly number[] };

/**
 * "Send for confirmation" as the rules allow it, or the first reason it is
 * refused: the sender holds the role My profile offers them, has no request
 * waiting that still stands, picks someone who may take over, and someone may
 * confirm it. What it answers is stored as waiting; no role changes. A request
 * of theirs that lapsed (`hasLapsed`) never blocks it: the send closes it.
 */
export function planHandOverSend(input: {
  readonly senderId: number;
  readonly send: HandOverSend;
  readonly team: readonly TeamPerson[];
  readonly org: OrgChart;
  /** The requests still waiting for an answer; only the sender's are read. */
  readonly waiting: readonly HandOverRequest[];
}): Checked<HandOverSendPlan> {
  const { senderId, send, team, org } = input;
  const sender = team.find((p) => p.id === senderId);
  const role = sender ? roleToHandOver(sender) : null;
  if (role === null || !sameRole(role, send.role)) return { ok: false, error: "You hold no role to hand over from here." };
  const theirs = input.waiting.filter((r) => r.fromId === senderId);
  if (theirs.some((r) => !hasLapsed(r, team))) return { ok: false, error: "Your hand-over is already waiting for confirmation." };
  if (!successorsFor(role, senderId, team, org).some((s) => s.id === send.to)) {
    return { ok: false, error: `Pick someone from ${role.kind === "lead" ? "your division" : "your department"}.` };
  }
  if (approverIdsOf(role, senderId, team, org).length === 0) {
    return { ok: false, error: `Nobody can confirm it: ${role.kind === "lead" ? "your department has no head" : "the team has no team leader"}.` };
  }
  return { ok: true, value: { send, lapsed: theirs.map((r) => r.id) } };
}

// Confirm and Decline (board 62c) ----------------------------------------------

export const HAND_OVER_ANSWERS = ["confirm", "decline"] as const;
export type HandOverAnswer = (typeof HAND_OVER_ANSWERS)[number];

export function isHandOverAnswer(value: unknown): value is HandOverAnswer {
  return typeof value === "string" && (HAND_OVER_ANSWERS as readonly string[]).includes(value);
}

/** Whether the request is one `viewerId` answers: it has not lapsed, and they are the next level up. */
export function answersRequest(viewerId: number | null, request: HandOverRequest, team: readonly TeamPerson[], org: OrgChart): boolean {
  if (viewerId === null || hasLapsed(request, team)) return false;
  return approverIdsOf(request.role, request.fromId, team, org).includes(viewerId);
}

/**
 * An answer as the rules allow it. Confirm: the successor takes the role and
 * the sender steps down as they chose (`steppingDown`). Decline changes no
 * role. Either way the sender is told.
 */
export type HandOverAnswerPlan =
  | { readonly answer: "decline"; readonly request: HandOverRequest }
  | { readonly answer: "confirm"; readonly request: HandOverRequest; readonly steppingDown: SteppingDown };

/**
 * Confirm or Decline as the rules allow it, or the first reason it is
 * refused: only the next level up answers (`approverIdsOf`), and the server
 * refuses everyone else. Confirm also needs the sender to hold the role
 * still and the successor to be in its unit still.
 */
export function planHandOverAnswer(input: {
  readonly viewerId: number | null;
  readonly request: HandOverRequest;
  readonly answer: HandOverAnswer;
  readonly team: readonly TeamPerson[];
  readonly org: OrgChart;
}): Checked<HandOverAnswerPlan> {
  const { viewerId, request, answer, team, org } = input;
  if (!answersRequest(viewerId, request, team, org)) {
    return { ok: false, error: `Only ${request.role.kind === "lead" ? "a head of the lead's department" : "the team leader"} can answer this hand-over.` };
  }
  if (answer === "decline") return { ok: true, value: { answer, request } };
  if (!successorsFor(request.role, request.fromId, team, org).some((s) => s.id === request.toId)) {
    const name = team.find((p) => p.id === request.toId)?.name ?? "The person picked";
    return { ok: false, error: `${name} is no longer in ${unitOf(request.role, org)}. Decline it, and they can send a new one.` };
  }
  return { ok: true, value: { answer, request, steppingDown: steppingDown(request.role, request.outcome) } };
}

/** The notice an answer writes: to the sender, whichever the answer (`handOverAnsweredNotice`). */
export function answerNoticeOf(plan: HandOverAnswerPlan, team: readonly TeamPerson[], org: OrgChart): AddressedNotice {
  const { request } = plan;
  return handOverAnsweredNotice(request.fromId, {
    role: roleName(request.role, org),
    successor: team.find((p) => p.id === request.toId)?.name ?? "someone",
    answer: plan.answer === "confirm" ? "confirmed" : "declined",
  });
}

// How it reads ------------------------------------------------------------------

const ROME_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });

/** "today", "yesterday", or "2 Oct": when a request was sent, in the team's time zone. */
export function sentWhen(iso: string, now: Date): string {
  const sent = ROME_DAY.format(new Date(iso));
  if (sent === ROME_DAY.format(now)) return "today";
  if (sent === ROME_DAY.format(new Date(now.getTime() - 86_400_000))) return "yesterday";
  return shortDate(`${sent}T12:00:00Z`, now.getUTCFullYear());
}

/** "then becomes an advisor, without access", "then leaves the team": what the sender does next (board 62c). */
export function thenLine(outcome: HandOverOutcome): string {
  return outcome === "advisor" ? "then becomes an advisor, without access" : "then leaves the team";
}

/**
 * The request as the approver's top row under "Needs your attention" (board
 * 62c): who hands over which role to whom, when it was sent and what the
 * sender does next, with Decline and Confirm. For a role that carries a
 * full-access seat it also says, before Confirm, that full access moves
 * (`fullAccessMovesLine`, issue #501).
 */
export function handOverAttention(
  request: HandOverRequest,
  names: { readonly from: string; readonly to: string },
  org: OrgChart,
  now: Date,
  seat: FullAccessSeat | null = null,
): AttentionItem {
  const first = names.from.split(" ")[0] || names.from;
  const sent = `Sent ${sentWhen(request.sentAt, now)} · ${first} ${thenLine(request.outcome)}`;
  const access = fullAccessMovesLine({ seat, successor: names.to, from: first, step: steppingDown(request.role, request.outcome) });
  return {
    kind: "hand-over",
    title: `${names.from} wants to hand over ${roleName(request.role, org)} to ${names.to}`,
    detail: access === null ? sent : `${sent}. ${access}`,
    action: { answerHandOver: request.id },
  };
}

/** The requests `viewerId` answers, oldest first, as their top rows under "Needs your attention". `seats` as `handOverOfferOf` reads them. */
export function handOverAttentionFor(
  viewerId: number | null,
  requests: readonly HandOverRequest[],
  team: readonly TeamPerson[],
  org: OrgChart,
  now: Date,
  seats: readonly HeldSeat[] = [],
): AttentionItem[] {
  const nameOf = (id: number) => team.find((p) => p.id === id)?.name ?? "Someone";
  return requests
    .filter((r) => answersRequest(viewerId, r, team, org))
    .sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt))
    .map((r) => handOverAttention(r, { from: nameOf(r.fromId), to: nameOf(r.toId) }, org, now, seatOfHandedRole(seats, r.fromId, r.role)));
}
