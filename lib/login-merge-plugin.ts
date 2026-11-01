import { randomBytes } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, createAuthMiddleware, getOAuthState, getSessionFromCtx, sessionMiddleware } from "better-auth/api";
import { deleteSessionCookie, setSessionCookie } from "better-auth/cookies";
import {
  LOGIN_MERGE_REFUSAL_MESSAGES,
  MERGE_TICKET_PREFIX,
  MERGE_TICKET_STATE_KEY,
  MERGE_TICKET_SECONDS,
  ticketHolds,
  ticketUserOf,
  withMergeResult,
  type LoginMergeOutcome,
  type MergeTicket,
} from "@/lib/dashboard/login-merge";
import { impersonatorOf } from "@/lib/session-user";

// Merging an empty second login on Better Auth (issue #907, epic #902). The
// rules are lib/dashboard/login-merge.ts. Better Auth refuses to add a Google
// account another login holds, so the "Google accounts" section offers the
// merge, and this plugin carries it:
//
//   POST /api/auth/google-accounts/merge-ticket
//       The signed-in person, outside View as, asks for a merge ticket: one
//       random value, stored for ten minutes in `better_auth.verification`
//       and bound to their login. The section then starts an ordinary Google
//       sign-in carrying the ticket in its OAuth state (`additionalData`).
//   GET /api/auth/callback/google
//       Google's return, on the redirect URI every sign-in already uses, so
//       Google's console needs no change. Once Better Auth has signed in the
//       login that holds the Google account, which proves the person holds
//       it, this plugin takes the ticket off the store (it holds once) and
//       checks it was asked for by the login whose session the browser
//       still carries. Then it merges the signed-in Google account's login
//       into that one, when the rules allow, and puts the person back on
//       their own session either way: the merged login's sessions end, a
//       refused one's new session ends, and nothing else changes. The page
//       reads the outcome off its `google_merge` query.
//
// A sign-in whose state carries no ticket is never touched.

const GOOGLE = "google";
const CALLBACK = "/callback/:id";

/** Where a merge is judged and written: lib/dashboard/database-login-merge.ts on the database. */
export type LoginMerger = {
  readonly merge: (request: { readonly userId: string; readonly fromUserId: string; readonly viewingAs: boolean }) => Promise<LoginMergeOutcome>;
};

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/** The ticket the Google trip's state carries, or null when it carries none. */
function ticketInState(state: unknown): string | null {
  const ticket = typeof state === "object" && state !== null ? (state as Record<string, unknown>)[MERGE_TICKET_STATE_KEY] : undefined;
  return typeof ticket === "string" && ticket !== "" ? ticket : null;
}

/** Takes the ticket off the store, so it holds once; null when it is not there (spent, run out or never asked for). */
async function takeTicket(ctx: HookContext, ticket: string): Promise<MergeTicket | null> {
  const stored = await ctx.context.internalAdapter.findVerificationValue(`${MERGE_TICKET_PREFIX}${ticket}`);
  if (!stored) return null;
  await ctx.context.internalAdapter.deleteVerificationValue(stored.id);
  const userId = ticketUserOf(stored.value);
  return userId === null ? null : { userId, expiresAt: new Date(stored.expiresAt) };
}

const refused = (refusal: "expired" | "failed"): LoginMergeOutcome => ({ kind: "refused", refusal });

export function loginMergePlugin(merger: LoginMerger) {
  return {
    id: "login-merge",
    endpoints: {
      loginMergeTicket: createAuthEndpoint("/google-accounts/merge-ticket", { method: "POST", use: [sessionMiddleware] }, async (ctx) => {
        const { session } = ctx.context.session;
        if (impersonatorOf(session) !== null) throw new APIError("FORBIDDEN", { message: LOGIN_MERGE_REFUSAL_MESSAGES["view-as"] });
        const ticket = randomBytes(32).toString("base64url");
        await ctx.context.internalAdapter.createVerificationValue({
          identifier: `${MERGE_TICKET_PREFIX}${ticket}`,
          value: JSON.stringify({ userId: session.userId }),
          expiresAt: new Date(Date.now() + MERGE_TICKET_SECONDS * 1000),
        });
        return ctx.json({ ticket });
      }),
    },
    hooks: {
      after: [
        {
          matcher: (ctx) => ctx.path === CALLBACK && ctx.params?.id === GOOGLE,
          handler: createAuthMiddleware(async (ctx) => {
            const state = await getOAuthState();
            const ticket = ticketInState(state);
            if (ticket === null || state === null) return;
            const stored = await takeTicket(ctx, ticket);
            // No login was signed in: Better Auth already sends the person back with Google's error, and the ticket is spent.
            const signedIn = ctx.context.newSession;
            if (!signedIn) return;
            // The session the browser came back with: the login that asked, unless it changed meanwhile.
            const asked = await getSessionFromCtx(ctx, { disableRefresh: true });
            let outcome: LoginMergeOutcome;
            if (asked === null || !ticketHolds(stored, asked.user.id, new Date())) outcome = refused("expired");
            else {
              const request = { userId: asked.user.id, fromUserId: signedIn.user.id, viewingAs: impersonatorOf(asked.session) !== null };
              outcome = await merger.merge(request).catch((error: unknown) => {
                ctx.context.logger.error("Merging a login failed", error);
                return refused("failed");
              });
            }
            // The Google sign-in's own session ends (a merge already ended it with the rest), and the person is back on theirs.
            await ctx.context.internalAdapter.deleteSession(signedIn.session.token);
            if (asked === null) deleteSessionCookie(ctx);
            else await setSessionCookie(ctx, { session: asked.session, user: asked.user });
            throw ctx.redirect(withMergeResult(String(state.callbackURL), outcome));
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
