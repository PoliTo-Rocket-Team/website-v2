// Where an application stands, and the moves that change it (Dashboard v2
// boards 58 to 58i and 97 to 97e, issues #171 and #749). This module alone
// decides which move is legal from which status; the pages, the server
// actions and the database side (./database-recruitment.ts) ask it and never
// restate it.
//
// An application has one status from the status list (./application-status.ts,
// ADR 0011, amendment of 2026-10-25). Each built-in status offers the action
// buttons of the owner's button table (`LEAD_STEPS`), and each button sets the
// built-in status the table names; an added status offers its parent's. Only
// Confirm join, from NDA received, makes the person a team member, and it
// sets their other open applications to "Accepted for another position".
// Someone already on the team follows the same statuses (ADR 0014, amendment
// of 2026-10-25). Any status can also be picked by hand in the drawer's Status
// picker (issue #750): a saved pick of a built-in status runs the move of the
// step that sets it (`moveToStatus`), and one of an added status sets it alone.

import { builtInOf, BUILT_IN_STATUSES, isBuiltInStatusKey, type ApplicationStatus, type BuiltInStatusKey } from "./application-status";
import type { InterviewSlot } from "./my-applications";
import { divisionLabel, homeFirst, roleIn, type Memberships } from "./team";

/** How long an interview runs, as the lead picks it (board 58c; 15 min added by Owner decision, 2026-10-19). */
export const INTERVIEW_LENGTHS = [15, 30, 45, 60] as const;
export type InterviewLength = (typeof INTERVIEW_LENGTHS)[number];

export function isInterviewLength(value: unknown): value is InterviewLength {
  return (INTERVIEW_LENGTHS as readonly unknown[]).includes(value);
}

/**
 * One time the lead can meet, as the applicant's side reads it
 * (`InterviewSlot`, ./my-applications.ts, issue #169) less its stored id: a
 * time the lead is offering has none until it is saved. Start and end are ISO
 * timestamps; a new offer runs one of INTERVIEW_LENGTHS (`checkOffer`).
 */
export type SlotTime = Pick<InterviewSlot, "start" | "end">;

/** The slot the applicant picked, and when they picked it. */
export type BookedSlot = { readonly slot: SlotTime; readonly at: string };

/** At least one slot: an offer with no time in it is not an offer. */
export type OfferedSlots = readonly [SlotTime, ...SlotTime[]];

const MINUTE = 60_000;

/** The slot that starts at `start` and runs `minutes`. */
export function slotAt(start: string, minutes: number): SlotTime {
  const at = Date.parse(start);
  return { start: new Date(at).toISOString(), end: new Date(at + minutes * MINUTE).toISOString() };
}

/** How long a slot runs, in minutes. */
export function slotLength(slot: SlotTime): number {
  return Math.round((Date.parse(slot.end) - Date.parse(slot.start)) / MINUTE);
}

/** The accepted statuses before Joined: each keeps the day it was accepted. */
export type AcceptedStatus = "accepted_email_to_be_sent" | "accepted_email_sent" | "nda_received";

/** The statuses that end an application without a place in this position. */
export type EndedStatus = "rejected_email_to_be_sent" | "rejected_email_sent" | "accepted_for_another_position" | "withdrawn";

/**
 * Where an application stands: the built-in status it behaves like (an added
 * status reads as its parent, ./stored-application.ts) and what that status
 * keeps. An Interview being arranged has no times offered yet; a booking is
 * always one of the offered times.
 */
export type ApplicationState =
  | { readonly status: "new" }
  | { readonly status: "interview"; readonly offered: readonly SlotTime[]; readonly booked: BookedSlot | null }
  | { readonly status: AcceptedStatus; readonly acceptedAt: string }
  | { readonly status: "joined"; readonly joinedAt: string }
  | { readonly status: EndedStatus };

/** A built-in status's name as the list ships it ("Accepted · email to be sent"). */
export const STATUS_NAMES: Readonly<Record<BuiltInStatusKey, string>> = Object.fromEntries(BUILT_IN_STATUSES.map((s) => [s.key, s.name])) as Record<
  BuiltInStatusKey,
  string
>;

/**
 * The statuses of an application still being decided. Confirm join on one of
 * a person's applications sets each of their others in one of these to
 * "Accepted for another position" (`takenByJoinElsewhere`); a decided one
 * (Joined, either Rejected status, Accepted for another position, Withdrawn)
 * keeps its status.
 */
export const OPEN_STATUSES = [
  "new",
  "interview",
  "accepted_email_to_be_sent",
  "accepted_email_sent",
  "nda_received",
] as const satisfies readonly BuiltInStatusKey[];

export function isOpenStatus(status: BuiltInStatusKey): boolean {
  return (OPEN_STATUSES as readonly BuiltInStatusKey[]).includes(status);
}

