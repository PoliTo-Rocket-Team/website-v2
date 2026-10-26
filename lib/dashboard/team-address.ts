import { z } from "zod";
import { attributedName } from "./acting-account";
import { answersAliasRequests, domainAddressOf, mayAskFor, TEAM_DOMAIN } from "./alias-request";
import type { Checked } from "./department-edit";
import type { TeamPerson } from "./division-edit";
import { sentWhen } from "./hand-over-request";
import type { AddressedNotice } from "./notices";
import { divisionShortName, type AttentionItem } from "./overview";
import type { OrgChart } from "./team";
import { FLAG_OF_SEAT, SEAT_OF_FLAG, type FlaggedSeat, type SeatFlag, type ViewerStanding } from "./viewer";

// Shared team addresses (epic #578, issue #786; board 102). Besides each
// member's PRT email, the team has shared addresses on the team domain, such
// as a recruitment or a logistics address. Each one has one holder, says
// what it is for, and may move with a role: when that role changes hands,
// the address follows it (a later slice of the epic). This module owns the
// tie, its label and how the member side view lists a member's addresses;
// `team_addresses` stores what it says. It also owns Request team address
// (issue #787, board 102b): who may ask, the address and purpose checks and
// the one open request per address; `team_address_requests` stores it. And
// the approvers' answer (issue #788, the alias boards 94c and 94d): who
// answers, Decline and Mark created, their rows under Needs your attention
// and the notices to the requester.

/**
 * The role a team address moves with (grill #785, R1.1): one the org model
 * names stably, never a free-text label. A full-access seat is read from its
 * `roles.full_access` flag, a head by their department, a lead by their
 * division.
 */
export type MovesWith =
  | { readonly kind: "team-leader" }
  | { readonly kind: "full-access-seat"; readonly seat: FlaggedSeat }
  | { readonly kind: "department-head"; readonly departmentId: number }
  | { readonly kind: "division-lead"; readonly divisionId: number };

/** A team address as stored: the address, what it is for, its holder and the role it moves with, if any. */
export type TeamAddress = {
  readonly address: string;
  readonly purpose: string;
  readonly holderId: number;
  readonly movesWith: MovesWith | null;
};

/** The tie as `team_addresses` stores it: its kind and the one reference that kind needs. */
export type StoredTie = {
  readonly moves_with: "team_leader" | "full_access_seat" | "department_head" | "division_lead" | null;
  readonly moves_with_seat: SeatFlag | null;
  readonly moves_with_dept_id: number | null;
  readonly moves_with_division_id: number | null;
};

/**
 * The tie a stored row holds. The database's `team_addresses_tie` check
 * keeps the reference each kind needs, so a kind without it reads as no tie
 * rather than a broken one.
 */
export function movesWithOf(row: StoredTie): MovesWith | null {
  switch (row.moves_with) {
    case "team_leader":
      return { kind: "team-leader" };
    case "full_access_seat":
      return row.moves_with_seat === null ? null : { kind: "full-access-seat", seat: SEAT_OF_FLAG[row.moves_with_seat] };
    case "department_head":
      return row.moves_with_dept_id === null ? null : { kind: "department-head", departmentId: row.moves_with_dept_id };
    case "division_lead":
      return row.moves_with_division_id === null ? null : { kind: "division-lead", divisionId: row.moves_with_division_id };
    case null:
      return null;
  }
}

/** The tie as the tables store it: `movesWithOf` read the other way. */
export function storedTieOf(tie: MovesWith | null): StoredTie {
  const none = { moves_with: null, moves_with_seat: null, moves_with_dept_id: null, moves_with_division_id: null } as const;
  if (tie === null) return none;
  switch (tie.kind) {
    case "team-leader":
      return { ...none, moves_with: "team_leader" };
    case "full-access-seat":
      return { ...none, moves_with: "full_access_seat", moves_with_seat: FLAG_OF_SEAT[tie.seat] };
    case "department-head":
      return { ...none, moves_with: "department_head", moves_with_dept_id: tie.departmentId };
    case "division-lead":
      return { ...none, moves_with: "division_lead", moves_with_division_id: tie.divisionId };
  }
}

