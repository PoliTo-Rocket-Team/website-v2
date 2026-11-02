import { aliasPrefill, checkAliasAddress, teamAddressOf } from "./alias-request";
import type { Checked } from "./department-edit";

// The member's own PRT email on My profile (issue #921, Owner decision
// 2026-10-31): they edit it there, with a warning that the edit creates no
// mailbox, and while it is empty they may ask for one through the request the
// approvers already answer (`planOwnAliasRequest`, ./alias-request.ts). The
// address check is Request PRT email's (`checkAliasAddress`), so the form and
// the server read one rule.

/**
 * My profile's PRT email: the address it holds; or, while it is empty, the
 * member's open request, or none, with the address Request my PRT email
 * starts from (`aliasPrefill`). A set address has no request beside it, as
 * the request rules keep it (`planAliasRequest`).
 */
export type OwnPrtEmail =
  | { readonly kind: "set"; readonly address: string }
  | { readonly kind: "requested" }
  | { readonly kind: "none"; readonly prefill: string };

/** My profile's PRT email from the stored field and whether the member has an open request. */
export function ownPrtEmailOf(input: { readonly name: string; readonly prtEmail: string | null; readonly requested: boolean }): OwnPrtEmail {
  const address = teamAddressOf(input.prtEmail);
  if (address !== null) return { kind: "set", address };
  return input.requested ? { kind: "requested" } : { kind: "none", prefill: aliasPrefill(input.name) };
}

/** The address the field opens with: the one set, or nothing. */
export function savedPrtEmail(own: OwnPrtEmail): string {
  return own.kind === "set" ? own.address : "";
}

/** The warning shown while the member edits it (issue #921). */
export const PRT_EMAIL_EDIT_WARNING =
  "Changing it here does not create or move the mailbox. The IT lead creates addresses in Google Workspace.";

/** What My profile shows in place of Request my PRT email while the member's request is open. */
export const PRT_EMAIL_REQUESTED = "Requested · waiting for IT";

/** Two PRT emails read as one: the field is saved in lower case, and a blank one is none. */
function samePrtEmail(stored: string | null, typed: string): boolean {
  return (teamAddressOf(stored) ?? "").toLowerCase() === typed.trim().toLowerCase();
}

/** Whether the typed PRT email differs from the saved one: the form shows the warning while it does. */
export function editsPrtEmail(saved: string, typed: string): boolean {
  return !samePrtEmail(saved, typed);
}

/** A PRT email edit as the rules allow it: nothing to write, or the address to save. */
export type OwnPrtEmailEdit = { readonly kind: "unchanged" } | { readonly kind: "set"; readonly address: string };

/**
 * The member's edit as the rules allow it, or the first reason it is refused.
 * An unchanged address never fails, whatever its form (the rule of issue
 * #887), so the stored one is compared before any check. A changed one is a
 * team-domain address, firstname.lastname or one word (`checkAliasAddress`),
 * that is nobody else's PRT email and no special PRT email, in any letter
 * case. It may not be cleared here: an empty PRT email is the lead's to set.
 * The form runs it with nothing taken; the server, with every address held.
 */
export function planOwnPrtEmailEdit(input: {
  /** The member's PRT email as stored. */
  readonly stored: string | null;
  readonly typed: string;
  /** Every other member's PRT email and every special PRT email; only one equal to the address is read. */
  readonly taken: readonly string[];
}): Checked<OwnPrtEmailEdit> {
  if (samePrtEmail(input.stored, input.typed)) return { ok: true, value: { kind: "unchanged" } };
  if (input.typed.trim() === "") return { ok: false, error: "Type your PRT email." };
  const checked = checkAliasAddress(input.typed);
  if (!checked.ok) return checked;
  const { address } = checked.value;
  if (input.taken.some((t) => t.trim().toLowerCase() === address)) return { ok: false, error: `${address} is already a PRT email.` };
  return { ok: true, value: { kind: "set", address } };
}
