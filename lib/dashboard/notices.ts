import { attributedName } from "./acting-account";
import type { AttentionItem } from "./overview";
import { isPromoteMode, type PromoteMode } from "./team";
import { shortDate } from "./write";

// Notices on a member's dashboard (issue #201): something that happened to
// someone else that the recipient should know about, stored one row per
// recipient in `dashboard_notices` and shown under "Needs your attention"
// until they dismiss it. This module owns the kinds: what each one stores,
// who is told, and how it reads as an attention row. A new kind is a new
// entry here, not a new mechanism: "promoted" (#188), the department head
// told about a promotion, is the second.

// The member's own "alias ready" news is the board 94f card on their Overview,
// never a notice row (owner ruling on #550, 2026-10-22): an `alias-ready` row
// an earlier answer wrote is a kind this code no longer knows, so it is not shown.
export const NOTICE_KINDS = [
  "member-left",
  "promoted",
  "hand-over-answered",
  "alias-created",
  "alias-declined",
  "team-address-created",
  "team-address-declined",
] as const;

/** How the next level up answered a hand-over (issue #262). */
export type HandOverAnswered = "confirmed" | "declined";

export type NoticeKind = (typeof NOTICE_KINDS)[number];

/** What each kind stores in `dashboard_notices.data`. */
type NoticeData = {
  /**
   * A member left the team from My profile: the divisions they left that the
   * recipient leads (every one of them for the recruitment manager, #705), and
   * the reason they gave.
   */
  readonly "member-left": { readonly divisions: readonly string[]; readonly reason: string | null };
  /** A division lead promoted the subject (#188): the division they now lead, how, and the lead who did it. */
  readonly promoted: { readonly division: string; readonly mode: PromoteMode; readonly lead: string };
  /**
   * The next level up (the subject) answered the recipient's hand-over from
   * My profile (#262): the role ("Mission Analysis lead"), who was to take it
   * over, and the answer.
   */
  readonly "hand-over-answered": { readonly role: string; readonly successor: string; readonly answer: HandOverAnswered };
  /** The alias the recipient asked for was marked created (epic #538): the subject is the member, with the address saved. */
  readonly "alias-created": { readonly address: string };
  /** The alias the recipient asked for was declined (epic #538): the subject is the member, `by` who declined it. */
  readonly "alias-declined": { readonly by: string };
  /** The team address the recipient asked for was marked created (epic #578): the subject is the holder, with the address saved. */
  readonly "team-address-created": { readonly address: string };
  /** The team address the recipient asked for was declined (epic #578): the subject is the member, with the address asked for and `by` who declined it. */
  readonly "team-address-declined": { readonly address: string; readonly by: string };
};

/** A notice to write: its kind and what it stores. */
export type NewNotice = { [K in NoticeKind]: { readonly kind: K; readonly data: NoticeData[K] } }[NoticeKind];

/** A notice as the recipient reads it. */
export type Notice = {
  [K in NoticeKind]: {
    readonly id: number;
    readonly kind: K;
    /** The name of the person it is about. */
    readonly subject: string;
    /** When it was written, an ISO timestamp. */
    readonly createdAt: string;
    /**
     * The title of the acting account behind the View as session that wrote
     * it (`actingTitleOf`, issue #628); null for one written outside View as.
     */
    readonly actingTitle: string | null;
    readonly data: NoticeData[K];
  };
}[NoticeKind];

