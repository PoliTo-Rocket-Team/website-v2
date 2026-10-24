import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { getDb } from "@/db/client";
import { recordViewAs, viewAsRefusal } from "@/lib/dashboard/database-view-as";
import { devTesterPlugin } from "@/lib/dev-tester-plugin";
import { testerSignInOn } from "@/lib/dev-tester";
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

/**
 * getAuth() over any database adapter; tests pass an in-memory one, and may
 * pass a View as gate that reads no database.
 */
export function createAuth(database: BetterAuthOptions["database"], viewAs: ViewAsGate = databaseViewAs) {
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
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 10 * 60,
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
      // Local-only tester sign-in (issue #129): registered on `next dev`
      // only, so previews and production keep the plugins above alone.
      ...(testerSignInOn() ? [devTesterPlugin()] : []),
    ],
  });
}

export type Auth = ReturnType<typeof getAuth>;
