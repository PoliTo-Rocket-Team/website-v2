import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import {
  GOOGLE_ACCOUNT_REFUSAL_MESSAGES,
  googleAccountRefusal,
  type GoogleAccountChange,
  type GoogleAccountEntry,
  type GoogleAccountRefusal,
  type GoogleAccountsState,
  type LinkedGoogleAccount,
} from "@/lib/dashboard/google-accounts";
import { impersonatorOf } from "@/lib/session-user";

// Linked Google accounts on Better Auth (issue #906, epic #902). Better Auth's
// own account linking adds and removes the accounts; this file stands in front
// of it and beside it:
//
//   POST /api/auth/link-social      asks the rules in
//   POST /api/auth/unlink-account   lib/dashboard/google-accounts.ts first and
//                                   refuses before Better Auth acts; an unlink
//                                   that succeeds is logged once.
//   account rows written            take the Google account's email from the
//                                   id token Google sent; a Google account
//                                   added to a login that already had one is
//                                   logged once as a link.
//
// Both go through the same redirect URI sign-in uses,
// `<BETTER_AUTH_URL>/api/auth/callback/google`, so Google's console needs no
// change.

const LINK = "/link-social";
const UNLINK = "/unlink-account";
const GOOGLE = "google";

/** Where each link and unlink is logged. */
export type GoogleAccountLog = { readonly record: (entry: GoogleAccountEntry) => Promise<void> };

/** An account row as Better Auth hands it over, with the email column this repo adds. */
type StoredAccount = { readonly id: string; readonly providerId: string; readonly accountId: string; readonly email?: unknown };

/** The email column of an account row; Better Auth's own row type does not name the field this repo adds. */
function emailOf(account: object): string | null {
  const email = (account as { readonly email?: unknown }).email;
  return typeof email === "string" ? email : null;
}

/** The Google accounts among a login's account rows, in the order given. */
export function googleAccountsIn(accounts: readonly StoredAccount[]): LinkedGoogleAccount[] {
  return accounts
    .filter((account) => account.providerId === GOOGLE)
    .map((account) => ({ id: account.id, googleId: account.accountId, email: emailOf(account) }));
}

/**
 * The email in the id token Google sent with a sign-in or a link, lower case;
 * null when there is no token or it names no email. Better Auth took the token
 * from Google's own token endpoint, so only its claims are read here, and the
 * token is copied nowhere.
 */
export function emailOfIdToken(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  const payload = idToken.split(".")[1];
  if (payload === undefined || payload === "") return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const email = typeof claims === "object" && claims !== null ? (claims as { email?: unknown }).email : undefined;
    return typeof email === "string" && email.trim() !== "" ? email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

/** The account row's write with the email its id token names; nothing to add when it carries no token. */
function withEmail<T extends { readonly idToken?: unknown }>(data: T): { data: T & { email: string } } | undefined {
  const email = emailOfIdToken(data.idToken);
  return email === null ? undefined : { data: { ...data, email } };
}

type AccountHooks = NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["account"]>;

/**
 * The `account` database hooks: each row Better Auth writes with an id token
 * (a sign-up, a link, every sign-in after) takes the email that token names,
 * and a Google account added to a login that already holds one is logged as a
 * link. A login's first account is its sign-up, never a link.
 */
export function googleAccountDatabaseHooks(log: GoogleAccountLog): AccountHooks {
  return {
    create: {
      before: async (account) => withEmail(account),
      after: async (account, ctx) => {
        if (account.providerId !== GOOGLE || !ctx) return;
        const linked = googleAccountsIn(await ctx.context.internalAdapter.findAccounts(account.userId));
        if (linked.length < 2) return;
        await log.record({ event: "link", userId: account.userId, accountRowId: account.id, email: emailOf(account) });
      },
    },
    update: {
      before: async (data) => withEmail(data),
    },
  };
}

/** The status each refusal answers with. */
const REFUSAL_STATUS: Readonly<Record<GoogleAccountRefusal, "FORBIDDEN" | "BAD_REQUEST">> = {
  "view-as": "FORBIDDEN",
  "not-yours": "BAD_REQUEST",
  last: "BAD_REQUEST",
};

/** The unlink a before hook let through, carried to the after hook that logs it. */
type Removing = { readonly googleAccountRemoving?: GoogleAccountEntry };

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/** The signed-in login's accounts and session as the rules read them, or null when no one is signed in (the endpoint's own check refuses then). */
async function stateOf(ctx: HookContext): Promise<{ readonly userId: string; readonly state: GoogleAccountsState } | null> {
  const session = await getSessionFromCtx(ctx);
  if (session === null) return null;
  const accounts = googleAccountsIn(await ctx.context.internalAdapter.findAccounts(session.user.id));
  return { userId: session.user.id, state: { accounts, viewingAs: impersonatorOf(session.session) !== null } };
}

/** Refuses the change with the rules' own words, when the rules refuse it. */
function refuseUnless(change: GoogleAccountChange, state: GoogleAccountsState): void {
  const refusal = googleAccountRefusal(change, state);
  if (refusal !== null) throw new APIError(REFUSAL_STATUS[refusal], { message: GOOGLE_ACCOUNT_REFUSAL_MESSAGES[refusal] });
}

const ONLY_GOOGLE = "Only a Google account can be added or removed.";
export const ONLY_THROUGH_GOOGLE_SIGN_IN = "Add a Google account through Google sign-in.";

/**
 * True when a `/link-social` body hands Better Auth an id token directly. That
 * form links without asking whether another login already holds the Google
 * account (the redirect callback does ask), and the section never sends it, so
 * every such request is refused.
 */
function carriesIdToken(body: unknown): boolean {
  return typeof body === "object" && body !== null && (body as { readonly idToken?: unknown }).idToken != null;
}

export function googleAccountsPlugin(log: GoogleAccountLog) {
  return {
    id: "google-accounts",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === LINK,
          handler: createAuthMiddleware(async (ctx) => {
            const signedIn = await stateOf(ctx);
            if (signedIn === null) return;
            if (ctx.body?.provider !== GOOGLE) throw new APIError("BAD_REQUEST", { message: ONLY_GOOGLE });
            if (carriesIdToken(ctx.body)) throw new APIError("BAD_REQUEST", { message: ONLY_THROUGH_GOOGLE_SIGN_IN });
            refuseUnless({ kind: "link" }, signedIn.state);
          }),
        },
        {
          matcher: (ctx) => ctx.path === UNLINK,
          handler: createAuthMiddleware(async (ctx) => {
            const signedIn = await stateOf(ctx);
            if (signedIn === null) return;
            if (ctx.body?.providerId !== GOOGLE) throw new APIError("BAD_REQUEST", { message: ONLY_GOOGLE });
            // An unlink names the account: Better Auth would otherwise take the first Google account it finds.
            const googleId = typeof ctx.body?.accountId === "string" ? ctx.body.accountId : "";
            refuseUnless({ kind: "remove", googleId }, signedIn.state);
            const account = signedIn.state.accounts.find((a) => a.googleId === googleId);
            if (account === undefined) return;
            const removing: Removing = {
              googleAccountRemoving: { event: "unlink", userId: signedIn.userId, accountRowId: account.id, email: account.email },
            };
            return { context: removing };
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === UNLINK,
          handler: createAuthMiddleware(async (ctx) => {
            const removing = (ctx as Removing).googleAccountRemoving;
            if (removing === undefined || ctx.context.returned instanceof APIError) return;
            await log.record(removing);
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
