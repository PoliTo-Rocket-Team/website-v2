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

export const NOTICE_KINDS = ["member-left", "promoted"] as const;

export type NoticeKind = (typeof NOTICE_KINDS)[number];

/** What each kind stores in `dashboard_notices.data`. */
type NoticeData = {
  /** A member left the team from My profile: the divisions they left that the recipient leads, and the reason they gave. */
  readonly "member-left": { readonly divisions: readonly string[]; readonly reason: string | null };
  /** A division lead promoted the subject (#188): the division they now lead, how, and the lead who did it. */
  readonly promoted: { readonly division: string; readonly mode: PromoteMode; readonly lead: string };
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
    readonly data: NoticeData[K];
  };
}[NoticeKind];

/** A `dashboard_notices` row as read, with the subject's name. */
export type StoredNotice = {
  readonly id: number;
  readonly kind: string;
  readonly subject: string;
  readonly createdAt: string;
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
};

function isNoticeKind(kind: string): kind is NoticeKind {
  return (NOTICE_KINDS as readonly string[]).includes(kind);
}

/** The notice a stored row holds; null for a kind this code does not know or data it cannot read. */
export function noticeOf(row: StoredNotice): Notice | null {
  if (!isNoticeKind(row.kind)) return null;
  const read = <K extends NoticeKind>(kind: K) => {
    const data = READ[kind](row.data);
    return data === null ? null : { id: row.id, kind, subject: row.subject, createdAt: row.createdAt, data };
  };
  switch (row.kind) {
    case "member-left":
      return read(row.kind);
    case "promoted":
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
  }
}

// Who is told -----------------------------------------------------------------

/** A division the leaver had an active role in. */
export type LeftDivision = { readonly id: number; readonly name: string };

/** Someone who leads a division: an active lead role in it, or a division scope on it. */
export type DivisionLead = { readonly memberId: number; readonly divisionId: number };

/** One notice to write, and who reads it. */
export type AddressedNotice = { readonly recipientId: number; readonly notice: NewNotice };

/**
 * The notices a member leaving writes: one per lead of a division they had an
 * active role in, naming the divisions of theirs that lead leads. A lead of
 * two of those divisions gets one notice naming both; the leaver is never
 * told about themselves, and a division with no lead tells nobody. This is
 * the one place that decides who is told: the recruitment manager joins here
 * once #194 says who that is.
 */
export function memberLeftNotices(
  leaverId: number,
  divisions: readonly LeftDivision[],
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
  return [...led].map(([recipientId, names]) => ({
    recipientId,
    notice: { kind: "member-left", data: { divisions: names, reason } },
  }));
}

/** Someone with an active head role, and the department it heads. */
export type DepartmentHeadRole = { readonly memberId: number; readonly departmentId: number };

/** A promotion as Promote ran it (board 59e). */
export type Promotion = {
  /** The member who now leads the division. */
  readonly personId: number;
  readonly division: { readonly name: string; readonly departmentId: number };
  readonly mode: PromoteMode;
  /** The division lead who promoted them. */
  readonly lead: { readonly id: number; readonly name: string };
};

/**
 * The notices a promotion writes (issue #188): one per head of the
 * division's department, each told once however many head roles they hold.
 * Neither the lead who promoted nor the person promoted is told about it,
 * and a department with no head tells nobody. This is the one place that
 * decides who is told about a promotion.
 */
export function promotedNotices(promotion: Promotion, heads: readonly DepartmentHeadRole[]): AddressedNotice[] {
  const { personId, division, mode, lead } = promotion;
  const recipients = new Set(
    heads
      .filter((h) => h.departmentId === division.departmentId && h.memberId !== lead.id && h.memberId !== personId)
      .map((h) => h.memberId),
  );
  return [...recipients].map((recipientId) => ({
    recipientId,
    notice: { kind: "promoted", data: { division: division.name, mode, lead: lead.name } },
  }));
}
