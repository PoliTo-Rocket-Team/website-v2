import assert from "node:assert/strict";
import { test } from "node:test";
import {
  googleAccountRefusal,
  linkErrorMessage,
  memberGoogleEmailsOf,
  unlinkErrorMessage,
  type GoogleAccountChange,
  type GoogleAccountRefusal,
  type GoogleAccountsState,
} from "./google-accounts";

// The rules of linked Google accounts (issue #906), apart from Better Auth:
// lib/google-accounts-auth.test.ts runs them through the real endpoints.

const account = (googleId: string) => ({ id: `row-${googleId}`, googleId, email: `${googleId}@example.com` });
const one: GoogleAccountsState = { accounts: [account("a")], viewingAs: false };
const two: GoogleAccountsState = { accounts: [account("a"), account("b")], viewingAs: false };
const link: GoogleAccountChange = { kind: "link" };
const remove = (googleId: string): GoogleAccountChange => ({ kind: "remove", googleId });

test("who may add or remove which Google account", () => {
  const cases: [string, GoogleAccountChange, GoogleAccountsState, GoogleAccountRefusal | null][] = [
    ["add one more", link, one, null],
    ["add one more during View as", link, { ...one, viewingAs: true }, "view-as"],
    ["remove one of two", remove("b"), two, null],
    ["remove one of two during View as", remove("b"), { ...two, viewingAs: true }, "view-as"],
    ["remove the last one", remove("a"), one, "last"],
    ["remove one that is not theirs", remove("z"), two, "not-yours"],
    ["remove with no account named", remove(""), two, "not-yours"],
  ];
  for (const [name, change, section, refusal] of cases) assert.equal(googleAccountRefusal(change, section), refusal, name);
});

test("a member's linked Google emails other viewers see: every one but the sign-in email, each once, oldest first (issue #908)", () => {
  const emails = (...list: (string | null)[]) => list.map((email) => ({ email }));
  assert.deepEqual(
    memberGoogleEmailsOf([
      // The sign-in email is never repeated in the list, in any letter case; an unknown email is left out.
      { memberId: 1, signInEmail: "Ada@gmail.com", accounts: emails("ada@gmail.com", "ada.work@gmail.com", null, "ADA.WORK@gmail.com") },
      // One account only, the one they sign in with: nothing to list.
      { memberId: 2, signInEmail: "bo@gmail.com", accounts: emails("bo@gmail.com") },
      // A member whose record two logins hold lists the accounts of both, once.
      { memberId: 3, signInEmail: "cy@gmail.com", accounts: emails("cy.old@gmail.com") },
      { memberId: 3, signInEmail: "cy.old@gmail.com", accounts: emails("cy.old@gmail.com", "cy.phone@gmail.com") },
    ]),
    { 1: ["ada.work@gmail.com"], 3: ["cy.old@gmail.com", "cy.phone@gmail.com"] },
  );
  assert.deepEqual(memberGoogleEmailsOf([]), {});
});

test("Google's return and a refused removal read as plain words", () => {
  assert.equal(linkErrorMessage(null), null, "no error, no message");
  assert.match(linkErrorMessage("account_already_linked_to_different_user") ?? "", /already has its own login/);
  assert.match(linkErrorMessage("some_new_code") ?? "", /Could not add/, "an unknown code still reads as words");
  assert.match(unlinkErrorMessage("Session is not fresh"), /sign out and sign in again/);
  assert.equal(unlinkErrorMessage("You cannot remove your last Google account: you sign in with it."), "You cannot remove your last Google account: you sign in with it.");
});
