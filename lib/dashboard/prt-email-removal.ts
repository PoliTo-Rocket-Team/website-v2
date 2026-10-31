import { answersAliasRequests } from "./alias-request";
import type { Checked } from "./department-edit";
import { sentWhen } from "./hand-over-request";
import type { AttentionItem } from "./overview";
import type { ViewerStanding } from "./viewer";

// Personal PRT email removals (issue #931). A member's own PRT email
// (`members.prt_email`) is a live mailbox in Google Workspace, so when the
// member leaves the team someone has to delete it. Leaving is any write after
// which the member holds no active role: Leave the team, Move to alumni, a
// hand-over that ends their last role, the end of their last advisor role.
// A member who stays on as an advisor (division, department or team) holds
// an active role, so they keep the address until that role ends too (Owner
// decision, 2026-10-31).
//
// The database opens and cancels the removals itself, when a `roles` write
// commits (drizzle/0084,`settle_prt_email_removals`), so no way of leaving
// can miss one: a member left holding no role, with a PRT email, gets one
// open removal for that address, never a second while it is open, and their
// own open PRT email request is cancelled; a member who rejoins the team
// (any active role but an advisor one) before it is answered has it
// cancelled. Taking an advisor role again leaves it open for the approvers
// to answer (Owner decision, 2026-10-31). The leave itself is never refused
// because of it.
//
// This module owns the rest: the approvers' row under Needs your attention,
// shaped like a team address removal's (issue #797), and its two answers.
// The approvers are every holder of each alias approver seat
// (`answersAliasRequests`: team leader, operations lead, IT lead), as for
// alias requests. Mark done says the mailbox is deleted and clears the PRT
// email; Keep address closes the removal and leaves the address (Owner
// decision, 2026-10-31). Either is final: a kept address gets no new removal
// until the member holds a role again and leaves again.

/** An open removal, as the approvers' rows read it. `memberId` is null once the member's record is gone. */
export type OpenPrtEmailRemoval = {
  readonly id: number;
  readonly memberId: number | null;
  readonly address: string;
  /** When the member was left holding no role, an ISO timestamp. */
  readonly openedAt: string;
};

/** The two answers: the mailbox is deleted, or the member keeps it. */
export type PrtEmailRemovalAnswer = "removed" | "kept";

const ANSWERS: readonly PrtEmailRemovalAnswer[] = ["removed", "kept"];

/** An answer as sent, in its shape. */
export function checkPrtEmailRemovalAnswer(input: unknown): Checked<PrtEmailRemovalAnswer> {
  return ANSWERS.includes(input as PrtEmailRemovalAnswer)
    ? { ok: true, value: input as PrtEmailRemovalAnswer }
    : { ok: false, error: "Choose Mark done or Keep address." };
}

/** Who answers a removal: only the alias approver seats, every holder of each. */
export function planPrtEmailRemovalAnswer(viewer: ViewerStanding): Checked<null> {
  return answersAliasRequests(viewer)
    ? { ok: true, value: null }
    : { ok: false, error: "Only the team leader, the operations lead or the IT lead can answer a PRT email removal." };
}

/** What an answer on a removal already answered by another approver, or cancelled meanwhile, reads. */
export const PRT_EMAIL_REMOVAL_ALREADY_ANSWERED = "This PRT email removal was already answered.";

/** How a row names a member whose record is gone or holds no name. */
const UNNAMED_MEMBER = "a former member";

/**
 * An open removal as the approver's row under Needs your attention, in the
 * team address removal's style: "Remove giulia.rossi@politorocketteam.it
 * from Giulia Rossi", then that it is a personal address of a member who
 * left and when, with Keep address and Mark done.
 */
export function prtEmailRemovalAttention(removal: OpenPrtEmailRemoval, names: ReadonlyMap<number, string>, now: Date): AttentionItem {
  const member = (removal.memberId === null ? undefined : names.get(removal.memberId)) ?? UNNAMED_MEMBER;
  return {
    kind: "prt-email-removal",
    title: `Remove ${removal.address} from ${member}`,
    phoneTitle: `Remove ${removal.address}`,
    detail: ["Personal", "left the team", sentWhen(removal.openedAt, now)].join(" · "),
    action: { answerPrtEmailRemoval: removal.id, address: removal.address, member },
  };
}

/**
 * The open removals as the viewer's rows, oldest first: one per removal for
 * each approver seat, none for anyone else. `names` holds everyone with a
 * member record, on the team or not, since the member has left.
 */
export function prtEmailRemovalAttentionFor(
  viewer: ViewerStanding,
  open: readonly OpenPrtEmailRemoval[],
  names: ReadonlyMap<number, string>,
  now: Date,
): AttentionItem[] {
  if (!answersAliasRequests(viewer)) return [];
  return [...open]
    .sort((a, b) => Date.parse(a.openedAt) - Date.parse(b.openedAt) || a.id - b.id)
    .map((r) => prtEmailRemovalAttention(r, names, now));
}
