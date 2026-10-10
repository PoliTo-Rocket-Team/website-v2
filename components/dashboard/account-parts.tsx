"use client";

import { useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Info, LogIn, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { DELETE_ACCOUNT_COPY, DELETE_WORD, deleteConfirmed, type SignIn } from "@/lib/dashboard/self";
import { initialsOf, type ViewerSession } from "@/lib/dashboard/viewer";
import type { WriteResult } from "@/lib/dashboard/write";
import { TEST_DEVELOPER_SIGN_OUT_HREF } from "@/lib/test-developer";
import { ConfirmDialog } from "./confirm-dialog";
import { inputClass } from "./field";
import { PANEL } from "./panel";

// Parts My profile (board 55) and My account (board 51) share: the titled
// card, the sign-in cards, signing out, and Delete account.

/** A titled card; `danger` gives the red edge and tint of "Delete account" and "Leave or delete". */
export function Card({
  title,
  detail,
  meta,
  danger = false,
  className = "",
  children,
}: {
  title: string;
  detail?: string;
  meta?: ReactNode;
  danger?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${danger ? "rounded-xl border border-danger/40 bg-danger/[0.05]" : PANEL} ${className}`}>
      <header
        className={`flex items-start justify-between gap-4 border-b px-5 py-4 md:px-6 ${danger ? "border-danger/25" : "border-hairline"}`}
      >
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold leading-snug">{title}</h2>
          {detail && <p className="mt-0.5 text-[13px] text-prt-muted">{detail}</p>}
        </div>
        {meta && <div className="shrink-0">{meta}</div>}
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

/** The accent circle with the person's initials (boards 51 and 55m). */
export function InitialsAvatar({ name, className }: { name: string; className: string }) {
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-on-accent ${className}`}>
      {initialsOf(name)}
    </span>
  );
}

/** Board 51's Sign-in card: who they are and the Google account. Sign out lives in the user menu. */
export function SignInCard({ name, signIn }: { name: string; signIn: SignIn }) {
  return (
    <Card title="Sign-in">
      <div className="flex items-center gap-4 px-5 py-5 md:px-6">
        <InitialsAvatar name={name} className="h-12 w-12 text-[17px]" />
        <span className="min-w-0">
          <span className="block text-[16px] font-semibold">{name}</span>
          <span className="block truncate text-[13px] text-prt-muted">
            {signIn.email} · <span className="md:hidden">Google</span>
            <span className="hidden md:inline">Google account</span>
          </span>
        </span>
      </div>
    </Card>
  );
}

/** Board 55's Account card: how the person signs in. Sign out lives in the user menu. */
export function AccountCard({ signIn }: { signIn: SignIn }) {
  return (
    <Card title="Account">
      <div className="flex items-center gap-3.5 px-5 py-4 md:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white-5 text-text-2">
          <LogIn aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium">Signed in with Google</span>
          <span className="block truncate text-[13px] text-prt-muted">{signIn.email}</span>
        </span>
      </div>
    </Card>
  );
}

/** The outlined red pill ("Leave the team"). */
export const DANGER_GHOST_PILL =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-danger/70 px-4 text-[14px] font-semibold text-danger transition-colors duration-300 ease-out hover:border-danger hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

/** The filled red pill ("Delete account"). */
export const DANGER_PILL =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-danger px-4 text-[14px] font-semibold text-prt-text transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

/** A danger card with no title row: board 51's Delete account box. */
export function DangerBox({ children }: { children: ReactNode }) {
  return <section className="rounded-xl border border-danger/40 bg-danger/[0.05]">{children}</section>;
}

/** One row of a danger card: what it does, and its button (full width on phones). */
export function DangerRow({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-text-2">{text}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Boards 51c and 55c: type DELETE, then the account closes and the page signs
 * out. An applicant may also withdraw their open applications; a member
 * leaves the team with it.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  session,
  openApplications,
  member,
  deleteAccount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ViewerSession;
  /** How many open applications an applicant has; null for a member. */
  openApplications: number | null;
  member: boolean;
  deleteAccount: (withdrawOpenApplications: boolean) => Promise<WriteResult<null>>;
}) {
  const [typed, setTyped] = useState("");
  const [alsoWithdraw, setAlsoWithdraw] = useState(false);
  const [pending, setPending] = useState(false);
  const signOut = useSignOut(session);
  const inputId = useId();
  const boxId = useId();

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setTyped("");
      setAlsoWithdraw(false);
    }
  };

  const confirm = async () => {
    if (!deleteConfirmed(typed)) return;
    setPending(true);
    try {
      const result = await deleteAccount(alsoWithdraw);
      if (!result.ok) {
        toast.error("Could not delete your account", { description: result.error });
        return;
      }
      toast.success("Your account is closed");
      await signOut();
    } finally {
      setPending(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={close}
      icon={<Trash2 className="h-[18px] w-[18px]" strokeWidth={1.75} />}
      title="Delete your account?"
      description={member ? `You leave the team too. ${DELETE_ACCOUNT_COPY}` : DELETE_ACCOUNT_COPY}
      cancelLabel="Keep account"
      confirmLabel="Delete account"
      danger
      pending={pending}
      confirmDisabled={!deleteConfirmed(typed)}
      onConfirm={confirm}
    >
      {openApplications !== null && openApplications > 0 && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-hairline bg-white-5 px-4 py-3.5 text-[13px] text-text-2">
          <p className="flex items-center gap-2.5">
            <Info aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {openApplications === 1 ? "Your sent application stays with the team" : `Your ${openApplications} sent applications stay with the team`}
          </p>
          <label htmlFor={boxId} className="flex cursor-pointer items-center gap-2.5">
            <input id={boxId} type="checkbox" checked={alsoWithdraw} onChange={(e) => setAlsoWithdraw(e.target.checked)} className="peer sr-only" />
            <span
              aria-hidden
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${
                alsoWithdraw ? "border-danger bg-danger text-prt-text" : "border-border-strong"
              }`}
            >
              {alsoWithdraw && <Check className="h-3 w-3" strokeWidth={2.5} />}
            </span>
            Also withdraw my open applications
          </label>
        </div>
      )}
      <label htmlFor={inputId} className="mt-5 block text-[13px] font-medium">
        Type {DELETE_WORD} to confirm
      </label>
      <input
        id={inputId}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={DELETE_WORD}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className={`${inputClass()} mt-2 font-mono tracking-[0.2em]`}
      />
    </ConfirmDialog>
  );
}
