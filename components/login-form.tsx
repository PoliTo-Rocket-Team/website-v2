"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { signIn } from "@/lib/auth-client";
import { callbackPath } from "@/lib/auth-callback";
import { Icons } from "@/components/ui/icons";

// The only way to sign in (issue #118). Google returns the user to the `cb`
// page that sent them here, or to the dashboard.
export function GoogleSignInButton() {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const callbackURL = callbackPath(searchParams.get("cb"));

  const signInWithGoogle = async () => {
    setPending(true);
    try {
      await signIn.social({ provider: "google", callbackURL });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast.error(`Could not sign in with Google. ${message}`);
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={signInWithGoogle}
      disabled={pending}
      aria-busy={pending}
      className="inline-flex h-11 items-center gap-2.5 rounded-full bg-prt-text px-5 text-[14px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? (
        <Icons.spinner className="size-[18px] motion-safe:animate-spin" aria-hidden="true" />
      ) : (
        // Google's own mark, in its own colours (brand rule), so it is a file, not a token.
        <img src="/brand/google-g.svg" alt="" width={18} height={18} />
      )}
      Continue with Google
    </button>
  );
}
