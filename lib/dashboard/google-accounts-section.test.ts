import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GoogleAccountsCard } from "@/components/dashboard/google-accounts";
import type { LinkedGoogleAccount } from "./google-accounts";

// The "Google accounts" section as the server sends it (issue #906), in each
// of its states: every account by email, oldest first; Remove on each row
// while two or more remain and none on the last; and a refused link's message.

const account = (googleId: string) => ({ id: `row-${googleId}`, googleId, email: `${googleId}@example.com` });

function rendered(accounts: readonly LinkedGoogleAccount[], linkError: string | null = null): string {
  return renderToStaticMarkup(createElement(GoogleAccountsCard, { accounts, returnTo: "/dashboard/profile", linkError }));
}

const removes = (html: string) => [...html.matchAll(/aria-label="Remove ([^"]+)"/g)].map((m) => m[1]);

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

test("a refused link on return from Google shows its message as an alert", () => {
  const html = rendered([account("first")], "That Google account already has its own login on this site.");
  assert.match(html, /role="alert"[^>]*>That Google account already has its own login on this site\.</);
});
