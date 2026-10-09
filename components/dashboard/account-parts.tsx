"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import type { SignIn } from "@/lib/dashboard/self";
import type { ViewerSession } from "@/lib/dashboard/viewer";
import { TEST_DEVELOPER_SIGN_OUT_HREF } from "@/lib/test-developer";
import { PANEL } from "./panel";
import { GHOST_PILL } from "./page-header";

// Parts My profile (board 45) and My account (board 45b) share: the titled
// card, the Account card, signing out, and the danger buttons.

/** A titled card; `danger` gives the red edge and tint of "Leave or delete". */
export function Card({
  title,
  detail,
  meta,
  danger = false,
  children,
}: {
  title: string;
  detail?: string;
  meta?: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={danger ? "rounded-xl border border-danger/40 bg-danger/[0.05]" : PANEL}>
      <header
        className={`flex items-start justify-between gap-4 border-b px-5 py-4 md:px-[22px] ${danger ? "border-danger/25" : "border-hairline"}`}
      >
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold leading-snug">{title}</h2>
          {detail && <p className="mt-0.5 text-[13px] text-prt-muted">{detail}</p>}
        </div>
        {meta && <div className="shrink-0 pt-0.5 text-[13px] text-text-2">{meta}</div>}
      </header>
      {children}
    </section>
  );
}

/** Ends the session the viewer has: the test developer cookie, or the Better Auth session. */
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

/** The Account card: how the person signs in, and Sign out. */
export function AccountCard({ signIn, session }: { signIn: SignIn; session: ViewerSession }) {
  const signOut = useSignOut(session);
  const [pending, setPending] = useState(false);
  return (
    <Card title="Account">
      <div className="flex items-center gap-3.5 px-5 py-4 md:px-[22px]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white-5 text-text-2">
          <LogIn aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium">Signed in with Google</span>
          <span className="block truncate text-[13px] text-prt-muted">{signIn.email}</span>
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await signOut();
            setPending(false);
          }}
          className={GHOST_PILL}
        >
          Sign out
        </button>
      </div>
    </Card>
  );
}

/** The outlined red pill ("Leave the team"). */
export const DANGER_GHOST_PILL =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-danger/70 px-3.5 text-[13px] font-medium text-danger transition-colors duration-300 ease-out hover:border-danger hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

/** The filled red pill ("Delete account"). */
export const DANGER_PILL =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-danger px-3.5 text-[13px] font-semibold text-prt-text transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";
