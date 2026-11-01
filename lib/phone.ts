// The core build with its metadata passed in: the default entry loads the
// metadata as a JSON require, which the test runner (tsx) hands back wrapped.
import { AsYouType } from "libphonenumber-js/core";
import metadata from "libphonenumber-js/min/metadata";

// Phone fields group the digits as the person types, with the country's own
// grouping (issue #953): `+393891234567` reads `+39 389 123 4567`. The country
// comes from the code after the `+`, so a phone that does not start with `+`
// is left exactly as typed and the phone rule asks for the country code.
// Grouping runs only on an edit: a stored phone the person leaves alone is
// shown and saved as it is (issue #887).

/**
 * `typed` with its digits grouped the country's way. Only the `+` and the
 * digits count; anything else typed is dropped, and the groups are split by
 * single spaces, the one separator the phone rule allows.
 */
export function groupPhone(typed: string): string {
  if (!typed.trimStart().startsWith("+")) return typed;
  return new AsYouType(undefined, metadata)
    .input(`+${typed.replace(/\D/g, "")}`)
    .replace(/[^0-9+]+/g, " ")
    .trim();
}

/** The example every phone field shows while empty. */
export const PHONE_PLACEHOLDER = "+39 389 123 4567";

/**
 * Every phone starts with `+`, so an empty field gets one when the person
 * enters it and they type the country code next. Any other value is theirs.
 */
export function phoneOnEnter(value: string): string {
  return value === "" ? "+" : value;
}

/** A field holding only the `+` it was given on entry is empty. */
export function phoneOnLeave(value: string): string {
  return value.trim() === "+" ? "" : value;
}

/** A phone field's value after an edit, and where its caret goes. */
export type PhoneEdit = { readonly value: string; readonly caret: number };

/** Which way a deletion went: Backspace removes before the caret, Delete after it. */
export type DeleteDirection = "backward" | "forward";

const isKept = (c: string) => c === "+" || (c >= "0" && c <= "9");

/** How many kept characters (the `+` and digits) come before `end`. */
function keptBefore(value: string, end: number): number {
  let n = 0;
  for (let i = 0; i < end; i++) if (isKept(value[i])) n++;
  return n;
}

/** The index just after the `n`th kept character, or 0 when `n` is 0. */
function indexAfterKept(value: string, n: number): number {
  if (n === 0) return 0;
  let seen = 0;
  for (let i = 0; i < value.length; i++) if (isKept(value[i]) && ++seen === n) return i + 1;
  return value.length;
}

/**
 * One edit of a phone field: `before` is the value the edit started from,
 * `typed` what the field holds after it, `caret` where the caret sits in
 * `typed`, and `deleted` the direction of a deletion (null for anything else).
 * The caret keeps its place among the digits, so typing in the middle of a
 * grouped number goes on where it was. A deletion that took only a space would
 * be put back by the grouping, so it takes the digit beside it instead.
 */
export function groupPhoneEdit(before: string, typed: string, caret: number, deleted: DeleteDirection | null): PhoneEdit {
  if (!typed.trimStart().startsWith("+")) return { value: typed, caret };
  let text = typed;
  let kept = keptBefore(text, caret);
  if (deleted !== null && typed.length < before.length && keptBefore(typed, typed.length) === keptBefore(before, before.length)) {
    const at = deleted === "backward" ? indexAfterKept(text, kept) - 1 : indexAfterKept(text, kept + 1) - 1;
    if (at >= 0 && at < text.length && isKept(text[at])) {
      text = text.slice(0, at) + text.slice(at + 1);
      if (deleted === "backward") kept--;
    }
  }
  const value = groupPhone(text);
  return { value, caret: indexAfterKept(value, Math.min(kept, keptBefore(value, value.length))) };
}
