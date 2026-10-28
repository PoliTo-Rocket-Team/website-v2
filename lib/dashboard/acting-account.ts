// Writes made in a View as session (issue #605, epic #597). Owner decisions
// on #597 (2026-10-24): such a write records both people, the person viewed
// as and the acting account behind the session, read from the session on the
// server; it displays as the acting seat's title, then the person's full
// name ("IT lead as Sara Conti"), never as the person alone.

import { SEAT_LABELS } from "./division-access";
import type { ViewAsSite } from "./view-as";
import type { FlaggedSeat } from "./viewer";

/** The title an acting account that never held the IT lead seat shows under on a test site: any signed-in account using View as on a preview or under `next dev` (#648). */
export const ADMIN_TESTER_TITLE = "Admin tester";

/** The title the break-glass admin's View as writes show under on the live site (issue #646). It names no account. */
export const BREAK_GLASS_TITLE = "Admin";

/**
 * The title an acting account's writes show under, from every seat it holds
 * or held and the site they are read on. An account that ever held the IT
 * lead seat shows as the IT lead, and a hand-over does not relabel the writes
 * it made then. On the live site the only other account that can use View as
 * is the break-glass admin (issue #646), so any other acting account shows as
 * it. On a test site every signed-in account may use View as (#648), and any
 * other acting account shows as an admin tester.
 */
export function actingTitleOf(seatsHeld: readonly (FlaggedSeat | null)[], site: ViewAsSite): string {
  if (seatsHeld.includes("it-lead")) return SEAT_LABELS["it-lead"];
  return site === "live" ? BREAK_GLASS_TITLE : ADMIN_TESTER_TITLE;
}

/**
 * The name a "by" field shows: "IT lead as Sara Conti" for a write made
 * while viewing as Sara Conti, given the acting account's title; the name
 * alone when no acting account is recorded.
 */
export function attributedName(name: string, actingTitle: string | null): string {
  return actingTitle === null ? name : `${actingTitle} as ${name}`;
}
