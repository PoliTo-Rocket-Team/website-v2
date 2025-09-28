import NextAuth from "next-auth";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { SignJWT } from "jose";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

// For more information on each option (and a full list of options) go to
// https://authjs.dev/reference/core/types#authconfig
export const { handlers, auth, signIn, signOut } = NextAuth({
  // https://authjs.dev/getting-started/authentication/oauth
  providers: [
    Google,
    Resend({
      from: "no-reply@politorocketteam.it",
    }),
  ],
  pages: {
    signIn: "/sign-in",
    error: "/error", //! todo custom error page needed
  },
  adapter: SupabaseAdapter({
    url: process.env.SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),

  callbacks: {
    async redirect({ url, baseUrl }) {
      const targetUrl = new URL(url, baseUrl);

      const isSignOut = targetUrl.pathname === "/"; // NextAuth default logout redirect

      if (isSignOut) {
        return baseUrl; // Redirect to home (/)
      }

      const callback = targetUrl.searchParams.get("callbackUrl");

      if (callback && callback.startsWith("/")) {
        const cleanPath = callback.split("?")[0]; // Strip oauth params
        return `${baseUrl}${cleanPath}`;
      }

      return `${baseUrl}${targetUrl.pathname}`;
    },

    async session({ session, user }) {
      const signingSecret = process.env.SUPABASE_JWT_SECRET;
      if (signingSecret) {
        const payload = {
          aud: "authenticated",
          exp: Math.floor(new Date(session.expires).getTime() / 1000),
          sub: user.id,
          email: user.email,
          role: "authenticated",
        };

        const token = await new SignJWT(payload)
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime(payload.exp)
          .sign(new TextEncoder().encode(signingSecret));

        session.supabaseAccessToken = token;
      }
      // Flatten user data into session
      session.userId = user.id;
      session.email = user.email;

      return session;
    },
  },
});