/** Whether Confirm join on another of the person's applications sets this one to "Accepted for another position". */
export function takenByJoinElsewhere(status: ApplicationStatus): boolean {
  return isOpenStatus(builtInOf(status));
}

// Moves --------------------------------------------------------------------------

/** What a lead does to an application: one action button of the owner's table. */
export type LeadMove =
  /** Move to interview (58c), or Change times on one already there (58d). */
  | { readonly kind: "offer-interview"; readonly slots: readonly SlotTime[] }
  | { readonly kind: "accept" }
  | { readonly kind: "reject" }
  | { readonly kind: "withdraw-acceptance" }
  /** Mark email sent: the acceptance email, or the refusal email. */
  | { readonly kind: "mark-email-sent" }
  | { readonly kind: "nda-received" }
  | { readonly kind: "confirm-join" };

export type LeadMoveKind = LeadMove["kind"];

/** What the applicant does (their My applications page, issue #169). */
export type ApplicantMove =
  | { readonly kind: "book"; readonly start: string }
  | { readonly kind: "withdraw" };

/**
 * A hand pick of a built-in status in the drawer's Status picker, once saved
 * (boards 97 to 97c, ruling R1.1 on #745, issue #750). It sets the status the
 * way the step that sets it does, with that step's effects and checks; only
 * which status the step is offered from does not bind it. Interview, like
 * Move to interview, carries the offered times.
 */
export type BuiltInPick =
  | { readonly kind: "pick"; readonly to: "interview"; readonly slots: readonly SlotTime[] }
  | { readonly kind: "pick"; readonly to: Exclude<BuiltInStatusKey, "interview"> };

/**
 * A hand pick of an added status, once saved: the application's status
 * reference becomes that status and nothing else changes (issue #750). Only
 * the stored list knows which keys are added statuses, so the data source
 * checks the key.
 */
export type AddedPick = { readonly kind: "pick-added"; readonly key: string };

/** What an approver does to an application: an action button, or a saved hand pick in the Status picker. */
export type ApproverMove = LeadMove | BuiltInPick | AddedPick;

export type ApplicationMove = LeadMove | BuiltInPick | ApplicantMove;

/**
 * One action button: its words, the move it runs, the built-in status the
 * move sets, and whether it is the bar's main button or its outlined one.
 */
export type LeadStep = {
  readonly label: string;
  readonly move: LeadMoveKind;
  readonly sets: BuiltInStatusKey;
  readonly emphasis: "primary" | "secondary";
};

/**
 * The owner's button table (2026-10-25, epic #588): the buttons each built-in
 * status offers, in the table's order, and the status each one sets. A status
 * with no buttons is decided. This table is the one source for both the
 * drawer's buttons and which lead move is legal (`applyMove`).
 */
export const LEAD_STEPS: Readonly<Record<BuiltInStatusKey, readonly LeadStep[]>> = {
  new: [
    { label: "Move to interview", move: "offer-interview", sets: "interview", emphasis: "primary" },
    { label: "Reject", move: "reject", sets: "rejected_email_to_be_sent", emphasis: "secondary" },
  ],
  interview: [
    { label: "Change times", move: "offer-interview", sets: "interview", emphasis: "secondary" },
    { label: "Accept", move: "accept", sets: "accepted_email_to_be_sent", emphasis: "primary" },
    { label: "Reject", move: "reject", sets: "rejected_email_to_be_sent", emphasis: "secondary" },
  ],
  accepted_email_to_be_sent: [
    { label: "Mark email sent", move: "mark-email-sent", sets: "accepted_email_sent", emphasis: "primary" },
    { label: "Withdraw acceptance", move: "withdraw-acceptance", sets: "new", emphasis: "secondary" },
  ],
  accepted_email_sent: [{ label: "NDA received", move: "nda-received", sets: "nda_received", emphasis: "primary" }],
  nda_received: [{ label: "Confirm join", move: "confirm-join", sets: "joined", emphasis: "primary" }],
  joined: [],
  rejected_email_to_be_sent: [{ label: "Mark email sent", move: "mark-email-sent", sets: "rejected_email_sent", emphasis: "primary" }],
  rejected_email_sent: [],
  accepted_for_another_position: [],
  withdrawn: [],
};

/** The action buttons a status offers: a built-in status's own, an added status's parent's. */
export function leadSteps(status: ApplicationStatus | BuiltInStatusKey): readonly LeadStep[] {
  return LEAD_STEPS[typeof status === "string" ? status : builtInOf(status)];
}

/**
 * A legal move's outcome. `joinsTeam` is true for Confirm join alone: it is
 * the one move after which the data source adds the person to the team.
 * `changed` is false when the move leaves the state as it was (Change times
 * to the same times): a data source then writes nothing, so it never rewrites
 * an interview's booking from a stale page.
 */
export type MoveResult =
  | { readonly ok: true; readonly state: ApplicationState; readonly joinsTeam: boolean; readonly changed: boolean }
  | { readonly ok: false; readonly reason: string };