/** A `dashboard_notices` row as read, with the subject's name and its acting account's title, absent or null when it records none. */
export type StoredNotice = {
  readonly id: number;
  readonly kind: string;
  readonly subject: string;
  readonly createdAt: string;
  readonly actingTitle?: string | null;
  readonly data: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Each kind's check of what a row stores; a row that fails it is not shown. */
const READ: { readonly [K in NoticeKind]: (data: unknown) => NoticeData[K] | null } = {
  "member-left": (data) => {
    if (!isRecord(data)) return null;
    const { divisions, reason } = data;
    if (!Array.isArray(divisions) || !divisions.every((d) => typeof d === "string")) return null;
    if (reason !== null && typeof reason !== "string") return null;
    return { divisions, reason };
  },
  promoted: (data) => {
    if (!isRecord(data)) return null;
    const { division, mode, lead } = data;
    if (typeof division !== "string" || typeof lead !== "string" || !isPromoteMode(mode)) return null;
    return { division, mode, lead };
  },
  "hand-over-answered": (data) => {
    if (!isRecord(data)) return null;
    const { role, successor, answer } = data;
    if (typeof role !== "string" || typeof successor !== "string" || (answer !== "confirmed" && answer !== "declined")) return null;
    return { role, successor, answer };
  },
  "alias-created": readAddress,
  "alias-declined": (data) => (isRecord(data) && typeof data.by === "string" ? { by: data.by } : null),
  "team-address-created": readAddress,
  "team-address-declined": (data) =>
    isRecord(data) && typeof data.address === "string" && typeof data.by === "string" ? { address: data.address, by: data.by } : null,
};

function readAddress(data: unknown): { readonly address: string } | null {
  return isRecord(data) && typeof data.address === "string" ? { address: data.address } : null;
}

function isNoticeKind(kind: string): kind is NoticeKind {
  return (NOTICE_KINDS as readonly string[]).includes(kind);
}

/** The notice a stored row holds; null for a kind this code does not know or data it cannot read. */
export function noticeOf(row: StoredNotice): Notice | null {
  if (!isNoticeKind(row.kind)) return null;
  const read = <K extends NoticeKind>(kind: K) => {
    const data = READ[kind](row.data);
    return data === null ? null : { id: row.id, kind, subject: row.subject, createdAt: row.createdAt, actingTitle: row.actingTitle ?? null, data };
  };
  switch (row.kind) {
    case "member-left":
      return read(row.kind);
    case "promoted":
      return read(row.kind);
    case "hand-over-answered":
      return read(row.kind);
    case "alias-created":
      return read(row.kind);
    case "alias-declined":
      return read(row.kind);
    case "team-address-created":
      return read(row.kind);
    case "team-address-declined":
      return read(row.kind);
  }
}

const MAX_REASON_SHOWN = 140;

/** The reason as the attention row shows it: whole, or cut at a word with an ellipsis. */
function reasonExcerpt(reason: string): string {
  if (reason.length <= MAX_REASON_SHOWN) return reason;
  const cut = reason.slice(0, MAX_REASON_SHOWN);
  const space = cut.lastIndexOf(" ");
  return `${(space > MAX_REASON_SHOWN / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The notice as a "Needs your attention" row, with a button that dismisses it. */
export function attentionOf(notice: Notice, now: Date): AttentionItem {
  const action = { label: "Dismiss", dismissNotice: notice.id };
  switch (notice.kind) {
    case "member-left": {
      const { divisions, reason } = notice.data;
      const said = reason === null ? null : `"${reasonExcerpt(reason)}"`;
      return {
        kind: "notice",
        title: `${notice.subject} left the team`,
        detail: [divisions.join(", "), shortDate(notice.createdAt, now.getUTCFullYear()), said].filter(Boolean).join(" · "),
        action,
      };
    }
    case "promoted": {
      const { division, mode, lead } = notice.data;
      const how = mode === "together" ? `together with ${lead}` : `${lead} handed over`;
      return {
        kind: "notice",
        title: `${notice.subject} now leads ${division}`,
        detail: [how, shortDate(notice.createdAt, now.getUTCFullYear())].join(" · "),
        action,
      };
    }
    case "hand-over-answered": {
      const { role, successor, answer } = notice.data;
      return {
        kind: "notice",
        title: `${attributedName(notice.subject, notice.actingTitle)} ${answer} your hand-over`,
        detail: [`${role} to ${successor}`, shortDate(notice.createdAt, now.getUTCFullYear()), answer === "declined" ? "you keep the role" : null]
          .filter(Boolean)
          .join(" · "),
        action,
      };
    }
    case "alias-created":
      return {
        kind: "notice",
        title: `${notice.subject}'s PRT email is ready`,
        detail: [notice.data.address, shortDate(notice.createdAt, now.getUTCFullYear())].join(" · "),
        action,
        iconKind: "prt-email-request",
      };
    case "alias-declined":
      return {
        kind: "notice",
        title: `${attributedName(notice.data.by, notice.actingTitle)} declined the PRT email for ${notice.subject}`,
        detail: [shortDate(notice.createdAt, now.getUTCFullYear()), "to ask again, use Request PRT email on their panel in Members"].join(" · "),
        action,
        iconKind: "prt-email-request",
      };
    case "team-address-created":
      return {
        kind: "notice",
        title: `${notice.data.address} is ready for ${notice.subject}`,
        detail: shortDate(notice.createdAt, now.getUTCFullYear()),
        action,
        iconKind: "prt-email-request",
      };
    case "team-address-declined":
      return {
        kind: "notice",
        title: `${attributedName(notice.data.by, notice.actingTitle)} declined ${notice.data.address} for ${notice.subject}`,
        detail: [shortDate(notice.createdAt, now.getUTCFullYear()), "you can ask again"].join(" · "),
        action,
        iconKind: "prt-email-request",
      };
  }
}

