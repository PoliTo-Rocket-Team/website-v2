import { z } from "zod";
import { attributedName } from "./acting-account";
import { answersAliasRequests, domainAddressOf, mayAskFor, TEAM_DOMAIN, type AliasTeamPerson } from "./alias-request";
import type { Checked } from "./department-edit";
import type { TeamPerson } from "./division-edit";
import type { SeatMove } from "./hand-over";
import { sentWhen } from "./hand-over-request";
import type { AddressedNotice } from "./notices";
import { divisionShortName, type AttentionItem } from "./overview";
import { headDepartmentOf, type OrgChart, type RoleSeat } from "./team";
import { FLAG_OF_SEAT, isOffTeam, SEAT_OF_FLAG, type FlaggedSeat, type SeatFlag, type ViewerKind, type ViewerStanding } from "./viewer";

// Shared team addresses (epic #578, issue #786; board 102). Besides each
// member's PRT email, the team has shared addresses on the team domain, such
// as a recruitment or a logistics address. Each one has one holder, says
// what it is for, and may move with a role: when that role changes hands,
// the address follows it. This module owns the
// tie, its label and how the member side view lists a member's addresses;
// `team_addresses` stores what it says. It also owns Request team address
// (issue #787, board 102b): who may ask, the address and purpose checks and
// the one open request per address; `team_address_requests` stores it. And
// the approvers' answer (issue #788, the alias boards 94c and 94d): who
// answers, Decline and Mark created, their rows under Needs your attention
// and the notices to the requester. Last, the routing item a role change
// raises when the role an address moves with changes hands (issue #789): the
// approvers move the address with Mark done; `team_address_reroutes` stores it.

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
 * created. Mark created's dialog starts from the address asked for, and
 * shows the member's sign-in email, which the address forwards to, as the
 * alias dialog does (issue #586).
 */
export function teamAddressAttention(
  request: OpenTeamAddressRequest,
  member: AliasTeamPerson,
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
    action: { answerTeamAddress: request.id, member: member.name, address: request.address, purpose: request.purpose, signInEmail: member.signInEmail },
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
  team: readonly AliasTeamPerson[],
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

// Routing when a tied role changes hands (issue #789; grill #785, R1.2) -----------

/** A team address as a role change reads it: its row id beside what it stores. */
export type StoredTeamAddress = TeamAddress & { readonly id: number };

/**
 * What one role change does to one tied role: the people it hands the role
 * to, one who held it already included (a lead handing a division over to a
 * co-lead, issue #795), and the holders it keeps. A role one person holds
 * (the team leader, a full-access seat, a department's head) keeps nobody
 * when it changes hands; a division keeps the leads the change does not
 * replace.
 */
export type TiedRoleChange = {
  readonly tie: MovesWith;
  readonly becoming: readonly number[];
  readonly staying: readonly number[];
};

/** A role one person holds, handed to `memberId`: they are its only holder after the change. */
export function handedTo(tie: MovesWith, memberId: number): TiedRoleChange {
  return { tie, becoming: [memberId], staying: [] };
}

/** The full-access seat a hand-over moves (`seatHandOver`, ./hand-over.ts), as a change of its tie; none when no seat moves. */
export function seatHandedTo(seat: SeatMove | null): TiedRoleChange[] {
  return seat === null ? [] : [handedTo({ kind: "full-access-seat", seat: seat.seat }, seat.to)];
}

/** One open routing item to write: the address, the member it goes to, and its holder now. */
export type TeamAddressReroute = { readonly addressId: number; readonly toId: number; readonly fromId: number };

/**
 * The routing items a role change owes (Owner decision on epic #578,
 * 2026-10-26; grill #785, R1.2; issue #795): one for an address when the
 * change hands the role it moves with to someone and the address's holder
 * does not hold that role after the change. A hand-over to someone who
 * already co-leads owes one too. Adding a co-lead beside a holder who still
 * leads owes nothing, and neither does an address tied to no role. When the
 * change hands the role to two people, the first by member id is named.
 * Several changes of one role in one write read as one.
 *
 * An address with an open item keeps that one item: it is owed again, so
 * the item names the new holder, only when the member it names no longer
 * holds the role after the change. The write updates the open item rather
 * than adding a second.
 */
export function owedTeamAddressReroutes(input: {
  /** The team addresses; only those with a tie are read. */
  readonly addresses: readonly StoredTeamAddress[];
  readonly changes: readonly TiedRoleChange[];
  /** The open routing items: the address each is for, and the member it names. */
  readonly open: readonly { readonly addressId: number; readonly toId: number }[];
}): TeamAddressReroute[] {
  return input.addresses.flatMap((address) => {
    const { movesWith } = address;
    if (movesWith === null) return [];
    const changes = input.changes.filter((c) => movesWithKey(c.tie) === movesWithKey(movesWith));
    const becoming = [...new Set(changes.flatMap((c) => c.becoming))].sort((a, b) => a - b);
    const holdersAfter = new Set([...becoming, ...changes.flatMap((c) => c.staying)]);
    const named = input.open.find((r) => r.addressId === address.id)?.toId;
    const [to] = becoming;
    if (to === undefined || holdersAfter.has(address.holderId) || (named !== undefined && holdersAfter.has(named))) return [];
    return [{ addressId: address.id, toId: to, fromId: address.holderId }];
  });
}

/** One active `roles` row, as the holder of a tied role is read from it. */
export type TieRoleRow = Pick<RoleSeat, "id" | "since" | "type" | "departmentId" | "divisionId" | "fullAccess"> & { readonly memberId: number };

/** Orders role rows newest first: by when they started, then by row id. */
function newestFirst(a: TieRoleRow, b: TieRoleRow): number {
  return a.since < b.since ? 1 : a.since > b.since ? -1 : b.id - a.id;
}

/**
 * Who holds a tied role now, from the active `roles` rows, the newest holder
 * first: the team leader by the `president` type, a full-access seat by its
 * flag, a department's head wherever the head row is kept
 * (`headDepartmentOf`), and a division's leads by its `lead` rows, as the
 * role changes read them: a head row kept on a division is the head's seat,
 * not a lead of it.
 */
export function holdersOf(tie: MovesWith, active: readonly TieRoleRow[], org: OrgChart): number[] {
  const holds = (r: TieRoleRow): boolean => {
    switch (tie.kind) {
      case "team-leader":
        return r.type === "president";
      case "full-access-seat":
        return r.fullAccess === tie.seat;
      case "department-head":
        return r.type === "head" && headDepartmentOf(r, org) === tie.departmentId;
      case "division-lead":
        return r.divisionId === tie.divisionId && r.type === "lead";
    }
  };
  return [...new Set(active.filter(holds).sort(newestFirst).map((r) => r.memberId))];
}

/**
 * An open routing item as `team_address_reroutes` stores it, beside its
 * address's holder now. `toId` is the member it last named, which the role
 * may have left since.
 */
export type StoredTeamAddressReroute = {
  readonly id: number;
  readonly addressId: number;
  readonly address: string;
  readonly movesWith: MovesWith | null;
  readonly holderId: number;
  readonly toId: number;
  readonly fromId: number | null;
  readonly createdAt: string;
};

/**
 * An open routing item, as the approvers' rows and Mark done read it.
 * `toId` is who holds the role now (`rerouteTargetNow`), null when there is
 * nobody to move the address to. `fromId` is null once that member's record
 * is gone.
 */
export type OpenTeamAddressReroute = {
  readonly id: number;
  readonly addressId: number;
  readonly address: string;
  readonly movesWith: MovesWith | null;
  readonly toId: number | null;
  readonly fromId: number | null;
  /** When the role last changed hands, an ISO timestamp. */
  readonly createdAt: string;
};

/**
 * The member an open routing item moves its address to now (Owner decision
 * on epic #578, 2026-10-26; issue #795): always someone who holds the tied
 * role at this moment, never a stored earlier holder. The member the item
 * names while they still hold it, else the role's newest holder, the one who
 * took it over after that member left it. Null when
 * the address's holder holds the role again, when nobody does, and for an
 * address tied to no role: then there is nothing to move.
 */
export function rerouteTargetNow(reroute: StoredTeamAddressReroute, active: readonly TieRoleRow[], org: OrgChart): number | null {
  if (reroute.movesWith === null) return null;
  const holders = holdersOf(reroute.movesWith, active, org);
  if (holders.includes(reroute.holderId)) return null;
  return holders.includes(reroute.toId) ? reroute.toId : (holders[0] ?? null);
}

/** The open routing items, each naming who holds its role now (`rerouteTargetNow`). */
export function reroutesNow(stored: readonly StoredTeamAddressReroute[], active: readonly TieRoleRow[], org: OrgChart): OpenTeamAddressReroute[] {
  return stored.map((r) => ({
    id: r.id,
    addressId: r.addressId,
    address: r.address,
    movesWith: r.movesWith,
    toId: rerouteTargetNow(r, active, org),
    fromId: r.fromId,
    createdAt: r.createdAt,
  }));
}

/** What a second Mark done, or one on an item gone meanwhile, reads. */
export const REROUTE_ALREADY_DONE = "This team address was already moved.";

/** What Mark done reads when nobody but the address's holder, or nobody at all, holds the role now. */
export const REROUTE_NOWHERE =
  "Nobody else holds this role now, so the team address stays with its holder. There is nothing to move; a new item shows when the role changes hands.";

/** What Mark done reads when the role changed hands while it was moving the address (issue #795). */
export const REROUTE_ROLE_MOVED =
  "The role changed hands while you were moving this team address, so nothing was moved. The item now names who holds the role; check it and press Mark done again.";

/**
 * What one Mark done moves (issue #795): the item and its address, the role
 * the address moves with, and what Mark done read beside them: the address's
 * holder, the member the item named, and the member the address goes to
 * (`rerouteTargetNow`). The write moves the address only while all of these
 * still stand, so a role change between the read and the write cannot send
 * the address to someone who left the role.
 */
export type RerouteMove = {
  readonly rerouteId: number;
  readonly addressId: number;
  readonly movesWith: MovesWith;
  readonly holderId: number;
  readonly namedId: number;
  readonly toId: number;
};

/** The move Mark done makes on an open item now, or why there is none: nobody but its holder, or nobody at all, holds the role. */
export function rerouteMoveOf(reroute: StoredTeamAddressReroute, active: readonly TieRoleRow[], org: OrgChart): Checked<RerouteMove> {
  const toId = rerouteTargetNow(reroute, active, org);
  if (reroute.movesWith === null || toId === null) return { ok: false, error: REROUTE_NOWHERE };
  return {
    ok: true,
    value: { rerouteId: reroute.id, addressId: reroute.addressId, movesWith: reroute.movesWith, holderId: reroute.holderId, namedId: reroute.toId, toId },
  };
}

/** Mark done as the rules allow it: only the alias approver seats (`answersAliasRequests`), who answer team address requests too. */
export function planRerouteDone(viewer: ViewerStanding): Checked<null> {
  return answersAliasRequests(viewer)
    ? { ok: true, value: null }
    : { ok: false, error: "Only the team leader, the operations lead or the IT lead can move a team address." };
}

/**
 * An open routing item as the approver's row under Needs your attention:
 * "logistics@politorocketteam.it goes to Davide Russo", then the role they
 * took and when, whose address it was and the new holder's sign-in email,
 * with Mark done, whose dialog shows that email as Forwards to.
 */
export function teamAddressRerouteAttention(
  reroute: OpenTeamAddressReroute & { readonly toId: number },
  to: AliasTeamPerson,
  team: readonly TeamPerson[],
  org: OrgChart,
  now: Date,
): AttentionItem {
  const from = team.find((p) => p.id === reroute.fromId)?.name;
  const role = reroute.movesWith === null ? null : `${movesWithLabel(reroute.movesWith, org)} since ${sentWhen(reroute.createdAt, now)}`;
  return {
    kind: "team-address-reroute",
    title: `${reroute.address} goes to ${to.name}`,
    phoneTitle: `${reroute.address} to ${to.name}`,
    detail: [role, from === undefined ? null : `was ${from}'s`, to.signInEmail].filter(Boolean).join(" · "),
    action: { markRerouteDone: reroute.id, address: reroute.address, member: to.name, signInEmail: to.signInEmail },
  };
}

/**
 * The open routing items as the viewer's rows, oldest first: one per item for
 * each approver seat (`answersAliasRequests`), none for anyone else. An item
 * with nobody to move the address to (`rerouteTargetNow`), or for someone no
 * longer on the team, is not shown.
 */
export function teamAddressRerouteAttentionFor(
  viewer: ViewerStanding,
  open: readonly OpenTeamAddressReroute[],
  team: readonly AliasTeamPerson[],
  org: OrgChart,
  now: Date,
): AttentionItem[] {
  if (!answersAliasRequests(viewer)) return [];
  return [...open]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id)
    .flatMap((r) => {
      const { toId } = r;
      const to = toId === null ? undefined : team.find((p) => p.id === toId);
      return toId === null || to === undefined ? [] : [teamAddressRerouteAttention({ ...r, toId }, to, team, org, now)];
    });
}

// The holder's own team addresses (owner finding on PR #794; board 94f) -----------

/**
 * A team address the viewer holds, as their Overview reads it: its row id,
 * the address, and whether they said they set it up. As for the email alias
 * (./alias-setup.ts), the Overview shows "Your team address is ready" with
 * the Gmail set-up steps until they press I've set it up; Mark created and a
 * routing item's Mark done each leave the address not set up for its holder.
 */
export type OwnTeamAddress = { readonly id: number; readonly address: string; readonly setUp: boolean };

/**
 * The viewer's own team addresses, sorted by address, or none for someone
 * off the team. Only the rows the viewer holds are ever read into it.
 */
export function ownTeamAddressesOf(input: {
  readonly kind: ViewerKind;
  readonly held: readonly { readonly id: number; readonly address: string; readonly setUpAt: string | null }[];
}): OwnTeamAddress[] {
  if (isOffTeam(input.kind)) return [];
  return input.held.map((r) => ({ id: r.id, address: r.address, setUp: r.setUpAt !== null })).sort((a, b) => a.address.localeCompare(b.address));
}

/** The ready cards the Overview shows: one per own team address not yet set up. */
export function teamAddressCardsOf(own: readonly OwnTeamAddress[]): OwnTeamAddress[] {
  return own.filter((a) => !a.setUp);
}

/**
 * "I've set it up" on a team address, as the rules allow it: only on one the
 * viewer holds, and once. The write touches that address alone.
 */
export function planTeamAddressSetUp(own: readonly OwnTeamAddress[], addressId: number): Checked<OwnTeamAddress> {
  const address = own.find((a) => a.id === addressId);
  if (address === undefined) return { ok: false, error: "You hold no such team address to set up." };
  if (address.setUp) return { ok: false, error: "You already set up this team address." };
  return { ok: true, value: { ...address, setUp: true } };
}