/** The most times one offer may hold. */
export const MAX_OFFERED_SLOTS = 20;

type Next = { readonly ok: true; readonly state: ApplicationState; readonly joinsTeam: boolean } | { readonly ok: false; readonly reason: string };

function moved(state: ApplicationState, joinsTeam = false): Next {
  return { ok: true, state, joinsTeam };
}

function illegal(reason: string): Next {
  return { ok: false, reason };
}

function sameSlot(a: SlotTime, b: SlotTime): boolean {
  return Date.parse(a.start) === Date.parse(b.start) && Date.parse(a.end) === Date.parse(b.end);
}

/** Whether two states say the same thing: same status, same times, same booking, same dates. */
export function sameState(a: ApplicationState, b: ApplicationState): boolean {
  if (a.status !== b.status) return false;
  if (a.status === "interview" && b.status === "interview") {
    if (a.offered.length !== b.offered.length || !a.offered.every((s, i) => sameSlot(s, b.offered[i]))) return false;
    if (a.booked === null || b.booked === null) return a.booked === b.booked;
    return sameSlot(a.booked.slot, b.booked.slot) && Date.parse(a.booked.at) === Date.parse(b.booked.at);
  }
  if ("acceptedAt" in a && "acceptedAt" in b) return Date.parse(a.acceptedAt) === Date.parse(b.acceptedAt);
  if (a.status === "joined" && b.status === "joined") return Date.parse(a.joinedAt) === Date.parse(b.joinedAt);
  return true;
}

/** The offered slots, checked: some, not too many, one length, each in the future, none twice. */
export function checkOffer(slots: readonly SlotTime[], now: Date): { ok: true; offered: OfferedSlots } | { ok: false; reason: string } {
  if (slots.length === 0) return { ok: false, reason: "Pick at least one time." };
  if (slots.length > MAX_OFFERED_SLOTS) return { ok: false, reason: `Pick at most ${MAX_OFFERED_SLOTS} times.` };
  const starts = new Set<number>();
  for (const slot of slots) {
    const at = Date.parse(slot.start);
    if (!Number.isFinite(at) || !isInterviewLength(slotLength(slot))) return { ok: false, reason: "That time is not valid." };
    if (at <= now.getTime()) return { ok: false, reason: "Pick times that are still to come." };
    if (starts.has(at)) return { ok: false, reason: "A time is picked twice." };
    starts.add(at);
  }
  if (new Set(slots.map(slotLength)).size !== 1) return { ok: false, reason: "Every time has the same length." };
  const offered = [...slots].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return { ok: true, offered: offered as unknown as OfferedSlots };
}

/** The state after `move`, or why the move is not allowed from here. */
export function applyMove(state: ApplicationState, move: ApplicationMove, now: Date): MoveResult {
  const next =
    move.kind === "book" || move.kind === "withdraw"
      ? applicantNext(state, move, now)
      : move.kind === "pick"
        ? pickNext(state, move, now)
        : leadNext(state, move, now);
  return next.ok ? { ...next, changed: !sameState(state, next.state) } : next;
}

/** The built-in status a hand pick sets, with the times its confirm offered when it is Interview. */
export type PickTarget =
  | { readonly to: "interview"; readonly slots: readonly SlotTime[] }
  | { readonly to: Exclude<BuiltInStatusKey, "interview"> };

/**
 * The move that saving a hand-picked built-in status runs (ruling R1.1 on
 * #745): the current status's own button where one of them sets that status,
 * so the pick is that button's very move, and a `pick` of it otherwise.
 */
export function moveToStatus(state: ApplicationState, target: PickTarget): LeadMove | BuiltInPick {
  const step = LEAD_STEPS[state.status].find((s) => s.sets === target.to);
  if (!step) return target.to === "interview" ? { kind: "pick", to: "interview", slots: target.slots } : { kind: "pick", to: target.to };
  if (step.move === "offer-interview") return { kind: "offer-interview", slots: target.to === "interview" ? target.slots : [] };
  return { kind: step.move };
}

/**
 * A saved hand pick: the state the step that sets the status reaches, with
 * that step's checks and effects. The step is the button of the owner's
 * table that sets the status, the applicant's Withdraw for Withdrawn, and
 * Confirm join on another of the person's applications for "Accepted for
 * another position". Interview's times are
 * checked as Move to interview's; Confirm join needs the signed NDA, so
 * Joined is picked only from NDA received, and only it adds the person to
 * the team; Withdrawn and "Accepted for another position" are set, as the
 * applicant's Withdraw and Confirm join elsewhere set them, only on an
 * application still open.
 */
