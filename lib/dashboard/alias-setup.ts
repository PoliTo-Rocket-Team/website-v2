import { teamAddressOf } from "./alias-request";
import type { Checked } from "./department-edit";
import { isOffTeam, type ViewerKind } from "./viewer";

// A member's own team email alias once it is marked created (epic #538,
// issue #542; boards 94f and 94g). The alias is their PRT email (issue #563),
// where Mark created saves it. Their Overview shows the "Your email alias is
// ready" card until they press "I've set it up", which is stored on their own
// record (`members.email_alias_set_up_at`); Close on the setup steps only
// closes them. My profile shows the team email with a link to the same steps
// at any time. This module owns what the viewer is shown and whether "I've
// set it up" may be stored; both data sources read and write what it says.

/** The viewer's own alias: their PRT email, and whether they said they set it up. */
export type OwnAlias = { readonly address: string; readonly setUp: boolean };

/**
 * The viewer's own alias as their Overview and My profile read it, or null:
 * someone off the team, or whose PRT email is empty, has none to show. Only
 * the viewer's own record is ever read into it.
 */
export function ownAliasOf(input: {
  readonly kind: ViewerKind;
  /** Their PRT email as stored; empty or null is no alias. */
  readonly alias: string | null;
  readonly setUpAt: string | null;
}): OwnAlias | null {
  const address = teamAddressOf(input.alias);
  if (isOffTeam(input.kind) || address === null) return null;
  return { address, setUp: input.setUpAt !== null };
}

/** Whether the Overview shows the "Your email alias is ready" card (board 94f): an alias not yet set up. */
export function showsAliasCard(own: OwnAlias | null): own is OwnAlias {
  return own !== null && !own.setUp;
}

/**
 * "I've set it up" (board 94g) as the rules allow it: only for the viewer's
 * own alias, once, and never for someone whose PRT email is empty. There is no member
 * to name: the write is always the viewer's own record.
 */
export function planAliasSetUp(own: OwnAlias | null): Checked<OwnAlias> {
  if (own === null) return { ok: false, error: "You have no PRT email to set up." };
  if (own.setUp) return { ok: false, error: "You already set up your PRT email." };
  return { ok: true, value: { ...own, setUp: true } };
}
