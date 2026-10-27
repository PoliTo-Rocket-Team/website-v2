import { z } from "zod";
import { attributedName } from "./acting-account";
import type { Checked } from "./department-edit";
import type { TeamPerson } from "./division-edit";
import { sentWhen } from "./hand-over-request";
import type { AddressedNotice } from "./notices";
import { divisionShortName, type AttentionItem } from "./overview";
import type { OrgChart, Permission } from "./team";
import { seatOf, type FullAccessSeat, type ViewerStanding } from "./viewer";
import { shortDate } from "./write";

// Team email alias requests (epic #538, issue #541; boards 94 to 94e). From
// the member drawer, anyone with full access asks for an alias for any member
// on the team, themselves included (Owner decision, 2026-10-25, issue #721),
// and a division lead or a department head asks for a member they lead or
// head. The team leader, the
// operations lead and the IT lead see each open request on their Overview;
// they create the alias by hand in Google Workspace, then mark the request
// created with the address, or decline it. The site may also ask by itself
// (issue #543): such a request has no requester. This module owns who may
// ask, who may answer, the one open request per member, the
// firstname.lastname prefill and the address check; both data sources store
// what it says.
//
// The alias is the member's PRT email (Owner decision, 2026-10-22, issue
// #563): Mark created saves the address as their `prt_email`, and a member
// may be asked for, by hand or by the site, exactly when that field is empty
// and no request is open. Clearing a wrong PRT email makes them requestable
// again.

/** The team's mail domain: every alias ends with it. */
export const TEAM_DOMAIN = "politorocketteam.it";

/** An open alias request. `requesterId` is null for one the site made by itself. */
export type AliasRequest = {
  readonly id: number;
  readonly memberId: number;
  readonly requesterId: number | null;
  /** The acting seat's title when it was sent while viewing as the requester (issue #605); absent or null otherwise. */
  readonly requesterActingTitle?: string | null;
  /**
   * The address the requester confirmed on Request PRT email's Personal
   * choice (issue #798), checked by `checkAliasAddress`; null for a request
   * the site made by itself, or one stored before requests carried it.
   */
  readonly address: string | null;
  /** When it was sent, an ISO timestamp. */
  readonly sentAt: string;
};

/**
 * The member's team address as the alias rules read it: their PRT email, or
 * null while it is empty. A blank field is no address, so a cleared PRT
 * email makes the member requestable again.
 */
export function teamAddressOf(prtEmail: string | null | undefined): string | null {
  const address = prtEmail?.trim() ?? "";
  return address === "" ? null : address;
}

/** How a request closed, as stored. */
export const ALIAS_OUTCOMES = ["created", "declined", "cancelled"] as const;
export type AliasOutcome = (typeof ALIAS_OUTCOMES)[number];

// Who may ask ---------------------------------------------------------------------

/**
 * Whether `requester` leads or heads `member`: the team leader for anyone
 * else on the team, a department head for anyone in a division of their
 * department, a division lead for anyone in a division they lead. Nobody
 * manages themselves, and a grant makes nobody a manager. Who may ask is
 * wider (`mayAskFor`): since the Owner decision of 2026-10-25 (issue #721),
 * anyone with full access asks for any member, themselves included; everyone
 * else asks only for the members this says they manage.
 */
export function managesMember(requester: TeamPerson, member: TeamPerson, org: OrgChart): boolean {
  if (requester.id === member.id) return false;
  if (requester.beyond.some((b) => b.kind === "team-leader")) return true;
  const headed = requester.beyond.flatMap((b) => (b.kind === "head" && b.departmentId !== null ? [b.departmentId] : []));
  const led = requester.memberships.filter((m) => m.role === "lead").map((m) => m.divisionId);
  return member.memberships.some(
    (m) => led.includes(m.divisionId) || headed.includes(org.divisions.find((d) => d.id === m.divisionId)?.departmentId ?? -1),
  );
}