function pickNext(state: ApplicationState, pick: BuiltInPick, now: Date): Next {
  switch (pick.to) {
    case "interview": {
      const offer = checkOffer(pick.slots, now);
      if (!offer.ok) return illegal(offer.reason);
      return moved({ status: "interview", offered: offer.offered, booked: null });
    }
    case "joined":
      if (state.status !== "nda_received") return illegal("Confirm join needs the signed NDA. Save NDA received first.");
      return moved(arrival("joined", state, now.toISOString()), true);
    case "withdrawn":
    case "accepted_for_another_position":
      if (!isOpenStatus(state.status)) return illegal("This application is already decided.");
      return moved({ status: pick.to });
    default:
      return moved(arrival(pick.to, state, now.toISOString()));
  }
}

/**
 * The status an application carries once a move reached `next`: after a
 * hand pick, the picked status; after a button, the built-in status it set,
 * or the current status when the button keeps the built-in status it behaves
 * like, so Change times on an added status under Interview keeps it.
 */
export function statusAfter(current: ApplicationStatus, next: ApplicationState, via: "button" | "pick"): ApplicationStatus {
  if (via === "button" && next.status === builtInOf(current)) return current;
  return { kind: "built-in", key: next.status };
}

/** A lead move: legal only where the button table offers it from this status, and it sets the status the table names. */
function leadNext(state: ApplicationState, move: LeadMove, now: Date): Next {
  const step = LEAD_STEPS[state.status].find((s) => s.move === move.kind);
  if (!step) return illegal(`An application that is ${STATUS_NAMES[state.status]} has no ${moveName(move.kind)} step.`);
  if (move.kind === "offer-interview") {
    const offer = checkOffer(move.slots, now);
    if (!offer.ok) return illegal(offer.reason);
    return moved({ status: "interview", offered: offer.offered, booked: null });
  }
  return moved(arrival(step.sets, state, now.toISOString()), move.kind === "confirm-join");
}

/**
 * The state a move that sets `status` reaches from `from` at `at`. Accept
 * records the day; the email and NDA statuses after it keep that day.
 */
function arrival(status: BuiltInStatusKey, from: ApplicationState, at: string): ApplicationState {
  switch (status) {
    case "interview":
      return { status, offered: [], booked: null };
    case "accepted_email_to_be_sent":
      return { status, acceptedAt: at };
    case "accepted_email_sent":
    case "nda_received":
      return { status, acceptedAt: "acceptedAt" in from ? from.acceptedAt : at };
    case "joined":
      return { status, joinedAt: at };
    default:
      return { status };
  }
}

/** The applicant's own moves: book an offered time, or withdraw while the application is still open. */
function applicantNext(state: ApplicationState, move: ApplicantMove, now: Date): Next {
  switch (move.kind) {
    case "book": {
      if (state.status !== "interview") return illegal("Only an application at interview takes a booking.");
      const slot = state.offered.find((s) => Date.parse(s.start) === Date.parse(move.start));
      if (!slot) return illegal("That time was not offered.");
      return moved({ ...state, booked: { slot, at: now.toISOString() } });
    }
    case "withdraw":
      if (!isOpenStatus(state.status)) return illegal("This application is already decided.");
      return moved({ status: "withdrawn" });
  }
}

/** "accept" as a refusal names it: the button's words where a status offers it, else the move's own. */
function moveName(kind: LeadMoveKind): string {
  const step = Object.values(LEAD_STEPS)
    .flat()
    .find((s) => s.move === kind);
  return step ? `"${step.label}"` : kind;
}

// Joining the team ---------------------------------------------------------------

/**
 * Where the applicant stands with the team: not on it yet, on it before and
 * left (a member row with no active role), or on it now. Someone on it now
 * signed the team's one NDA when they joined and never signs a second one
 * (Owner decision, 2026-10-11), yet follows the same statuses as anyone else
 * (ADR 0014, amendment of 2026-10-25). The standing says only what Confirm
 * join adds (`joinChange`) and how its confirm reads.
 */
export type ApplicantStanding = { readonly kind: "applicant" } | { readonly kind: "alumnus" } | MemberStanding;

/**
 * Someone on the team now, toward a position in `positionDivisionId`. Their
 * divisions are `Memberships`, so none is named twice, and whether they are
 * in the position's division is read from that list (`inPositionDivision`),
 * never stored beside it. Build it with `memberStanding`.
 */
export type MemberStanding = {
  readonly kind: "member";
  readonly memberships: Memberships;
  /** Each of their divisions' names as the dialogs show them ("Optimization and Analysis"). */
  readonly divisionNames: Readonly<Record<number, string>>;
  readonly positionDivisionId: number;
  /** The year they signed the NDA; null when no date is kept. */
  readonly ndaYear: number | null;
};

/** Someone not on the team and never on it. */
export const NEW_APPLICANT: ApplicantStanding = { kind: "applicant" };

/**
 * A member's standing toward a position in `positionDivisionId`, from the
 * divisions they are in now. `nameOf` gives a division's name as the org
 * chart keeps it; a division it has no name for goes unnamed.
 */