/** Each full-access seat as the org chart names it. */
const SEAT_ROLE_NAMES: Readonly<Record<FlaggedSeat, string>> = {
  "operations-lead": "Operations Lead",
  "it-lead": "IT Lead",
  "project-manager": "Project Manager",
  "chief-engineer": "Chief Engineer",
};

/**
 * The role a tie names, as the org chart names it: "Team Leader", "IT
 * Lead", "Head of Propulsion", "Logistics Lead". A unit the chart no longer
 * holds (closed since) reads by its role alone.
 */
export function movesWithLabel(tie: MovesWith, org: OrgChart): string {
  switch (tie.kind) {
    case "team-leader":
      return "Team Leader";
    case "full-access-seat":
      return SEAT_ROLE_NAMES[tie.seat];
    case "department-head": {
      const department = org.departments.find((d) => d.id === tie.departmentId);
      return department === undefined ? "Department Head" : `Head of ${department.name}`;
    }
    case "division-lead": {
      const division = org.divisions.find((d) => d.id === tie.divisionId);
      return division === undefined ? "Division Lead" : `${divisionShortName(division.name)} Lead`;
    }
  }
}

/** One line of the side view's Team addresses row (board 102): the address, what it is for, and the role it moves with, if any. */
export type TeamAddressLine = {
  readonly address: string;
  readonly purpose: string;
  /** "Logistics Lead"; null for an address tied to no role. */
  readonly movesWith: string | null;
};

// Moves with (board 102b, grill #785 R1.1) ------------------------------------------

/** The full-access seats in the order Moves with lists them. */
const SEATS: readonly FlaggedSeat[] = ["operations-lead", "it-lead", "project-manager", "chief-engineer"];

/**
 * Every role a team address may move with on the current org chart (grill
 * #785, R1.1): the team leader, each full-access seat, each department's
 * head and each division's lead, in that order.
 */
export function movesWithChoices(org: OrgChart): MovesWith[] {
  return [
    { kind: "team-leader" },
    ...SEATS.map((seat): MovesWith => ({ kind: "full-access-seat", seat })),
    ...org.departments.map((d): MovesWith => ({ kind: "department-head", departmentId: d.id })),
    ...org.divisions.map((d): MovesWith => ({ kind: "division-lead", divisionId: d.id })),
  ];
}

/** How Moves with sends a tie: "team-leader", "seat:it-lead", "head:7", "lead:9". */
export function movesWithKey(tie: MovesWith): string {
  switch (tie.kind) {
    case "team-leader":
      return "team-leader";
    case "full-access-seat":
      return `seat:${tie.seat}`;
    case "department-head":
      return `head:${tie.departmentId}`;
    case "division-lead":
      return `lead:${tie.divisionId}`;
  }
}

/** One role Moves with offers: the key it is sent as, and its name on the org chart. */
export type MovesWithOption = { readonly key: string; readonly label: string };

/** The roles Moves with offers (`movesWithChoices`), each named as the org chart names it. */
export function movesWithOptions(org: OrgChart): MovesWithOption[] {
  return movesWithChoices(org).map((tie) => ({ key: movesWithKey(tie), label: movesWithLabel(tie, org) }));
}

// Request team address (board 102b, issue #787) -------------------------------------

/** The longest "What it's for" the dialog takes. */
export const PURPOSE_MAX = 120;

/**
 * The address as typed, checked before it is sent: the alias address check
 * (`domainAddressOf`), so one word or a dotted name, on the team domain
 * only. Read in lower case.
 */
export function checkTeamAddress(input: string): Checked<string> {
  const typed = input.trim();
  const at = typed.lastIndexOf("@");
  if ((at === -1 ? typed : typed.slice(0, at)) === "") return { ok: false, error: "Type the address." };
  const checked = domainAddressOf(typed);
  if (checked === "off-domain") return { ok: false, error: `A team address must end with @${TEAM_DOMAIN}.` };
  if (checked === "shape") return { ok: false, error: "Use one word, such as recruitment, or a dotted name, such as team.events." };
  return { ok: true, value: checked.address };
}

