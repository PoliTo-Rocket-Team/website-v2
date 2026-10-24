"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

/**
 * Ends the Better Auth session. The one sign-out the dashboard's user menu,
 * Delete account and the navbar's account menu all use.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  return async () => {
    const { error } = await authClient.signOut();
    if (error) {
      toast.error(`Could not sign out. ${error.message ?? "Please try again."}`);
      return;
    }
    router.replace("/login");
    router.refresh();
  };
}
