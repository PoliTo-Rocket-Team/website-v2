import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GoogleAccountsCard } from "@/components/dashboard/google-accounts";
import { googleAccountsNoticeOf, type GoogleAccountsNotice, type LinkedGoogleAccount } from "./google-accounts";

// The "Google accounts" section as the server sends it (issues #906 and
// #907), in each of its states: every account by email, oldest first; Remove
// on each row while two or more remain and none on the last; a refused link's
// message, with the merge offered when another login holds the Google
// account; and a merge's outcome on return from Google.

const account = (googleId: string) => ({ id: `row-${googleId}`, googleId, email: `${googleId}@example.com` });

function rendered(accounts: readonly LinkedGoogleAccount[], notice: GoogleAccountsNotice | null = null): string {
  return renderToStaticMarkup(createElement(GoogleAccountsCard, { accounts, returnTo: "/dashboard/profile", notice }));
}

const removes = (html: string) => [...html.matchAll(/aria-label="Remove ([^"]+)"/g)].map((m) => m[1]);
const offersMerge = (html: string) => html.includes("Merge that login into this account");

test("each account is listed by email, oldest first, with Remove on every row while two or more remain", () => {
  const html = rendered([account("first"), account("second")]);
  assert.ok(html.indexOf("first@example.com") < html.indexOf("second@example.com"), "oldest first");
  assert.deepEqual(removes(html), ["first@example.com", "second@example.com"]);
  assert.match(html, /Add another Google account/);
});

test("the last account has no Remove", () => {
  const html = rendered([account("only")]);
  assert.match(html, /only@example\.com/);
  assert.deepEqual(removes(html), []);
});

test("a refused link on return from Google shows its message as an alert, and offers the merge only when another login holds the account", () => {
  const held = rendered([account("first")], googleAccountsNoticeOf({ error: "account_already_linked_to_different_user" }));
  assert.match(held, /role="alert"[^>]*>That Google account already has its own login on this site/);
  assert.equal(offersMerge(held), true);

  const cancelled = rendered([account("first")], googleAccountsNoticeOf({ error: "access_denied" }));
  assert.match(cancelled, /role="alert"[^>]*>Adding the Google account was cancelled\.</);
  assert.equal(offersMerge(cancelled), false);
});

test("a merge's return shows the merge done, or its refusal in plain words, and offers no second merge", () => {
  const merged = rendered([account("first"), account("second")], googleAccountsNoticeOf({ merge: "merged" }));
  assert.match(merged, /role="status"[^>]*>.*That login was merged into this account\./);
  assert.equal(offersMerge(merged), false);

  const refused = rendered([account("first")], googleAccountsNoticeOf({ merge: "member", error: "account_already_linked_to_different_user" }));
  assert.match(refused, /role="alert"[^>]*>That Google account belongs to another member&#x27;s login, so it was not merged\. Nothing changed\.</);
  assert.equal(offersMerge(refused), false, "the merge's outcome stands over the earlier refused link");
});