/** What the address is for, as typed: required, as `team_addresses.purpose` is, and at most `PURPOSE_MAX` characters. */
export function checkPurpose(input: string): Checked<string> {
  const purpose = input.trim();
  if (purpose === "") return { ok: false, error: "Say what the address is for." };
  if (purpose.length > PURPOSE_MAX) return { ok: false, error: `Keep it to ${PURPOSE_MAX} characters.` };
  return { ok: true, value: purpose };
}

/** A request as the dialog sends it: the member, the whole address, what it is for, and the Moves with key or null. */
export type TeamAddressRequestInput = {
  readonly memberId: number;
  readonly address: string;
  readonly purpose: string;
  readonly movesWith: string | null;
};

const requestSchema = z.object({
  memberId: z.number().int().positive(),
  address: z.string().max(200),
  purpose: z.string().max(PURPOSE_MAX * 4),
  movesWith: z.string().max(100).nullable(),
});

/** A request whose fields are checked: the address in lower case, the purpose trimmed, and the tie it names. */
export type TeamAddressRequest = {
  readonly memberId: number;
  readonly address: string;
  readonly purpose: string;
  readonly movesWith: MovesWith | null;
};

/**
 * A request as sent, checked field by field: the address
 * (`checkTeamAddress`), what it is for (`checkPurpose`), and a Moves with
 * that is a role on the current org chart (`movesWithChoices`) or none. Who
 * may ask and the duplicates are `planTeamAddressRequest`'s.
 */
export function checkTeamAddressRequest(input: unknown, org: OrgChart): Checked<TeamAddressRequest> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Fill in the address and what it is for." };
  const { memberId, movesWith: key } = parsed.data;
  const address = checkTeamAddress(parsed.data.address);
  if (!address.ok) return address;
  const purpose = checkPurpose(parsed.data.purpose);
  if (!purpose.ok) return purpose;
  const movesWith = key === null ? null : movesWithChoices(org).find((tie) => movesWithKey(tie) === key);
  if (movesWith === undefined) return { ok: false, error: "Choose Moves with from the list." };
  return { ok: true, value: { memberId, address: address.value, purpose: purpose.value, movesWith } };
}

/** A request the rules allow, as it is stored open. */
export type PlannedTeamAddressRequest = TeamAddressRequest & { readonly requesterId: number };

/** The refusal of a second open request for an address, from the check or from the database index. */
export function alreadyRequested(address: string): string {
  return `${address} is already requested.`;
}

/**
 * Request team address as the rules allow it, or the first reason it is
 * refused: the requester may ask for the member by the alias rule of issue
 * #721 (`mayAskFor`), and the address is neither a team address already nor
 * asked for by an open request, in any letter case. The database refuses a
 * second open request for an address too (`team_address_requests_one_open`).
 */
export function planTeamAddressRequest(input: {
  readonly requesterId: number | null;
  /** The requester's standing: full access asks for anyone on the team. */
  readonly standing: ViewerStanding;
  readonly request: TeamAddressRequest;
  readonly team: readonly TeamPerson[];
  readonly org: OrgChart;
  /** Team addresses as stored; only one equal to the request's is read. */
  readonly held: readonly string[];
  /** The addresses open requests ask for; only one equal to the request's is read. */
  readonly open: readonly string[];
}): Checked<PlannedTeamAddressRequest> {
  const { requesterId, standing, request, team, org } = input;
  if (requesterId === null || !mayAskFor(requesterId, standing, request.memberId, team, org)) {
    return { ok: false, error: "You can request a team address only for someone you lead or head." };
  }
  const same = (address: string) => address.toLowerCase() === request.address;
  if (input.held.some(same)) return { ok: false, error: `${request.address} is already a team address.` };
  if (input.open.some(same)) return { ok: false, error: alreadyRequested(request.address) };
  return { ok: true, value: { ...request, requesterId } };
}

// How it reads (boards 102 and 102b) -------------------------------------------------

/**
 * One member's Team addresses row in the side view: the addresses they hold,
 * sorted by address, and whether the viewer may request one for them, which
 * puts Request team address at the row's end.
 */
export type TeamAddressRow = { readonly lines: readonly TeamAddressLine[]; readonly requestable: boolean };

