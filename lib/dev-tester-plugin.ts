import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";
import { callbackPath } from "@/lib/auth-callback";
import { TESTER_KEYS, TESTERS, testerSignInOn } from "@/lib/dev-tester";

// Better Auth plugin for the local-only tester sign-in (issue #129).
// `getAuth()` adds it only when `testerSignInOn()` is true, so on previews
// and production neither route exists. Each handler asks the gate again.
//
//   GET /api/auth/dev-tester                     a plain list of the testers
//   GET /api/auth/dev-tester/sign-in?tester=<key>[&cb=<path>]
//
// The sign-in starts a real session through Better Auth's own adapter and
// cookie helper, so the session cookie and the cookie cache are the ones a
// Google sign-in sets, and getCurrentUserId() and proxy.ts read them.

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
  const items = TESTER_KEYS.map((key) => {
    const tester = TESTERS[key];
    const href = `/api/auth/dev-tester/sign-in?tester=${key}${query}`;
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(tester.name)}</a> (${escapeHtml(key)}): ${escapeHtml(tester.sees)}</li>`;
  }).join("\n");

  return `<!doctype html>
<meta charset="utf-8">
<title>Sign in as a tester (local only)</title>
<h1>Sign in as a tester (local only)</h1>
<p>Run <code>pnpm db:seed</code> first. This page exists only on <code>pnpm dev</code>.</p>
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
            tester: z.enum(TESTER_KEYS),
            cb: z.string().optional(),
          }),
        },
        async (ctx) => {
          refuseWhenOff();
          const tester = TESTERS[ctx.query.tester];
          const found = await ctx.context.internalAdapter.findUserByEmail(tester.email);
          if (!found || found.user.id !== tester.id) {
            throw new APIError("NOT_FOUND", {
              message: `Tester "${tester.key}" is not seeded. Run pnpm db:seed.`,
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
