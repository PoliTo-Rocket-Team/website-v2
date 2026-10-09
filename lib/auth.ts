import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession, oAuthProxy } from "better-auth/plugins";
import { getDb } from "@/db/client";
import { devTesterPlugin } from "@/lib/dev-tester-plugin";
import { testerSignInOn } from "@/lib/dev-tester";
import {
  betterAuthAccounts,
  betterAuthSessions,
  betterAuthUsers,
  betterAuthVerifications,
} from "@/db/schema";
import { authUrls, trustedOriginsFor } from "@/lib/auth-urls";

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
  const urls = authUrls(process.env);
  const { proxy } = urls;

  return betterAuth({
    baseURL: urls.baseURL,
    secret: process.env.BETTER_AUTH_SECRET as string,
    trustedOrigins: (request) => trustedOriginsFor(urls, request),
    // Through the proxy, the sign-in starts on a preview and ends on v2dev,
    // which need not share a database, so the OAuth state travels encrypted
    // in the state parameter rather than as a database row.
    account: proxy.on ? { storeStateStrategy: "cookie" } : undefined,
    database,
    // Google is the only way to sign in (issue #118): no email and password,
    // so no verification or reset emails.
    socialProviders: {
      google: {
        prompt: "select_account",
        clientId: process.env.AUTH_GOOGLE_ID as string,
        clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
        // Previews are not on Google's redirect list; v2dev is (issue #130).
        ...(proxy.on ? { redirectURI: proxy.googleRedirectURI } : {}),
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
      ...(proxy.on ? [oAuthProxy({ productionURL: proxy.productionURL })] : []),
      // Local-only tester sign-in (issue #129): registered on `next dev`
      // only, so previews and production keep the plugins above alone.
      ...(testerSignInOn() ? [devTesterPlugin()] : []),
    ],
  });
}

export type Auth = ReturnType<typeof getAuth>;