/**
 * The Team addresses rows the Members page shows, by member id, and the
 * roles the request dialog offers. A member who holds none and whom the
 * viewer may not ask for is left out, so their row is hidden.
 */
export type MemberTeamAddresses = {
  readonly rows: Readonly<Record<number, TeamAddressRow>>;
  /** Moves with's roles (`movesWithOptions`); empty when the viewer may ask for nobody. */
  readonly movesWith: readonly MovesWithOption[];
};

/** No rows: what a viewer who does not reach the Members page reads. */
export const NO_TEAM_ADDRESSES: MemberTeamAddresses = { rows: {}, movesWith: [] };

/** Orders addresses by the address, in any letter case. */
function byAddress(a: TeamAddressLine, b: TeamAddressLine): number {
  const x = a.address.toLowerCase();
  const y = b.address.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * The Team addresses row of each of `memberIds` on the team (boards 102 and
 * 102b): every address they hold, sorted by address, and Request team
 * address when `mayAskFor` lets the viewer ask for them, the check the
 * server runs too. A member off the team, or one who holds none and whom
 * the viewer may not ask for, is left out, so the row is hidden for them.
 */
export function memberTeamAddressesFor(input: {
  readonly viewerId: number | null;
  /** The viewer's standing: full access may request for anyone on the team. */
  readonly standing: ViewerStanding;
  readonly memberIds: readonly number[];
  readonly team: readonly TeamPerson[];
  readonly org: OrgChart;
  readonly held: readonly TeamAddress[];
}): MemberTeamAddresses {
  const { viewerId, standing, team, org, held } = input;
  const rows: Record<number, TeamAddressRow> = {};
  for (const memberId of input.memberIds) {
    if (!team.some((p) => p.id === memberId)) continue;
    const lines = held
      .filter((a) => a.holderId === memberId)
      .map((a): TeamAddressLine => ({
        address: a.address,
        purpose: a.purpose,
        movesWith: a.movesWith === null ? null : movesWithLabel(a.movesWith, org),
      }))
      .sort(byAddress);
    const requestable = viewerId !== null && mayAskFor(viewerId, standing, memberId, team, org);
    if (lines.length > 0 || requestable) rows[memberId] = { lines, requestable };
  }
  const asks = Object.values(rows).some((row) => row.requestable);
  return { rows, movesWith: asks ? movesWithOptions(org) : [] };
}

// Decline and Mark created (the alias boards 94c and 94d, issue #788) ---------------

/** An open team address request, as the approvers' rows and their answer read it. `requesterId` is null once the requester's record is gone. */
export type OpenTeamAddressRequest = {
  readonly id: number;
  readonly memberId: number;
  /** The address asked for, in lower case. */
  readonly address: string;
  readonly purpose: string;
  readonly movesWith: MovesWith | null;
  readonly requesterId: number | null;
  /** The acting seat's title when it was sent while viewing as the requester (issue #605); absent or null otherwise. */
  readonly requesterActingTitle?: string | null;
  /** When it was sent, an ISO timestamp. */
  readonly sentAt: string;
};

/** An approver's answer: Decline, or Mark created with the address as confirmed in the dialog. */
export type TeamAddressAnswer = { readonly kind: "decline" } | { readonly kind: "created"; readonly address: string };

const answerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("decline") }),
  z.object({ kind: z.literal("created"), address: z.string().max(200) }),
]);

/** An answer as sent, in its shape; the rules are `planTeamAddressAnswer`'s. */
export function checkTeamAddressAnswer(input: unknown): Checked<TeamAddressAnswer> {
  const result = answerSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: "Choose Decline or Mark created." };
}

/** An answer as the rules allow it: what closes the request, and for Mark created the address saved under the member. */
export type TeamAddressAnswerPlan =
  | { readonly kind: "decline"; readonly request: OpenTeamAddressRequest }
  | { readonly kind: "created"; readonly request: OpenTeamAddressRequest; readonly address: string };

/** The refusal of an address someone already holds, from the check or from the database index. */
export function alreadyHeld(address: string): string {
  return `${address} is already a team address.`;
}