export function memberStanding(
  memberships: Memberships,
  nameOf: (divisionId: number) => string | null | undefined,
  positionDivisionId: number,
  ndaYear: number | null,
): MemberStanding {
  const divisionNames: Record<number, string> = {};
  for (const m of memberships) {
    const name = nameOf(m.divisionId);
    if (name) divisionNames[m.divisionId] = divisionLabel(name);
  }
  return { kind: "member", memberships, divisionNames, positionDivisionId, ndaYear };
}

/** Whether a member is already in the division the position is in. */
export function inPositionDivision(standing: MemberStanding): boolean {
  return roleIn(standing.memberships, standing.positionDivisionId) !== null;
}

/** A member's divisions as the dialogs name them, home division first (`homeFirst`). */
export function memberDivisionNames(standing: MemberStanding): string[] {
  return homeFirst(standing.memberships).flatMap((m) => standing.divisionNames[m.divisionId] ?? []);
}

/**
 * What Confirm join adds to the team: a member row and their role for a new
 * person, a role for someone coming back, a membership of the new division
 * for someone already on the team, who keeps every division they are in
 * (Owner decision, 2026-10-11), and nothing for someone already in it. Every
 * data source and both pages that offer Confirm join (Applications 58h and
 * 58h2, Members 59) ask this one rule.
 */
export type JoinChange = "new-member" | "new-role" | "new-division" | "nothing";

export function joinChange(standing: ApplicantStanding): JoinChange {
  switch (standing.kind) {
    case "applicant":
      return "new-member";
    case "alumnus":
      return "new-role";
    case "member":
      return inPositionDivision(standing) ? "nothing" : "new-division";
  }
}

/** An approver's move as the browser sent it, a button's or a saved hand pick, checked for shape; null when it is not one. */
export function parseApproverMove(value: unknown): ApproverMove | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  switch (v.kind) {
    case "pick-added":
      return typeof v.key === "string" && v.key.length > 0 && !isBuiltInStatusKey(v.key) ? { kind: "pick-added", key: v.key } : null;
    case "pick": {
      if (!isBuiltInStatusKey(v.to)) return null;
      if (v.to !== "interview") return { kind: "pick", to: v.to };
      const slots = parseSlots(v.slots);
      return slots === null ? null : { kind: "pick", to: "interview", slots };
    }
    default:
      return parseLeadMove(value);
  }
}

/** Offered times as the browser sent them, each one of INTERVIEW_LENGTHS long; null when they are not. */
function parseSlots(value: unknown): SlotTime[] | null {
  if (!Array.isArray(value) || value.length > MAX_OFFERED_SLOTS) return null;
  const slots: SlotTime[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) return null;
    const { start, end } = raw as Record<string, unknown>;
    if (typeof start !== "string" || typeof end !== "string") return null;
    if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) return null;
    const slot = { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
    if (!isInterviewLength(slotLength(slot))) return null;
    slots.push(slot);
  }
  return slots;
}

/** A lead's button move as the browser sent it, checked for shape; null when it is not one. */
export function parseLeadMove(value: unknown): LeadMove | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  switch (v.kind) {
    case "accept":
    case "reject":
    case "withdraw-acceptance":
    case "mark-email-sent":
    case "nda-received":
    case "confirm-join":
      return { kind: v.kind };
    case "offer-interview": {
      const slots = parseSlots(v.slots);
      return slots === null ? null : { kind: "offer-interview", slots };
    }
    default:
      return null;
  }
}

// How a status reads --------------------------------------------------------------

export type PillTone = "neutral" | "info" | "accent" | "success" | "muted";

/**
 * The status pill in the list and the panel (58b, 58i): its words, its phone
 * words (58m), its colour. An interview names its booked time.
 */
export function statusPill(state: ApplicationState): { readonly label: string; readonly short: string; readonly tone: PillTone } {
  switch (state.status) {
    case "interview":
      if (state.booked) {
        return {
          label: `Interview · ${slotDayTime(state.booked.slot)}`,
          short: `Interview · ${slotDay(state.booked.slot)}`,
          tone: "accent",
        };
      }
      return { label: "Interview · no time yet", short: "Interview · no time", tone: "neutral" };
    default:
      return { label: STATUS_NAMES[state.status], short: SHORT_NAMES[state.status] ?? STATUS_NAMES[state.status], tone: statusTone(state.status) };
  }
}

/** The phone pill's words where the status's name is too long for a list row (58m). */
const SHORT_NAMES: Partial<Record<BuiltInStatusKey, string>> = {
  accepted_email_to_be_sent: "Accepted · to email",
  accepted_email_sent: "Accepted · emailed",
  rejected_email_to_be_sent: "Rejected · to email",
  rejected_email_sent: "Rejected · emailed",
  accepted_for_another_position: "Other position",
};

