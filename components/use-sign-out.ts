"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import type { ViewerSession } from "@/lib/dashboard/viewer";
import { TEST_DEVELOPER_SIGN_OUT_HREF } from "@/lib/test-developer";

/**
 * Ends the session the viewer has: the test developer cookie, or the Better
 * Auth session. The one sign-out the dashboard's user menu, Delete account
 * and the navbar's account menu all use.
 */
export function useSignOut(session: ViewerSession): () => Promise<void> {
  const router = useRouter();
  return async () => {
    if (session === "test-developer") {
      window.location.assign(TEST_DEVELOPER_SIGN_OUT_HREF);
      return;
    }
    const { error } = await authClient.signOut();
    if (error) {
      toast.error(`Could not sign out. ${error.message ?? "Please try again."}`);
      return;
    }
    router.replace("/login");
    router.refresh();
  };
}