/** Whether `viewerId` leads or heads `memberId` on the team (`managesMember`). */
function managesById(viewerId: number | null, memberId: number, team: readonly TeamPerson[], org: OrgChart): boolean {
  const viewer = team.find((p) => p.id === viewerId);
  const member = team.find((p) => p.id === memberId);
  return viewer !== undefined && member !== undefined && managesMember(viewer, member, org);
}

/**
 * Whether the requester may ask for an alias for `memberId` (Owner decision,
 * 2026-10-25, issue #721): with full access, the `operations-lead` kind of
 * their standing, for anyone on the team, themselves included; else only for
 * a member they lead or head (`managesMember`). Request alias
 * (`planAliasRequest`) and the drawer's button (`memberAliasesFor`) both read
 * this one check, so the button shows exactly when the server would accept.
 * Request team address follows the same rule (epic #578, issue #787,
 * ./team-address.ts).
 */
export function mayAskFor(
  requesterId: number | null,
  standing: ViewerStanding,
  memberId: number,
  team: readonly TeamPerson[],
  org: OrgChart,
): boolean {
  if (standing.kind !== "operations-lead") return managesById(requesterId, memberId, team, org);
  return team.some((p) => p.id === requesterId) && team.some((p) => p.id === memberId);
}

// Who may answer ------------------------------------------------------------------

/**
 * The seats that answer alias requests (Owner decision, 2026-10-22): the team
 * leader, the operations lead and the IT lead. Not the Project Manager or the
 * Chief Engineer, and not full access from a scope row alone (`seatOf` is null).
 */
export const ALIAS_APPROVER_SEATS = ["team-leader", "operations-lead", "it-lead"] as const satisfies readonly FullAccessSeat[];

export function answersAliasRequests(viewer: ViewerStanding): boolean {
  const seat = seatOf(viewer);
  return seat !== null && (ALIAS_APPROVER_SEATS as readonly FullAccessSeat[]).includes(seat);
}

// The address -------------------------------------------------------------------------

function asciiWords(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w !== "");
}

/**
 * The address Mark created starts from (board 94d): firstname.lastname on the
 * team domain, from the member's name. Accents are dropped and a last name of
 * several words is written as one: "Anna De Luca" is anna.deluca.
 */
export function aliasPrefill(name: string): string {
  const [first = "", ...rest] = asciiWords(name);
  const local = rest.length === 0 ? first : `${first}.${rest.join("")}`;
  return `${local}@${TEAM_DOMAIN}`;
}

/** The form the dialog asks for, under the field (board 94d). */
export const ALIAS_FORM_HINT = `firstname.lastname@${TEAM_DOMAIN}`;

const PERSONAL = /^[a-z]+(?:-[a-z]+)*\.[a-z]+(?:-[a-z]+)*$/;
const SPECIAL = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** A checked alias: the address as saved, and whether it is a person's or a special-purpose one. */
export type AliasAddress = { readonly address: string; readonly form: "personal" | "special" };

/**
 * An address on the team domain, as typed, read in lower case: the address
 * and its form, or why it is not one. "off-domain" is anything that does not
 * end with the team domain; "shape" is a part before it that is neither
 * firstname.lastname nor one word. The alias check and the team address
 * check (./team-address.ts) both read it and word the reason their own way.
 */
export function domainAddressOf(input: string): AliasAddress | "off-domain" | "shape" {
  const address = input.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at === -1 || address.slice(at + 1) !== TEAM_DOMAIN) return "off-domain";
  const local = address.slice(0, at);
  if (PERSONAL.test(local)) return { address, form: "personal" };
  if (SPECIAL.test(local)) return { address, form: "special" };
  return "shape";
}

/**
 * The address as typed, checked before it is saved: it ends with the team
 * domain, and before it is firstname.lastname, or one word for a
 * special-purpose address such as sponsoring (Owner input, 2026-10-22).
 * Saved in lower case.
 */
