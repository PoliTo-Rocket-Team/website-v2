import { attentionOf, noticeOf, type AddressedNotice, type StoredNotice } from "@/lib/dashboard/notices";
import type { AttentionItem } from "@/lib/dashboard/overview";
import type { TeamEdits } from "./edits";
import type { DummyPerson } from "./team";

// The dummy team's dashboard notices (issue #201), as `dashboard_notices`
// rows would hold them: one "member left" notice for the division lead, so a
// preview shows the row, and the notices the test developer's own writes
// added (a promotion, #188). Written and dismissed ones are kept in the Team
// pages' edits cookie (./edits.ts).

export type DummyNotice = StoredNotice & {
  /** The person on the dummy roster who reads it (./team.ts). */
  readonly recipientId: number;
};

const seeded: readonly DummyNotice[] = [
  {
    id: 1,
    recipientId: 2, // Marco Bianchi, the Mission Analysis lead the test developer signs in as
    kind: "member-left",
    subject: "Valentina Sala",
    createdAt: "2026-10-08T18:20:00+02:00",
    data: { divisions: ["Mission Analysis Division"], reason: "I am starting an internship abroad this term." },
  },
];

/** The dummy notices: the seeded ones, then those the test developer's writes added. */
export type DummyNotices = {
  /** Notices the test developer's writes added, oldest first. */
  readonly written: readonly DummyNotice[];
  /** Notices dismissed under "Needs your attention", by id. */
  readonly dismissed: readonly number[];
};

/** The notices the Team pages' edits keep. */
export function dummyNoticesOf(edits: Pick<TeamEdits, "notices" | "dismissedNotices">): DummyNotices {
  return { written: edits.notices, dismissed: edits.dismissedNotices };
}

function allNotices(written: readonly DummyNotice[]): readonly DummyNotice[] {
  return [...seeded, ...written];
}

/**
 * `written` with one row per addressed notice about `subject` added, as the
 * database inserts them, each with the next free id.
 */
export function withDummyNotices(
  written: readonly DummyNotice[],
  addressed: readonly AddressedNotice[],
  subject: string,
  createdAt: string,
): DummyNotice[] {
  const next = Math.max(0, ...allNotices(written).map((n) => n.id)) + 1;
  return [
    ...written,
    ...addressed.map(({ recipientId, notice }, i) => ({ id: next + i, recipientId, subject, createdAt, kind: notice.kind, data: notice.data })),
  ];
}

/** The person's notices they have not dismissed, newest first, as "Needs your attention" rows. */
export function dummyNoticeAttention(person: DummyPerson, notices: DummyNotices, now: Date): AttentionItem[] {
  return allNotices(notices.written)
    .filter((row) => row.recipientId === person.id && !notices.dismissed.includes(row.id))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .flatMap((row) => {
      const notice = noticeOf(row);
      return notice === null ? [] : [attentionOf(notice, now)];
    });
}

/** Whether the notice is the person's and still shown, so Dismiss may end it. */
export function isDummyNoticeOpen(person: DummyPerson, notices: DummyNotices, noticeId: number): boolean {
  return allNotices(notices.written).some(
    (row) => row.id === noticeId && row.recipientId === person.id && !notices.dismissed.includes(noticeId),
  );
}
