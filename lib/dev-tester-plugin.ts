import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";
import { callbackPath } from "@/lib/auth-callback";
import { testerSignInOn } from "@/lib/dev-tester";
import { SEEDED_ACCOUNTS, type SeededAccount } from "@/lib/seeded-accounts";

// Better Auth plugin for the tester sign-in (issues #129, #608). `getAuth()`
// adds it only when `testerSignInOn()` is true: under `next dev` off Vercel,
// and on a preview of the shared `preview` database. Everywhere else neither
// route exists. Each handler asks the gate again.
//
//   GET /api/auth/dev-tester                     a plain list of the accounts
//   GET /api/auth/dev-tester/sign-in?tester=<key>[&cb=<path>]
//
// `<key>` is the key of a seat or an admin tester in lib/seeded-accounts.ts.
// The sign-in starts a real session through Better Auth's own adapter and
// cookie helper, so the session cookie and the cookie cache are the ones a
// Google sign-in sets, getCurrentUserId() and proxy.ts read them, and
// signing out deletes the session as it does for any account.

const ACCOUNT_KEYS = SEEDED_ACCOUNTS.map((account) => account.key);

function accountOf(key: string): SeededAccount {
  const account = SEEDED_ACCOUNTS.find((a) => a.key === key);
  // The query schema admits only these keys, so this never throws on a request.
  if (account === undefined) throw new APIError("BAD_REQUEST");
  return account;
}

function refuseWhenOff(): void {
  if (!testerSignInOn()) throw new APIError("NOT_FOUND");
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function testerListHtml(cb: string | undefined): string {
  const query = cb === undefined ? "" : `&cb=${encodeURIComponent(callbackPath(cb))}`;
  const items = SEEDED_ACCOUNTS.map((account) => {
    const href = `/api/auth/dev-tester/sign-in?tester=${account.key}${query}`;
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(account.name)}</a> (${escapeHtml(account.key)}): ${escapeHtml(account.sees)}</li>`;
  }).join("\n");

  return `<!doctype html>
<meta charset="utf-8">
<title>Sign in as a tester</title>
<h1>Sign in as a tester</h1>
<p>Locally, run <code>pnpm db:seed</code> first. This page exists only on <code>pnpm dev</code> and on previews of the shared preview database.</p>
<ul>
${items}
</ul>`;
}

export function devTesterPlugin() {
  return {
    id: "dev-tester",
    endpoints: {
      devTesterList: createAuthEndpoint(
        "/dev-tester",
        {
          method: "GET",
          query: z.object({ cb: z.string().optional() }).optional(),
        },
        async (ctx) => {
          refuseWhenOff();
          return new Response(testerListHtml(ctx.query?.cb), {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        },
      ),
      devTesterSignIn: createAuthEndpoint(
        "/dev-tester/sign-in",
        {
          method: "GET",
          query: z.object({
            tester: z.enum(ACCOUNT_KEYS),
            cb: z.string().optional(),
          }),
        },
        async (ctx) => {
          refuseWhenOff();
          const account = accountOf(ctx.query.tester);
          const found = await ctx.context.internalAdapter.findUserByEmail(account.email);
          if (!found || found.user.id !== account.id) {
            throw new APIError("NOT_FOUND", {
              message: `Tester "${account.key}" is not seeded. Run pnpm db:seed.`,
            });
          }
          const session = await ctx.context.internalAdapter.createSession(found.user.id);
          await setSessionCookie(ctx, { session, user: found.user });
          throw ctx.redirect(callbackPath(ctx.query.cb));
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
