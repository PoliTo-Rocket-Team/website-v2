import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession } from "better-auth/plugins";
import { getDb } from "@/db/client";
import {
  betterAuthAccounts,
  betterAuthSessions,
  betterAuthUsers,
  betterAuthVerifications,
} from "@/db/schema";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";

const authDb = getDb();

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL as string,
  secret: process.env.BETTER_AUTH_SECRET as string,
  trustedOrigins: ["http://localhost:3000"],
  database: drizzleAdapter(authDb, {
    provider: "pg",
    camelCase: true,
    schema: {
      user: betterAuthUsers,
      session: betterAuthSessions,
      account: betterAuthAccounts,
      verification: betterAuthVerifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name || user.email,
        resetUrl: url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        to: user.email,
        name: user.name || user.email,
        verificationUrl: url,
      });
    },
  },
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.AUTH_GOOGLE_ID as string,
      clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
    },
  },
  // session cacheing
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 10 * 60, // Cache duration in seconds (10 minutes)
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
  ],
});
