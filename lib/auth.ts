import { betterAuth } from "better-auth";
import { customSession } from "better-auth/plugins";
import { Pool } from "pg";
import { generateSupabaseAccessToken } from "./supabase-jwt";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL as string,
  trustedOrigins: ["http://localhost:3000"],
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
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
    customSession(async ({ user, session }) => {
      // Generate Supabase access token and attach to session
      const supabaseAccessToken = await generateSupabaseAccessToken(
        user.id,
        user.email
      );

      return {
        user,
        supabaseAccessToken,
        userId: user.id,
        email: user.email,
      };
    }),
  ],
});
