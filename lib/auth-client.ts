import { createAuthClient } from "better-auth/react";
import { adminClient, customSessionClient } from "better-auth/client/plugins";
import type { Auth } from "@/lib/auth";

// `adminClient` reaches the admin plugin's View as start and stop (issue
// #610); the server's View as gate decides every start (lib/view-as-plugin.ts).
export const authClient = createAuthClient({
  plugins: [customSessionClient<Auth>(), adminClient()],
});

export const { signIn, useSession } = authClient;