/**
 * Decline or Mark created as the rules allow it, or the first reason it is
 * refused (Owner decision, 2026-10-26): only the alias approver seats answer
 * (`answersAliasRequests`: the team leader, the operations lead and the IT
 * lead). Mark created checks the confirmed address again (`checkTeamAddress`),
 * and refuses one that is a team address already or that another open
 * request asks for, in any letter case. The database refuses a second holder
 * too (`team_addresses_address`).
 */
export function planTeamAddressAnswer(input: {
  readonly viewer: ViewerStanding;
  readonly request: OpenTeamAddressRequest;
  readonly answer: TeamAddressAnswer;
  /** Team addresses as stored; only one equal to the confirmed address is read. */
  readonly held: readonly string[];
  /** The addresses the other open requests ask for; only one equal to the confirmed address is read. */
  readonly openElsewhere: readonly string[];
}): Checked<TeamAddressAnswerPlan> {
  const { viewer, request, answer } = input;
  if (!answersAliasRequests(viewer)) {
    return { ok: false, error: "Only the team leader, the operations lead or the IT lead can answer team address requests." };
  }
  if (answer.kind === "decline") return { ok: true, value: { kind: "decline", request } };
  const checked = checkTeamAddress(answer.address);
  if (!checked.ok) return checked;
  const address = checked.value;
  const same = (other: string) => other.toLowerCase() === address;
  if (input.held.some(same)) return { ok: false, error: alreadyHeld(address) };
  if (input.openElsewhere.some(same)) return { ok: false, error: alreadyRequested(address) };
  return { ok: true, value: { kind: "created", request, address } };
}

/**
 * Who an answer tells: Mark created and Decline each tell the requester,
 * themselves included when they asked for their own address, since no card
 * tells the member of it as one tells them of their alias. A request whose
 * requester's record is gone tells nobody. Each notice is about the member;
 * `approver` names who declined.
 */
export function teamAddressAnswerNotices(plan: TeamAddressAnswerPlan, approver: string): AddressedNotice[] {
  const { requesterId } = plan.request;
  if (requesterId === null) return [];
  if (plan.kind === "decline") {
    return [{ recipientId: requesterId, notice: { kind: "team-address-declined", data: { address: plan.request.address, by: approver } } }];
  }
  return [{ recipientId: requesterId, notice: { kind: "team-address-created", data: { address: plan.address } } }];
}

/**
 * An open request as the approver's row under Needs your attention, drawn as
 * board 94c draws an alias request: "Marco Bianchi asks for
 * recruitment@politorocketteam.it for Davide Russo", then what it is for,
 * the role it moves with and when it was sent, with Decline and Mark
 * created. Mark created's dialog starts from the address asked for.
 */
export function teamAddressAttention(
  request: OpenTeamAddressRequest,
  member: TeamPerson,
  team: readonly TeamPerson[],
  org: OrgChart,
  now: Date,
): AttentionItem {
  const requester = attributedName(team.find((p) => p.id === request.requesterId)?.name ?? "Someone", request.requesterActingTitle ?? null);
  const movesWith = request.movesWith === null ? null : `moves with ${movesWithLabel(request.movesWith, org)}`;
  return {
    kind: "team-address-request",
    title: `${requester} asks for ${request.address} for ${member.name}`,
    phoneTitle: `${request.address} for ${member.name}`,
    detail: [request.purpose, movesWith, `sent ${sentWhen(request.sentAt, now)}`].filter(Boolean).join(" · "),
    action: { answerTeamAddress: request.id, member: member.name, address: request.address, purpose: request.purpose },
  };
}

/**
 * The open requests as the viewer's rows, oldest first: one per request for
 * each approver seat (`answersAliasRequests`), none for anyone else. A
 * request for someone no longer on the team is not shown.
 */
export function teamAddressAttentionFor(
  viewer: ViewerStanding,
  open: readonly OpenTeamAddressRequest[],
  team: readonly TeamPerson[],
  org: OrgChart,
  now: Date,
): AttentionItem[] {
  if (!answersAliasRequests(viewer)) return [];
  return [...open]
    .sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt) || a.id - b.id)
    .flatMap((r) => {
      const member = team.find((p) => p.id === r.memberId);
      return member === undefined ? [] : [teamAddressAttention(r, member, team, org, now)];
    });
}
