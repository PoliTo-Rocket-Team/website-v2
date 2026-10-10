import { attentionOf, noticeOf, type StoredNotice } from "@/lib/dashboard/notices";
import type { AttentionItem } from "@/lib/dashboard/overview";
import type { DummyPerson } from "./team";

// The dummy team's dashboard notices (issue #201), as `dashboard_notices`
// rows would hold them: one "member left" notice for the division lead, so a
// preview shows the row. Dismissed ones are kept in the Team pages' edits
// cookie (./edits.ts).

type DummyNotice = StoredNotice & {
  /** The person on the dummy roster who reads it (./team.ts). */
  readonly recipientId: number;
};

const notices: readonly DummyNotice[] = [
  {
    id: 1,
    recipientId: 2, // Marco Bianchi, the Mission Analysis lead the test developer signs in as
    kind: "member-left",
    subject: "Valentina Sala",
    createdAt: "2026-10-08T18:20:00+02:00",
    data: { divisions: ["Mission Analysis Division"], reason: "I am starting an internship abroad this term." },
  },
];

/** The person's notices they have not dismissed, as "Needs your attention" rows. */
export function dummyNoticeAttention(person: DummyPerson, dismissed: readonly number[], now: Date): AttentionItem[] {
  return notices.flatMap((row) => {
    if (row.recipientId !== person.id || dismissed.includes(row.id)) return [];
    const notice = noticeOf(row);
    return notice === null ? [] : [attentionOf(notice, now)];
  });
}

/** Whether the notice is the person's and still shown, so Dismiss may end it. */
export function isDummyNoticeOpen(person: DummyPerson, dismissed: readonly number[], noticeId: number): boolean {
  return notices.some((row) => row.id === noticeId && row.recipientId === person.id && !dismissed.includes(noticeId));
}