/** The tone of a status on its own, as the Other applications rows show it (board 58). */
export function statusTone(status: BuiltInStatusKey): PillTone {
  switch (status) {
    case "new":
      return "neutral";
    case "interview":
      return "accent";
    case "accepted_email_to_be_sent":
    case "accepted_email_sent":
    case "nda_received":
    case "joined":
      return "success";
    case "rejected_email_to_be_sent":
    case "rejected_email_sent":
    case "accepted_for_another_position":
    case "withdrawn":
      return "muted";
  }
}

/** The four steps the progress bar under an Other application counts: applied, review, interview, accepted. */
export const PROGRESS_STEPS = 4;

/** How many of the four steps an application has reached; null once it ended without a place. */
export function progressOf(status: BuiltInStatusKey): number | null {
  switch (status) {
    case "new":
      return 1;
    case "interview":
      return 3;
    case "accepted_email_to_be_sent":
    case "accepted_email_sent":
    case "nda_received":
    case "joined":
      return 4;
    case "rejected_email_to_be_sent":
    case "rejected_email_sent":
    case "accepted_for_another_position":
    case "withdrawn":
      return null;
  }
}

// Tabs -----------------------------------------------------------------------------

/**
 * The list's tabs follow the status list (ruling R1.2 on #745): New,
 * Interview, the accepted statuses with Joined, and the statuses that ended
 * without a place. There is no In review tab.
 */
export type ApplicationTab = "all" | "new" | "interview" | "accepted" | "rejected";

export const APPLICATION_TABS: readonly { readonly tab: ApplicationTab; readonly label: string }[] = [
  { tab: "all", label: "All" },
  { tab: "new", label: "New" },
  { tab: "interview", label: "Interview" },
  { tab: "accepted", label: "Accepted" },
  { tab: "rejected", label: "Rejected" },
];

/** The tab a status sits under. */
export function tabOf(status: BuiltInStatusKey): Exclude<ApplicationTab, "all"> {
  switch (status) {
    case "new":
      return "new";
    case "interview":
      return "interview";
    case "accepted_email_to_be_sent":
    case "accepted_email_sent":
    case "nda_received":
    case "joined":
      return "accepted";
    case "rejected_email_to_be_sent":
    case "rejected_email_sent":
    case "accepted_for_another_position":
    case "withdrawn":
      return "rejected";
  }
}

export function inTab(status: BuiltInStatusKey, tab: ApplicationTab): boolean {
  return tab === "all" || tabOf(status) === tab;
}

export function tabCounts(statuses: readonly BuiltInStatusKey[]): Record<ApplicationTab, number> {
  const counts: Record<ApplicationTab, number> = { all: statuses.length, new: 0, interview: 0, accepted: 0, rejected: 0 };
  for (const status of statuses) counts[tabOf(status)] += 1;
  return counts;
}

// Times, in Turin ----------------------------------------------------------------

const TIME_ZONE = "Europe/Rome";
const DAY = 24 * 60 * MINUTE;

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  weekday: "short",
  hourCycle: "h23",
});

type RomeParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: string };

function romeParts(at: Date): RomeParts {
  const parts = Object.fromEntries(partsFormat.formatToParts(at).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday,
  };
}

/** The instant a Turin wall-clock time names. */
export function romeTime(year: number, month: number, day: number, hour: number, minute: number): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wall;
  // Two rounds settle the offset, across a clock change too.
  for (let i = 0; i < 2; i++) {
    const p = romeParts(new Date(guess));
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wall - shown;
  }
  return new Date(guess);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

function hhmm(p: { hour: number; minute: number }): string {
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

function slotEnd(slot: SlotTime): Date {
  return new Date(slot.end);
}

/** "Thu 15" */
export function slotDay(slot: SlotTime): string {
  const p = romeParts(new Date(slot.start));
  return `${p.weekday} ${p.day}`;
}

/** "Thu 15, 17:30", as the stage pill reads. */
export function slotDayTime(slot: SlotTime): string {
  const p = romeParts(new Date(slot.start));
  return `${p.weekday} ${p.day}, ${hhmm(p)}`;
}

/** "Thu 15 Oct, 17:30 – 18:00", as the panel's interview card reads (58d). */
export function slotRange(slot: SlotTime): string {
  const p = romeParts(new Date(slot.start));
  return `${p.weekday} ${p.day} ${MONTHS[p.month - 1]}, ${hhmm(p)} – ${hhmm(romeParts(slotEnd(slot)))}`;
}

/** The date badge on the interview card: "15" over "OCT". */
export function slotBadge(slot: SlotTime): { readonly day: string; readonly month: string } {
  const p = romeParts(new Date(slot.start));
  return { day: String(p.day), month: MONTHS[p.month - 1].toUpperCase() };
}

/** "11 Oct" */
export function dayMonth(iso: string): string {
  const p = romeParts(new Date(iso));
  return `${p.day} ${MONTHS[p.month - 1]}`;
}

// The slot picker (58c) ------------------------------------------------------------

/** The times a weekday offers in the picker: 17:00 to 19:00, every half hour. */
export const PICKER_TIMES = [
  [17, 0],
  [17, 30],
  [18, 0],
  [18, 30],
  [19, 0],
] as const;

/** A calendar month: `month` is 1 for January. */
export type PickerMonthRef = { readonly year: number; readonly month: number };

export type PickerDay = { readonly label: string; readonly starts: readonly { readonly start: string; readonly past: boolean }[] };
export type PickerWeek = {
  readonly title: string;
  /** The month the header names for this week: the one holding most of its weekdays, so its Wednesday's. */
  readonly month: PickerMonthRef;
  readonly days: readonly PickerDay[];
};

type CalendarDate = { readonly year: number; readonly month: number; readonly day: number };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** A calendar date `days` after `date`; calendar dates carry no zone, so UTC arithmetic is exact. */
function addDays(date: CalendarDate, days: number): CalendarDate {
  const at = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() };
}