export function checkAliasAddress(input: string): Checked<AliasAddress> {
  const checked = domainAddressOf(input);
  if (checked === "off-domain") return { ok: false, error: `The PRT email must end with @${TEAM_DOMAIN}.` };
  if (checked === "shape") return { ok: false, error: `Use ${ALIAS_FORM_HINT}, or one word for a special-purpose address.` };
  return { ok: true, value: checked };
}

// Request PRT email, Personal (boards 94, 94b; issue #798) ---------------------------

/** Request PRT email's Personal choice as sent: the member, and the address the requester confirmed. */
export type AliasRequestInput = { readonly memberId: number; readonly address: string };

const requestSchema = z.object({ memberId: z.number().int().positive(), address: z.string().max(200) });

/**
 * A personal request as sent, in its shape, with its address checked by
 * `checkAliasAddress` and saved in lower case. Who may ask and the open
 * request are `planAliasRequest`'s.
 */
export function checkAliasRequest(input: unknown): Checked<AliasRequestInput> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Type the PRT email to request." };
  const checked = checkAliasAddress(parsed.data.address);
  if (!checked.ok) return checked;
  return { ok: true, value: { memberId: parsed.data.memberId, address: checked.value.address } };
}

/** A personal request the rules allow, as it is stored open. */
export type PlannedAliasRequest = { readonly memberId: number; readonly requesterId: number; readonly address: string };

/**
 * Request PRT email's Personal choice as the rules allow it, or the first
 * reason it is refused: the requester may ask for the member (`mayAskFor`),
 * whose PRT email is empty and who has no open request, and the address is
 * nobody's PRT email and no special PRT email yet, in any letter case. The
 * database refuses a second open request too (`alias_requests_one_open`).
 */
export function planAliasRequest(input: {
  readonly requesterId: number | null;
  /** The requester's standing: full access asks for anyone on the team. */
  readonly standing: ViewerStanding;
  readonly memberId: number;
  readonly team: readonly TeamPerson[];
  readonly org: OrgChart;
  /** The member's PRT email as stored; empty or null is no address. */
  readonly prtEmail: string | null;
  /** The open requests; only the member's is read. */
  readonly open: readonly AliasRequest[];
  /** The checked address the requester confirmed (`checkAliasRequest`). */
  readonly address: string;
  /** The addresses already held: every PRT email and every special PRT email; only one equal to `address` is read. */
  readonly taken: readonly string[];
}): Checked<PlannedAliasRequest> {
  const { requesterId, standing, memberId, team, org, address } = input;
  const member = team.find((p) => p.id === memberId);
  if (requesterId === null || member === undefined || !mayAskFor(requesterId, standing, memberId, team, org)) {
    return { ok: false, error: "You can request a PRT email only for someone you lead or head." };
  }
  if (teamAddressOf(input.prtEmail) !== null) return { ok: false, error: `${member.name} already has a personal PRT email.` };
  if (input.open.some((r) => r.memberId === memberId)) return { ok: false, error: aliasAlreadyRequested(member.name) };
  if (input.taken.some((t) => t.toLowerCase() === address)) return { ok: false, error: `${address} is already a PRT email.` };
  return { ok: true, value: { memberId, requesterId, address } };
}

/** The refusal of a second open personal request for a member, from the check or from the database index. */
export function aliasAlreadyRequested(name: string): string {
  return `A personal PRT email for ${name} is already requested.`;
}

// Automatic requests (issue #543) -------------------------------------------------

/** A request the site makes by itself: it has no requester, so it reads "Automatic" (board 94c). */
export type AutomaticAliasRequest = { readonly memberId: number; readonly requesterId: null };

