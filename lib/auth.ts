import { betterAuth, type BetterAuthOptions } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { getDb } from "@/db/client";
import { breakGlassSignInOf, readBreakGlassEmails, type BreakGlassSignIn } from "@/lib/break-glass";
import { recordGoogleAccountChange } from "@/lib/dashboard/database-google-accounts";
import { mergeLogin } from "@/lib/dashboard/database-login-merge";
import { recordBreakGlassSignIn } from "@/lib/dashboard/database-sign-in";
import { ensureSiteRow } from "@/lib/dashboard/database-site-row";
import { recordViewAs, viewAsRefusal } from "@/lib/dashboard/database-view-as";
import { devTesterPlugin, type TesterDirectory } from "@/lib/dev-tester-plugin";
import { testerSignInOn } from "@/lib/dev-tester";
import { googleAccountDatabaseHooks, googleAccountsPlugin, type GoogleAccountLog } from "@/lib/google-accounts-plugin";
import { loginMergePlugin, type LoginMerger } from "@/lib/login-merge-plugin";
import { impersonatorOf } from "@/lib/session-user";
import {
  VIEW_AS_ACCESS,
  VIEW_AS_ADMIN_ROLES,
  VIEW_AS_SESSION_SECONDS,
  viewAsPlugin,
  type ViewAsGate,
} from "@/lib/view-as-plugin";
import {
  betterAuthAccounts,
  betterAuthSessions,
  betterAuthUsers,
  betterAuthVerifications,
  users,
} from "@/db/schema";

const authBaseUrl = process.env.BETTER_AUTH_URL;
const trustedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  authBaseUrl,
].filter((origin): origin is string => Boolean(origin));

export function getAuth() {
  return createAuth(
    drizzleAdapter(getDb(), {
      provider: "pg",
      camelCase: true,
      schema: {
        user: betterAuthUsers,
        session: betterAuthSessions,
        account: betterAuthAccounts,
        verification: betterAuthVerifications,
      },
    }),
  );
}

/** Who may start View as, read from the database at request time, and where each start and stop is logged (issue #604). */
const databaseViewAs: ViewAsGate = { refusal: (start) => viewAsRefusal(start), record: recordViewAs };

/** Which account the tester sign-in reads a member id as (issue #653): the `users` row whose member it is. */
const databaseTesters: TesterDirectory = {
  memberUserId: async (memberId) => {
    const [row] = await getDb().select({ id: users.id }).from(users).where(eq(users.member, memberId)).limit(1);
    return row?.id ?? null;
  },
};

/** Where each break-glass sign-in is logged (issue #646). */
export type SignInLog = { readonly record: (signIn: BreakGlassSignIn) => Promise<void> };

const databaseSignIns: SignInLog = { record: recordBreakGlassSignIn };

/** Gives a login its `public.users` row when it has none, before its session opens (issue #910). */
export type SiteRows = { readonly ensure: (loginId: string) => Promise<unknown> };

const databaseSiteRows: SiteRows = { ensure: ensureSiteRow };

/** Where each link and unlink of a Google account is logged (issue #906). */
const databaseGoogleAccounts: GoogleAccountLog = { record: recordGoogleAccountChange };

/** Where an empty second login is judged and merged (issue #907). */
const databaseLogins: LoginMerger = { merge: mergeLogin };

/** What the auth instance reads and writes outside Better Auth's own tables. */
export type AuthDependencies = {
  readonly viewAs: ViewAsGate;
  readonly testers: TesterDirectory;
  readonly signIns: SignInLog;
  readonly siteRows: SiteRows;
  readonly googleAccounts: GoogleAccountLog;
  readonly logins: LoginMerger;
};

const databaseDependencies: AuthDependencies = {
  viewAs: databaseViewAs,
  testers: databaseTesters,
  signIns: databaseSignIns,
  siteRows: databaseSiteRows,
  googleAccounts: databaseGoogleAccounts,
  logins: databaseLogins,
};

/**
 * getAuth() over any database adapter; tests pass an in-memory one, and may
 * replace any dependency with one that reads no database.
 */
export function createAuth(database: BetterAuthOptions["database"], replaced: Partial<AuthDependencies> = {}) {
  const { viewAs, testers, signIns, siteRows, googleAccounts, logins } = { ...databaseDependencies, ...replaced };
  return betterAuth({
    baseURL: authBaseUrl as string,
    secret: process.env.BETTER_AUTH_SECRET as string,
    trustedOrigins,
    database,
    // Google is the only way to sign in (issue #118): no email and password,
    // so no verification or reset emails.
    socialProviders: {
      google: {
        prompt: "select_account",
        clientId: process.env.AUTH_GOOGLE_ID as string,
        clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
      },
    },
    // A person links more Google accounts to their own login from My profile
    // or My account (issue #906), and signs in with any of them. Google is
    // trusted and each linked account may have its own email; unlinking the
    // last account stays refused (Better Auth's default), and
    // lib/google-accounts-plugin.ts adds the rest of the rules. Each account
    // row keeps its Google account's email, never shown with any token.
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
        allowDifferentEmails: true,
      },
      additionalFields: {
        email: { type: "string", required: false, input: false },
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 10 * 60,
      },
    },
    databaseHooks: {
      account: googleAccountDatabaseHooks(googleAccounts),
      // Each sign-in of the break-glass admin writes one audit entry (issue
      // #646); every other account's sessions write nothing here.
      session: {
        create: {
          // A login whose site row is gone gets one back before its session
          // opens, so the dashboard can read it (issue #910). A repair that
          // fails leaves the sign-in as it was: the dashboard then shows that
          // the account could not be opened.
          before: async (session) => {
            try {
              await siteRows.ensure(session.userId);
            } catch (error) {
              console.error("sign-in: could not give the login its site row", error);
            }
          },
          after: async (session, ctx) => {
            // With no break-glass account set, no session reads its account.
            const allowed = readBreakGlassEmails();
            if (ctx === undefined || allowed.size === 0) return;
            const user = await ctx.context.internalAdapter.findUserById(session.userId);
            const opened = { id: session.id, userId: session.userId, impersonatedBy: impersonatorOf(session) };
            const signIn = breakGlassSignInOf(opened, user?.email ?? null, allowed);
            if (signIn !== null) await signIns.record(signIn);
          },
        },
      },
    },
    plugins: [
      customSession(async ({ user, session }) => {
        return {
          user,
          userId: user.id,
          email: user.email,
          // The acting account behind a View as session; null for a plain one (issue #604).
          impersonatedBy: impersonatorOf(session),
        };
      }),
      // View as (issue #604): the admin plugin makes and ends the
      // impersonated session; its role table grants nothing but that, and
      // the View as plugin decides who may start one, from the IT lead seat.
      admin({
        ac: VIEW_AS_ACCESS,
        roles: VIEW_AS_ADMIN_ROLES,
        impersonationSessionDuration: VIEW_AS_SESSION_SECONDS,
      }),
      viewAsPlugin(viewAs),
      googleAccountsPlugin(googleAccounts),
      // A Google account another login holds merges that login in when it
      // is empty (issue #907), over the same Google sign-in and redirect URI.
      loginMergePlugin(logins),
      // Tester sign-in as any seeded person (issues #129, #608, #653): registered under `next dev` and
      // on a preview of the shared `preview` database only, so production
      // and every other environment keep the plugins above alone.
      ...(testerSignInOn() ? [devTesterPlugin(testers)] : []),
    ],
  });
}

export type Auth = ReturnType<typeof getAuth>;
