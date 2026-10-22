import type { AliasOutcome, AliasRequest } from "@/lib/dashboard/alias-request";
import type { TeamEdits } from "./edits";

// The dummy team's email alias requests (epic #538), as `alias_requests` rows
// and `members.email_alias` would hold them: one Marco Bianchi sent for Luca
// Marino and one the site made for Pietro Ricci, so the team leader's and the
// operations lead's Overviews show board 94c's two rows, and an alias Sofia
// Neri already has, so the member drawer shows board 94e. Those the test
// developer sent, cancelled or answered are kept in the Team pages' edits
// cookie (./edits.ts). Every address is on the team domain and made up.

/** A request and how it closed; `outcome` is null while it is open. */
export type DummyAliasRequest = AliasRequest & { readonly outcome: AliasOutcome | null };

const seededRequests: readonly DummyAliasRequest[] = [
  { id: 1, memberId: 4, requesterId: 2, sentAt: "2026-10-08T11:15:00+02:00", outcome: null },
  { id: 2, memberId: 6, requesterId: null, sentAt: "2026-10-09T09:40:00+02:00", outcome: null },
];

const seededAliases: Readonly<Record<number, string>> = { 3: "sofia.neri@politorocketteam.it" };

/** Every request: the seeded ones as the test developer left them, then those they sent. */
export function dummyAliasRequestsOf(edits: Pick<TeamEdits, "aliasRequests">): DummyAliasRequest[] {
  const changed = new Map(edits.aliasRequests.map((r) => [r.id, r]));
  const seededIds = new Set(seededRequests.map((r) => r.id));
  return [...seededRequests.map((r) => changed.get(r.id) ?? r), ...edits.aliasRequests.filter((r) => !seededIds.has(r.id))];
}

/** The requests still open. */
export function openAliasRequests(all: readonly DummyAliasRequest[]): AliasRequest[] {
  return all.filter((r) => r.outcome === null).map(({ id, memberId, requesterId, sentAt }) => ({ id, memberId, requesterId, sentAt }));
}

/** Every alias on a member's record: the seeded ones, then those Mark created saved. */
export function dummyAliasesOf(edits: Pick<TeamEdits, "aliases">): Map<number, string> {
  return new Map(Object.entries({ ...seededAliases, ...edits.aliases }).map(([id, address]) => [Number(id), address]));
}

/** The edits with `request` kept: a new one added, or one already there replaced. */
export function withDummyAliasRequest(edits: TeamEdits, request: DummyAliasRequest): TeamEdits {
  return { ...edits, aliasRequests: [...edits.aliasRequests.filter((r) => r.id !== request.id), request] };
}

/** The id the next request takes. */
export function nextAliasRequestId(all: readonly DummyAliasRequest[]): number {
  return Math.max(0, ...all.map((r) => r.id)) + 1;
}