function dayNumber(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day) / DAY;
}

/** 0 for Monday to 6 for Sunday. */
function weekdayOf(date: CalendarDate): number {
  return (new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 6) % 7;
}

function dateKey(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

/** The Turin calendar date of an instant: "2026-10-15". */
function romeDateKey(iso: string): string {
  const p = romeParts(new Date(iso));
  return dateKey(p);
}

/** The Monday, in Turin, of the first week the picker shows: the week of tomorrow, or the next one from a Saturday. */
function firstMonday(now: Date): CalendarDate {
  const tomorrow = romeParts(new Date(now.getTime() + DAY));
  const weekday = WEEKDAYS.indexOf(tomorrow.weekday as (typeof WEEKDAYS)[number]);
  const shift = weekday >= 5 ? 7 - weekday : -weekday;
  return addDays(tomorrow, shift);
}

/** Week `index` (0 is the first; there is no last) of the picker: "12 – 16 October" and Monday to Friday's times. */
export function pickerWeek(now: Date, index: number): PickerWeek {
  const monday = addDays(firstMonday(now), index * 7);
  const days = Array.from({ length: 5 }, (_, i) => {
    const date = addDays(monday, i);
    const starts = PICKER_TIMES.map(([h, min]) => {
      const at = romeTime(date.year, date.month, date.day, h, min);
      return { start: at.toISOString(), past: at.getTime() <= now.getTime() };
    });
    return { label: `${WEEKDAYS[i]} ${date.day}`, starts, date };
  });
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const title =
    first.month === last.month
      ? `${first.day} – ${last.day} ${MONTHS_LONG[last.month - 1]}`
      : `${first.day} ${MONTHS[first.month - 1]} – ${last.day} ${MONTHS[last.month - 1]}`;
  const wednesday = days[2].date;
  return {
    title,
    month: { year: wednesday.year, month: wednesday.month },
    days: days.map(({ label, starts }) => ({ label, starts })),
  };
}

/**
 * The picker week holding `date`, Saturday and Sunday included. A day before
 * the first week (today, from Friday to Sunday) gives the first week: the picker
 * starts from tomorrow.
 */
function weekHolding(now: Date, date: CalendarDate): number {
  const monday = addDays(date, -weekdayOf(date));
  return Math.max(0, Math.round((dayNumber(monday) - dayNumber(firstMonday(now))) / 7));
}

/** "October 2026" */
export function monthTitle(month: PickerMonthRef): string {
  return `${MONTHS_LONG[month.month - 1]} ${month.year}`;
}

/** The month `count` months after `month` (before it when negative). */
export function addMonths(month: PickerMonthRef, count: number): PickerMonthRef {
  const index = month.year * 12 + (month.month - 1) + count;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** How many months `to` is after `from`. */
export function monthsBetween(from: PickerMonthRef, to: PickerMonthRef): number {
  return to.year * 12 + to.month - (from.year * 12 + from.month);
}

/** The first month the picker shows: the month its first week belongs to. Earlier months hold nothing to pick. */
export function pickerFirstMonth(now: Date): PickerMonthRef {
  return pickerWeek(now, 0).month;
}

/** The first picker week the header names as `month`: where the selector and the Week switch land. Week 0 for a month at or before the first. */
export function pickerFirstWeekOf(now: Date, month: PickerMonthRef): number {
  const holding = weekHolding(now, { year: month.year, month: month.month, day: 1 });
  // The week holding the 1st belongs to the month before when the 1st falls on a Thursday or later.
  return monthsBetween(pickerWeek(now, holding).month, month) > 0 ? holding + 1 : holding;
}

/** A day of the month grid (58j). A past day opens nothing; any other opens the picker week holding it. */
export type PickerMonthDay = {
  /** "2026-10-14", the Turin calendar date. */
  readonly date: string;
  readonly day: number;
  /** "Thu 15 Oct", for a screen reader. */
  readonly label: string;
  /** False for the days of the months either side that fill the first and last rows. */
  readonly inMonth: boolean;
  readonly today: boolean;
  /** How many picked starts fall on this day. */
  readonly count: number;
} & ({ readonly past: true } | { readonly past: false; readonly week: number });

export type PickerMonth = { readonly title: string; readonly days: readonly PickerMonthDay[] };

/**
 * The month grid (58j): Monday to Sunday rows from the week holding the 1st to
 * the week holding the last day, in Turin dates. A day before today is past
 * and cannot be opened; any other opens the picker week holding it.
 */
export function pickerMonth(now: Date, month: PickerMonthRef, picked: Iterable<string>): PickerMonth {
  const counts = new Map<string, number>();
  for (const start of picked) {
    const key = romeDateKey(start);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const today = dateKey(romeParts(now));
  const first: CalendarDate = { year: month.year, month: month.month, day: 1 };
  const last = addDays({ ...addMonths(month, 1), day: 1 }, -1);
  const start = addDays(first, -weekdayOf(first));
  const length = dayNumber(addDays(last, 6 - weekdayOf(last))) - dayNumber(start) + 1;
  const days = Array.from({ length }, (_, i): PickerMonthDay => {
    const date = addDays(start, i);
    const key = dateKey(date);
    const week = weekHolding(now, date);
    const base = {
      date: key,
      day: date.day,
      label: `${WEEKDAYS[weekdayOf(date)]} ${date.day} ${MONTHS[date.month - 1]}`,
      inMonth: date.month === month.month && date.year === month.year,
      today: key === today,
      count: counts.get(key) ?? 0,
    };
    return key < today ? { ...base, past: true } : { ...base, past: false, week };
  });
  return { title: monthTitle(month), days };
}

/** "17:30" for a picker start. */
export function clockOf(iso: string): string {
  return hhmm(romeParts(new Date(iso)));
}

/** "9 times picked across 5 days": how many starts are picked, on how many Turin days. */
export function pickedCount(starts: Iterable<string>): string {
  const all = [...starts];
  const days = new Set(all.map(romeDateKey)).size;
  return `${all.length} ${all.length === 1 ? "time" : "times"} picked across ${days} ${days === 1 ? "day" : "days"}`;
}

/** "1 time", "2 times": a day's count in the month grid. */
export function timesOnDay(count: number): string {
  return `${count} ${count === 1 ? "time" : "times"}`;
}

// Add to calendar (58d) ----------------------------------------------------------

function icsStamp(at: Date): string {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/**
 * The booked interview as an iCalendar file, for the lead's own calendar.
 * The site sends no invite: the file is a download, nothing more.
 */
export function interviewIcs(
  { applicationId, applicant, position, slot }: { applicationId: number; applicant: string; position: string; slot: SlotTime },
  now: Date,
): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PoliTo Rocket Team//Dashboard//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:interview-${applicationId}-${icsStamp(new Date(slot.start))}@politorocketteam.it`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(new Date(slot.start))}`,
    `DTEND:${icsStamp(slotEnd(slot))}`,
    `SUMMARY:${icsText(`Interview: ${applicant}, ${position}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** "interview-giulia-rossi.ics" */
export function icsFileName(applicant: string): string {
  const slug = applicant
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `interview-${slug || "applicant"}.ics`;
}

// Words about the applicant ------------------------------------------------------

export type Pronouns = { readonly subject: string; readonly object: string; readonly possessive: string };

/** From the application form's gender: she, he, or they when it says neither. */
export function pronounsOf(gender: string | null): Pronouns {
  if (gender === "Female") return { subject: "she", object: "her", possessive: "her" };
  if (gender === "Male") return { subject: "he", object: "him", possessive: "his" };
  return { subject: "they", object: "them", possessive: "their" };
}

/** "Giulia" from "Giulia Rossi". */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** "Aerospace Eng. · MSc 1" from "Aerospace Engineering" and "Year 1 Master's" (board 58b). */
export function studiesLine(degree: string | null, year: string | null): string | null {
  return [studiesProgram(degree), studiesLevel(year)].filter(Boolean).join(" · ") || null;
}

/** The program half of the studies column: "Aerospace Eng."; null or empty when none was given. */
export function studiesProgram(degree: string | null): string | null {
  return degree?.replace(/\bEngineering\b/, "Eng.") ?? null;
}

/** The level half of the studies column: "MSc 1"; another year reads as given, null or empty when none was given. */
export function studiesLevel(year: string | null): string | null {
  const match = year ? /^Year (\d+) (Master's|Bachelor's)$/.exec(year) : null;
  return match ? `${match[2] === "Master's" ? "MSc" : "BSc"} ${match[1]}` : year;
}
