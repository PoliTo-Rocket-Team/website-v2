import { createAuthClient } from "better-auth/react";
import { customSessionClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth"; // Import the auth instance as a type'

export const authClient = createAuthClient({
  plugins: [customSessionClient<typeof auth>()],
});

export const { signIn, signUp, useSession } = authClient;