/**
 * The requests the site owes after a role change (Owner decision,
 * 2026-10-22), as if each person's new head had pressed Request alias:
 * `becoming` is everyone the change makes a division lead, a department head
 * or the team leader, and each of them is owed one request unless their PRT
 * email is already set or they have an open request. Each person is
 * asked for once, so an automatic write never reaches the one-open-request
 * index (`alias_requests_one_open`). The role change and these requests are
 * written together, so a change refused or failed asks for nothing.
 */
export function owedAliasRequests(input: {
  readonly becoming: readonly number[];
  /** Each member's PRT email, by member id; a member missing, or whose PRT email is empty, has none. */
  readonly addresses: ReadonlyMap<number, string>;
  /** The open requests; only those of `becoming` are read. */
  readonly open: readonly Pick<AliasRequest, "memberId">[];
}): AutomaticAliasRequest[] {
  const { addresses, open } = input;
  return [...new Set(input.becoming)]
    .filter((memberId) => teamAddressOf(addresses.get(memberId)) === null && !open.some((r) => r.memberId === memberId))
    .map((memberId) => ({ memberId, requesterId: null }));
}

/**
 * Cancel request (board 94b): whoever sent it, or anyone who leads or heads
 * the member. Full access alone cancels no one else's request: the Owner
 * decision of 2026-10-25 (issue #721) widened who asks, not who cancels.
 */
export function planAliasCancel(input: {
  readonly viewerId: number | null;
  readonly request: AliasRequest;
  readonly team: readonly TeamPerson[];
  readonly org: OrgChart;
}): Checked<AliasRequest> {
  const { viewerId, request, team, org } = input;
  if (viewerId !== null && (viewerId === request.requesterId || managesById(viewerId, request.memberId, team, org))) {
    return { ok: true, value: request };
  }
  return { ok: false, error: "You can cancel only a request for someone you lead or head." };
}

// Decline and Mark created (boards 94c, 94d) ----------------------------------------------

/** An approver's answer: Decline, or Mark created with the address as typed, saved as the member's PRT email. */
export type AliasAnswer = { readonly kind: "decline" } | { readonly kind: "created"; readonly address: string };

const answerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("decline") }),
  z.object({ kind: z.literal("created"), address: z.string().max(200) }),
]);

/** An answer as sent, in its shape; the rules are `planAliasAnswer`'s. */
export function checkAliasAnswer(input: unknown): Checked<AliasAnswer> {
  const result = answerSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: "Choose Decline or Mark created." };
}

/** An answer as the rules allow it: what closes the request, and the address Mark created saves as the PRT email. */
export type AliasAnswerPlan =
  | { readonly kind: "decline"; readonly request: AliasRequest }
  | { readonly kind: "created"; readonly request: AliasRequest; readonly address: string };

/**
 * Decline or Mark created as the rules allow it, or the first reason it is
 * refused: only the three approver seats answer (`answersAliasRequests`), the
 * server refuses everyone else, and Mark created needs an address
 * `checkAliasAddress` accepts.
 */
export function planAliasAnswer(input: {
  readonly viewer: ViewerStanding;
  readonly request: AliasRequest;
  readonly answer: AliasAnswer;
}): Checked<AliasAnswerPlan> {
  const { viewer, request, answer } = input;
  if (!answersAliasRequests(viewer)) return { ok: false, error: "Only the team leader, the operations lead or the IT lead can answer PRT email requests." };
  if (answer.kind === "decline") return { ok: true, value: { kind: "decline", request } };
  const checked = checkAliasAddress(answer.address);
  if (!checked.ok) return checked;
  return { ok: true, value: { kind: "created", request, address: checked.value.address } };
}

/**
 * Who an answer tells (stories 3 and 4): Mark created and Decline each tell the
 * requester. A request the site made has no requester to tell. The member
 * learns of their alias from the board 94f card on their Overview, not from a
 * notice (owner ruling on #550). Each notice is about the member; `approver`
 * names who declined.
 */
