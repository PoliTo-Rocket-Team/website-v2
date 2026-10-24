// Writes made in a View as session (issue #605, epic #597). Owner decisions
// on #597 (2026-10-24): such a write records both people, the person viewed
// as and the acting account behind the session, read from the session on the
// server; it displays as the acting seat's title, then the person's full
// name ("IT lead as Sara Conti"), never as the person alone.

import { SEAT_LABELS } from "./division-access";
import type { FlaggedSeat } from "./viewer";

/** The title an acting account that never held the IT lead seat shows under: any signed-in account using View as on a preview or under `next dev` (#648). */
export const ADMIN_TESTER_TITLE = "Admin tester";

/**
 * The title an acting account's writes show under, from every seat it holds
 * or held. On the live site only the IT lead seat can use View as, so an
 * account that ever held it shows as the IT lead, and a hand-over does not
 * relabel the writes it made then. Any other acting account is using View as
 * on a preview or under `next dev`, where every signed-in account may (#648).
 */
export function actingTitleOf(seatsHeld: readonly (FlaggedSeat | null)[]): string {
  return seatsHeld.includes("it-lead") ? SEAT_LABELS["it-lead"] : ADMIN_TESTER_TITLE;
}

/**
 * The name a "by" field shows: "IT lead as Sara Conti" for a write made
 * while viewing as Sara Conti, given the acting account's title; the name
 * alone when no acting account is recorded.
 */
export function attributedName(name: string, actingTitle: string | null): string {
  return actingTitle === null ? name : `${actingTitle} as ${name}`;
}