// Who is told -----------------------------------------------------------------

/**
 * The notice an answered hand-over writes (issue #262): one, to the person
 * who sent it, about the approver who answered, naming the role and who was
 * to take it over.
 */
export function handOverAnsweredNotice(
  senderId: number,
  answered: { readonly role: string; readonly successor: string; readonly answer: HandOverAnswered },
): AddressedNotice {
  return { recipientId: senderId, notice: { kind: "hand-over-answered", data: answered } };
}

/** A division the leaver had an active role in. */
export type LeftDivision = { readonly id: number; readonly name: string };

/** A division of the team as the recruitment manager rule reads it: its code and whether it is closed. */
export type TeamDivision = { readonly id: number; readonly code: string | null; readonly closedAt: string | null };

/** Someone who leads a division: an active lead role in it, or a division scope on it. */
export type DivisionLead = { readonly memberId: number; readonly divisionId: number };

/** One notice to write, and who reads it. */
export type AddressedNotice = { readonly recipientId: number; readonly notice: NewNotice };

/**
 * The code of the division whose leads are the recruitment manager: Logistics,
 * in the Operations department (owner ruling on #194,
 * https://github.com/PoliTo-Rocket-Team/website-v2/issues/194#issuecomment-6341780484).
 */
export const RECRUITMENT_MANAGER_DIVISION_CODE = "LGS";

/**
 * The division whose leads are the recruitment manager: the open division
 * with the Logistics code. Null when that division is closed or the team has
 * none, and then nobody is the recruitment manager. This is the one rule that
 * finds it.
 */
export function recruitmentManagerDivision<D extends TeamDivision>(team: readonly D[]): D | null {
  return team.find((d) => d.code === RECRUITMENT_MANAGER_DIVISION_CODE && d.closedAt === null) ?? null;
}

/**
 * The notices a member leaving writes. Each lead of a division they had an
 * active role in gets one, naming the divisions of theirs that lead leads; a
 * lead of two of those divisions gets one notice naming both. Each lead of
 * the recruitment manager's division (`recruitmentManagerDivision`, #705) is
 * told too, with every division the leaver was in, in one notice even when
 * they also lead one of those divisions. The leaver is never told about
 * themselves, and a division with no lead tells nobody. This is the one place
 * that decides who is told.
 */
export function memberLeftNotices(
  leaverId: number,
  divisions: readonly LeftDivision[],
  team: readonly TeamDivision[],
  leads: readonly DivisionLead[],
  reason: string | null,
): AddressedNotice[] {
  const led = new Map<number, string[]>();
  for (const division of divisions) {
    for (const lead of leads) {
      if (lead.divisionId !== division.id || lead.memberId === leaverId) continue;
      const names = led.get(lead.memberId) ?? [];
      if (!names.includes(division.name)) names.push(division.name);
      led.set(lead.memberId, names);
    }
  }
  const manager = recruitmentManagerDivision(team);
  if (manager !== null) {
    const all = [...new Set(divisions.map((d) => d.name))];
    for (const lead of leads) {
      if (lead.divisionId === manager.id && lead.memberId !== leaverId) led.set(lead.memberId, all);
    }
  }
  return [...led].map(([recipientId, names]) => ({
    recipientId,
    notice: { kind: "member-left", data: { divisions: names, reason } },
  }));
}