export function aliasAnswerNotices(plan: AliasAnswerPlan, approver: string): AddressedNotice[] {
  const { requesterId, memberId } = plan.request;
  const requester = requesterId === null || requesterId === memberId ? [] : [requesterId];
  if (plan.kind === "decline") return requester.map((recipientId) => ({ recipientId, notice: { kind: "alias-declined", data: { by: approver } } }));
  const { address } = plan;
  return requester.map((recipientId): AddressedNotice => ({ recipientId, notice: { kind: "alias-created", data: { address } } }));
}

// How it reads ---------------------------------------------------------------------------

/**
 * A member's alias as the member drawer's PRT email row shows it (boards 94,
 * 94b, 94e; issue #563): their PRT email; while it is empty, the open
 * request, who sent it and when, and whether the viewer may cancel it; or
 * none, and whether the viewer may request one.
 */
export type MemberAlias =
  | { readonly kind: "set"; readonly address: string }
  | { readonly kind: "requested"; readonly requestId: number; readonly line: string; readonly cancellable: boolean }
  | { readonly kind: "none"; readonly requestable: boolean };

/**
 * Whether Request PRT email offers Personal for a member (issue #798): only
 * while they have no personal PRT email and no open personal request, the
 * same rule `planAliasRequest` refuses by; otherwise the reason the dialog
 * shows on the locked choice. `alias` is null when it was not read, which
 * offers nothing.
 */
export function personalRequestChoice(alias: MemberAlias | null, name: string): Permission {
  const first = name.split(" ")[0] || name;
  if (alias?.kind === "none") return { allowed: true };
  if (alias?.kind === "requested") return { allowed: false, reason: `A personal PRT email for ${first} is already requested.` };
  return { allowed: false, reason: `${first} already has a personal PRT email.` };
}

/** Every member's alias the Members page shows, by member id. */
export type MemberAliases = Readonly<Record<number, MemberAlias>>;

/**
 * "by you · 22 Oct", "by Marco Bianchi · 22 Oct", "automatic · 22 Oct": who
 * sent a request, and when (board 94b). One sent while viewing as the
 * requester reads "by IT lead as Marco Bianchi", even to Marco (issue #605).
 */
export function requestedLine(request: AliasRequest, viewerId: number | null, team: readonly TeamPerson[], now: Date): string {
  const by =
    request.requesterId === null
      ? "automatic"
      : request.requesterId === viewerId && !request.requesterActingTitle
        ? "by you"
        : `by ${requesterName(request, team, "someone")}`;
  return `${by} · ${shortDate(request.sentAt, now.getUTCFullYear())}`;
}

/** The requester's name, after the acting seat's title when it was sent while viewing as them. */
function requesterName(request: AliasRequest, team: readonly TeamPerson[], unknown: string): string {
  return attributedName(team.find((p) => p.id === request.requesterId)?.name ?? unknown, request.requesterActingTitle ?? null);
}

/** The alias of each of `memberIds` on the team, as `viewerId` sees it on the member drawer's PRT email row. */
export function memberAliasesFor(input: {
  readonly viewerId: number | null;
  /** The viewer's standing: full access may request for anyone on the team. */
  readonly standing: ViewerStanding;
  readonly memberIds: readonly number[];
  readonly team: readonly TeamPerson[];
  readonly org: OrgChart;
  /** Each member's PRT email, by member id; a member missing, or whose PRT email is empty, has none. */
  readonly addresses: ReadonlyMap<number, string>;
  readonly open: readonly AliasRequest[];
  readonly now: Date;
}): MemberAliases {
  const { viewerId, standing, team, org, addresses, open, now } = input;
  const out: Record<number, MemberAlias> = {};
  for (const memberId of input.memberIds) {
    if (!team.some((p) => p.id === memberId)) continue;
    const address = teamAddressOf(addresses.get(memberId));
    const request = open.find((r) => r.memberId === memberId);
    const mayAsk = viewerId !== null && mayAskFor(viewerId, standing, memberId, team, org);
    out[memberId] =
      address !== null
        ? { kind: "set", address }
        : request !== undefined
          ? {
              kind: "requested",
              requestId: request.id,
              line: requestedLine(request, viewerId, team, now),
              cancellable: planAliasCancel({ viewerId, request, team, org }).ok,
            }
          : { kind: "none", requestable: mayAsk };
  }
  return out;
}

