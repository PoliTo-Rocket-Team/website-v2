"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

// A signed-in request whose account did not load: an expired session, or no
// team record behind the Google account. /login would send it straight back
// here (proxy.ts), so it signs out from this screen instead.
export function AccountUnresolved() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const signOut = async () => {
    setPending(true);
    const { error } = await authClient.signOut();
    if (error) {
      toast.error(`Could not sign out. ${error.message ?? "Please try again."}`);
      setPending(false);
      return;
    }
    router.replace("/login?cb=/dashboard");
    router.refresh();
  };
  return (
    <main className="flex min-h-svh items-center justify-center bg-ground px-5 text-prt-text">
      <div className="flex w-full max-w-[320px] flex-col items-center text-center">
        <Image src="/brand/prt-mark-white.svg" alt="" width={32} height={32} />
        <h1 className="mt-8 text-[26px] font-bold leading-tight tracking-[-0.02em]">
          We could not open your account
        </h1>
        <p className="mt-2 text-[15px] text-text-2">Sign out, then sign in again with Google.</p>
        <button
          type="button"
          onClick={signOut}
          disabled={pending}
          className="mt-7 h-11 rounded-full bg-prt-text px-6 text-[14px] font-medium text-ground transition-opacity duration-300 ease-out hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
