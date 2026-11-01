import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import {
  GOOGLE_ACCOUNT_REFUSAL_MESSAGES,
  googleAccountRefusal,
  type GoogleAccountChange,
  type GoogleAccountEntry,
  type GoogleAccountRefusal,
  type GoogleAccountRemoval,
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
//                                   refuses before Better Auth acts.
//   account rows written            take the Google account's email from the
//                                   id token Google sent; a Google account
//                                   added to a login that already had one is
//                                   logged once as a link.
//   the account row an unlink       is removed by the store instead, which
//   deletes                         checks again that another Google account
//                                   stays, in the same database transaction
//                                   as the delete and its log entry; two
//                                   removals at once cannot both pass a check
//                                   read before either deleted (epic #902).
//
// Both go through the same redirect URI sign-in uses,
// `<BETTER_AUTH_URL>/api/auth/callback/google`, so Google's console needs no
// change.

const LINK = "/link-social";
const UNLINK = "/unlink-account";
const GOOGLE = "google";

/** Where each link is logged, and where an unlink is checked, written and logged as one. */
export type GoogleAccountStore = {
  readonly record: (entry: GoogleAccountEntry) => Promise<void>;
  /** Removes the account unless it is the login's last Google account, or no longer on it; answers null when removed, else why not. */
  readonly remove: (removal: GoogleAccountRemoval) => Promise<GoogleAccountRefusal | null>;
};

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

/** The status each refusal answers with. */
const REFUSAL_STATUS: Readonly<Record<GoogleAccountRefusal, "FORBIDDEN" | "BAD_REQUEST">> = {
  "view-as": "FORBIDDEN",
  "not-yours": "BAD_REQUEST",
  last: "BAD_REQUEST",
};

/** The answer a refused change gets, in the rules' own words. */
function refused(refusal: GoogleAccountRefusal): APIError {
  return new APIError(REFUSAL_STATUS[refusal], { message: GOOGLE_ACCOUNT_REFUSAL_MESSAGES[refusal] });
}

/**
 * The `account` database hooks: each row Better Auth writes with an id token
 * (a sign-up, a link, every sign-in after) takes the email that token names,
 * and a Google account added to a login that already holds one is logged as a
 * link. A login's first account is its sign-up, never a link. The Google
 * account an unlink deletes is removed by the store, which checks again, in
 * the delete's own transaction, that the login keeps another; Better Auth's
 * own delete then does not run.
 */
export function googleAccountDatabaseHooks(store: GoogleAccountStore): AccountHooks {
  return {
    create: {
      before: async (account) => withEmail(account),
      after: async (account, ctx) => {
        if (account.providerId !== GOOGLE || !ctx) return;
        const linked = googleAccountsIn(await ctx.context.internalAdapter.findAccounts(account.userId));
        if (linked.length < 2) return;
        await store.record({ event: "link", userId: account.userId, accountRowId: account.id, email: emailOf(account) });
      },
    },
    update: {
      before: async (data) => withEmail(data),
    },
    delete: {
      before: async (account, ctx) => {
        if (ctx?.path !== UNLINK || account.providerId !== GOOGLE) return;
        const refusal = await store.remove({ userId: account.userId, accountRowId: account.id, email: emailOf(account) });
        if (refusal !== null) throw refused(refusal);
        return false;
      },
    },
  };
}

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/** The signed-in login's accounts and session as the rules read them, or null when no one is signed in (the endpoint's own check refuses then). */
async function stateOf(ctx: HookContext): Promise<GoogleAccountsState | null> {
  const session = await getSessionFromCtx(ctx);
  if (session === null) return null;
  const accounts = googleAccountsIn(await ctx.context.internalAdapter.findAccounts(session.user.id));
  return { accounts, viewingAs: impersonatorOf(session.session) !== null };
}

/** Refuses the change with the rules' own words, when the rules refuse it. */
function refuseUnless(change: GoogleAccountChange, state: GoogleAccountsState): void {
  const refusal = googleAccountRefusal(change, state);
  if (refusal !== null) throw refused(refusal);
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

export function googleAccountsPlugin() {
  return {
    id: "google-accounts",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === LINK,
          handler: createAuthMiddleware(async (ctx) => {
            const state = await stateOf(ctx);
            if (state === null) return;
            if (ctx.body?.provider !== GOOGLE) throw new APIError("BAD_REQUEST", { message: ONLY_GOOGLE });
            if (carriesIdToken(ctx.body)) throw new APIError("BAD_REQUEST", { message: ONLY_THROUGH_GOOGLE_SIGN_IN });
            refuseUnless({ kind: "link" }, state);
          }),
        },
        {
          matcher: (ctx) => ctx.path === UNLINK,
          handler: createAuthMiddleware(async (ctx) => {
            const state = await stateOf(ctx);
            if (state === null) return;
            if (ctx.body?.providerId !== GOOGLE) throw new APIError("BAD_REQUEST", { message: ONLY_GOOGLE });
            // An unlink names the account: Better Auth would otherwise take the first Google account it finds.
            const googleId = typeof ctx.body?.accountId === "string" ? ctx.body.accountId : "";
            // A first answer from the list read now; the store checks again as it deletes.
            refuseUnless({ kind: "remove", googleId }, state);
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