/** "Mission Analysis lead", "Aerodynamics head", "team leader": the role an automatic request was made for. */
function roleBecome(person: TeamPerson | undefined, org: OrgChart): string | null {
  if (person === undefined) return null;
  if (person.beyond.some((b) => b.kind === "team-leader")) return "team leader";
  for (const b of person.beyond) {
    if (b.kind === "head" && b.departmentId !== null) {
      const name = org.departments.find((d) => d.id === b.departmentId)?.name;
      if (name) return `${name} head`;
    }
  }
  const led = person.memberships.find((m) => m.role === "lead");
  const division = led ? org.divisions.find((d) => d.id === led.divisionId) : undefined;
  return division ? `${divisionShortName(division.name)} lead` : null;
}

/**
 * Someone on the team as the approver's rows read them: as the rules read
 * them, with the address they sign in with (`users.email`), which their alias
 * forwards to (issue #586). Only the approvers' rows carry it.
 */
export type AliasTeamPerson = TeamPerson & { readonly signInEmail: string };

/**
 * The title every PRT email request reads under Needs your attention (issue
 * #798): a personal one and a special one are the same kind of item to the
 * approver, so both read "PRT email request for Davide Russo"; the detail
 * says which.
 */
export function prtEmailRequestTitle(member: string): string {
  return `PRT email request for ${member}`;
}

/**
 * An open personal request for `member` as the approver's row under "Needs
 * your attention" (board 94c, issue #798): "PRT email request for Davide
 * Russo", then "Personal", the address asked for, who asked and when, or, for
 * one the site made, "automatic" and the role it was made for, with Decline
 * and Mark created. Mark created's dialog starts from the address asked for,
 * or from the member's name when none was stored (`aliasPrefill`), and shows
 * the member's sign-in email to copy (issue #586).
 */
export function aliasAttention(request: AliasRequest, member: AliasTeamPerson, team: readonly TeamPerson[], org: OrgChart, now: Date): AttentionItem {
  const name = member.name;
  const when = sentWhen(request.sentAt, now);
  const address = request.address ?? null;
  const action = { answerAlias: request.id, member: name, prefill: address ?? aliasPrefill(name), signInEmail: member.signInEmail };
  const title = prtEmailRequestTitle(name);
  if (request.requesterId === null) {
    const role = roleBecome(member, org);
    return {
      kind: "prt-email-request",
      title,
      detail: ["Personal", role === null ? `automatic · sent ${when}` : `automatic · became ${role} ${when} and has no PRT email`].join(" · "),
      action,
    };
  }
  const requester = requesterName(request, team, "someone");
  return {
    kind: "prt-email-request",
    title,
    detail: ["Personal", address, `from ${requester}`, `sent ${when}`].filter(Boolean).join(" · "),
    action,
  };
}

/**
 * The open requests as the viewer's rows, oldest first: one per request for
 * each approver seat (`answersAliasRequests`), none for anyone else. A request
 * for someone no longer on the team is not shown.
 */
export function aliasAttentionFor(
  viewer: ViewerStanding,
  open: readonly AliasRequest[],
  team: readonly AliasTeamPerson[],
  org: OrgChart,
  now: Date,
): AttentionItem[] {
  if (!answersAliasRequests(viewer)) return [];
  return [...open]
    .sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt) || a.id - b.id)
    .flatMap((r) => {
      const member = team.find((p) => p.id === r.memberId);
      return member === undefined ? [] : [aliasAttention(r, member, team, org, now)];
    });
}
