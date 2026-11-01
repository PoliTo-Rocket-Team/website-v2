import { createAuthClient } from "better-auth/react";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { adminClient, customSessionClient } from "better-auth/client/plugins";
import type { Auth } from "@/lib/auth";

/**
 * Reads the session again after a Google account is removed: removing the
 * account whose email is the sign-in email moves that email (issue #949), and
 * whatever shows the session's email then shows the new one.
 */
const googleAccountsClient = {
  id: "google-accounts",
  atomListeners: [{ signal: "$sessionSignal", matcher: (path) => path === "/unlink-account" }],
} satisfies BetterAuthClientPlugin;

// `adminClient` reaches the admin plugin's View as start and stop (issue
// #610); the server's View as gate decides every start (lib/view-as-plugin.ts).
export const authClient = createAuthClient({
  plugins: [customSessionClient<Auth>(), adminClient(), googleAccountsClient],
});

export const { signIn, useSession } = authClient;
