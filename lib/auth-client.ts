import { createAuthClient } from "better-auth/react";
import { customSessionClient } from "better-auth/client/plugins";
import type { Auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [customSessionClient<Auth>()],
});

export const { signIn, signUp, useSession } = authClient;
