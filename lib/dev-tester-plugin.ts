import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";
import { callbackPath } from "@/lib/auth-callback";
import { testerSignInOn } from "@/lib/dev-tester";
import { isSeededEmail, PERSON_KEY, SEEDED_ACCOUNTS, seededAccountOf, seededEmailOf } from "@/lib/seeded-accounts";

// Better Auth plugin for the tester sign-in (issues #129, #608, #653).
// `getAuth()` adds it only when `testerSignInOn()` is true: under `next dev`
// off Vercel, and on a preview of the shared `preview` database. Everywhere
// else neither route exists. Each handler asks the gate again.
//
//   GET /api/auth/dev-tester                       how to name a person, and a link per seat
//   GET /api/auth/dev-tester/sign-in?tester=<key>[&cb=<path>]
//   GET /api/auth/dev-tester/sign-in?member=<member id>[&cb=<path>]
//
// It signs in as any seeded person. `<key>` is the key of a seat or an admin
// tester in lib/seeded-accounts.ts ("member", "admin-1"), or a person key: the
// part of their seeded email before the `@` ("beatrice.la.motta"). A member id
// names the seeded member with that id. Only an account whose email is on the
// seed's reserved domain signs in, so a developer's own account never does.
// The sign-in starts a real session through Better Auth's own adapter and
// cookie helper, so the session cookie and the cookie cache are the ones a
// Google sign-in sets, getCurrentUserId() and proxy.ts read them, and signing
// out deletes the session as it does for any account.

/** Where the sign-in reads which account a member id is: the `users` row whose member it is. */
export type TesterDirectory = {
  /** The user id of the seeded member with this member id; null when no `users` row is theirs. */
  readonly memberUserId: (memberId: number) => Promise<string | null>;
};

const ACCOUNT_KEYS = SEEDED_ACCOUNTS.map((account) => account.key);

/** One person, named one way: a seat's or admin tester's key, a person key, or a member id. */
const signInQuery = z
  .object({
    tester: z.union([z.enum(ACCOUNT_KEYS), z.string().regex(PERSON_KEY)]).optional(),
    member: z.coerce.number().int().positive().optional(),
    cb: z.string().optional(),
  })
  .refine((q) => (q.tester === undefined) !== (q.member === undefined), { message: "Name one person: tester=<key> or member=<member id>." });

type SignInQuery = z.infer<typeof signInQuery>;

/** The person a query names, as the sign-in looks them up. */
type Named =
  | { readonly by: "email"; readonly label: string; readonly email: string; readonly id: string | null }
  | { readonly by: "member"; readonly label: string; readonly memberId: number };

function namedBy(query: SignInQuery): Named {
  if (query.member !== undefined) return { by: "member", label: `member ${query.member}`, memberId: query.member };
  // The schema admits a query with exactly one of the two, so `tester` is set here.
  const key = query.tester as string;
  const account = seededAccountOf(key);
  return account === undefined ? { by: "email", label: key, email: seededEmailOf(key), id: null } : { by: "email", label: key, email: account.email, id: account.id };
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
<p>Sign in as any seeded person, named one of three ways:</p>
<ul>
<li><code>/api/auth/dev-tester/sign-in?tester=&lt;seat&gt;</code>: a seat or an admin tester below, such as <code>member</code>.</li>
<li><code>/api/auth/dev-tester/sign-in?tester=&lt;person key&gt;</code>: the part of their seeded email before the <code>@</code>, such as <code>beatrice.la.motta</code>.</li>
<li><code>/api/auth/dev-tester/sign-in?member=&lt;member id&gt;</code>: the seeded member with that id, such as <code>119</code>.</li>
</ul>
<p>Add <code>&amp;cb=&lt;path&gt;</code> to open a page after signing in.</p>
<h2>Seats and admin testers</h2>
<ul>
${items}
</ul>`;
}

export function devTesterPlugin(directory: TesterDirectory) {
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
          query: signInQuery,
        },
        async (ctx) => {
          refuseWhenOff();
          const named = namedBy(ctx.query);
          const notSeeded = new APIError("NOT_FOUND", { message: `"${named.label}" is no seeded person with a sign-in. Run pnpm db:seed.` });
          const { internalAdapter } = ctx.context;
          const memberUserId = named.by === "member" ? await directory.memberUserId(named.memberId) : null;
          const user =
            named.by === "email"
              ? ((await internalAdapter.findUserByEmail(named.email))?.user ?? null)
              : memberUserId === null
                ? null
                : await internalAdapter.findUserById(memberUserId);
          // A seat's account must be the one its row names; any account must be one the seed made.
          if (user === null || !isSeededEmail(user.email) || (named.by === "email" && named.id !== null && user.id !== named.id)) throw notSeeded;
          const session = await internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          throw ctx.redirect(callbackPath(ctx.query.cb));
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
