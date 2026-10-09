import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession } from "better-auth/plugins";
import { getDb } from "@/db/client";
import { devTesterPlugin } from "@/lib/dev-tester-plugin";
import { testerSignInOn } from "@/lib/dev-tester";
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

/** getAuth() over any database adapter; tests pass an in-memory one. */
export function createAuth(database: BetterAuthOptions["database"]) {
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
      customSession(async ({ user }) => {
        return {
          user,
          userId: user.id,
          email: user.email,
        };
      }),
      // Local-only tester sign-in (issue #129): registered on `next dev`
      // only, so previews and production keep the plugins above alone.
      ...(testerSignInOn() ? [devTesterPlugin()] : []),
    ],
  });
}

export type Auth = ReturnType<typeof getAuth>;
