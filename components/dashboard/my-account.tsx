"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check, FileText } from "lucide-react";
import { toast } from "sonner";
import { RocketArrow } from "@/components/landing/rocket-arrow";
import type { ApplicationStatus } from "@/lib/dashboard/overview";
import { isOpenApplication, type AccountApplication, type MyAccount } from "@/lib/dashboard/self";
import type { ViewerSession } from "@/lib/dashboard/viewer";
import type { WriteResult } from "@/lib/dashboard/write";
import { AccountCard, Card, DANGER_PILL, useSignOut } from "./account-parts";
import { ConfirmDialog } from "./confirm-dialog";
import { GHOST_PILL, PageHeader } from "./page-header";

type Actions = {
  withdrawApplication: (applicationId: number) => Promise<WriteResult<null>>;
  deleteAccount: (withdrawOpenApplications: boolean) => Promise<WriteResult<null>>;
};

// The Overview's status pills (components/dashboard/overview.tsx): board 45b
// draws In review in blue, which the palette does not have.
const STATUS: Readonly<Record<ApplicationStatus, { label: string; className: string }>> = {
  received: { label: "Received", className: "bg-white-10 text-text-2" },
  "in-review": { label: "In review", className: "bg-accent-soft text-accent" },
  accepted: { label: "Accepted", className: "bg-success-soft text-success" },
  declined: { label: "Declined", className: "bg-white-5 text-prt-muted" },
};

// Board 45b: an applicant's own account. Their applications, each open one
// with Withdraw; how they sign in; and Delete account, which removes the
// sign-in only unless they tick the box. Props in, nothing fetched.
export function MyAccountView({ account, session, ...actions }: { account: MyAccount; session: ViewerSession } & Actions) {
  const [applications, setApplications] = useState(account.applications);
  const [withdrawing, setWithdrawing] = useState<AccountApplication | null>(null);
  const [pending, setPending] = useState(false);

  const withdraw = async () => {
    if (withdrawing === null) return;
    setPending(true);
    try {
      const result = await actions.withdrawApplication(withdrawing.id);
      if (!result.ok) {
        toast.error("Could not withdraw", { description: result.error });
        return;
      }
      setApplications((all) => all.filter((a) => a.id !== withdrawing.id));
      toast.success(`Withdrew your application for ${withdrawing.title}`);
      setWithdrawing(null);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <PageHeader title="My account" intro="Your applications and your account." />
      <div className="mt-6 flex flex-col gap-5">
        <Card
          title="Your applications"
          meta={
            <Link href="/apply" className="group inline-flex items-center gap-1.5 transition-colors duration-300 ease-out hover:text-accent">
              See open positions
              <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
            </Link>
          }
        >
          {applications.length > 0 && (
            <ul className="divide-y divide-hairline">
              {applications.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 md:px-[22px]">
                  <span className="flex min-w-0 flex-1 basis-full items-center gap-3.5 sm:basis-auto">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white-5 text-text-2">
                      <FileText aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium">{a.title}</span>
                      <span className="block truncate text-[13px] text-prt-muted">{a.detail}</span>
                    </span>
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[12px] ${STATUS[a.status].className}`}>{STATUS[a.status].label}</span>
                    {isOpenApplication(a.status) && (
                      <button type="button" onClick={() => setWithdrawing(a)} className={GHOST_PILL}>
                        Withdraw
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <AccountCard signIn={account.signIn} session={session} />
        <DangerZone session={session} deleteAccount={actions.deleteAccount} />
      </div>

      <ConfirmDialog
        open={withdrawing !== null}
        onOpenChange={(open) => !open && setWithdrawing(null)}
        title={`Withdraw from ${withdrawing?.title ?? ""}?`}
        confirmLabel="Withdraw"
        danger
        pending={pending}
        onConfirm={withdraw}
      >
        The team stops looking at this application. You can apply again while the position is open.
      </ConfirmDialog>
    </>
  );
}

function DangerZone({ session, deleteAccount }: { session: ViewerSession; deleteAccount: Actions["deleteAccount"] }) {
  const [alsoWithdraw, setAlsoWithdraw] = useState(false);
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const signOut = useSignOut(session);
  const boxId = useId();

  const confirm = async () => {
    setPending(true);
    try {
      const result = await deleteAccount(alsoWithdraw);
      if (!result.ok) {
        toast.error("Could not delete your account", { description: result.error });
        return;
      }
      toast.success("Your account is deleted");
      await signOut();
    } finally {
      setPending(false);
    }
  };

  return (
    <Card title="Danger zone" danger>
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-[22px]">
        <div className="min-w-0">
          <p className="text-[14px] font-medium">Delete account</p>
          <p className="mt-0.5 text-[13px] text-prt-muted">Deletes your sign-in only. Your applications stay with the team as they are.</p>
          <label htmlFor={boxId} className="mt-3 flex cursor-pointer items-center gap-2.5 text-[13px] text-text-2">
            <input id={boxId} type="checkbox" checked={alsoWithdraw} onChange={(e) => setAlsoWithdraw(e.target.checked)} className="peer sr-only" />
            <span
              aria-hidden
              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${
                alsoWithdraw ? "border-danger bg-danger text-prt-text" : "border-border-strong"
              }`}
            >
              {alsoWithdraw && <Check className="h-3 w-3" strokeWidth={2.5} />}
            </span>
            Also withdraw my open applications and delete my files
          </label>
        </div>
        <button type="button" onClick={() => setAsking(true)} className={`${DANGER_PILL} self-start sm:self-auto`}>
          Delete account
        </button>
      </div>

      <ConfirmDialog open={asking} onOpenChange={setAsking} title="Delete your account?" confirmLabel="Delete account" danger pending={pending} onConfirm={confirm}>
        {alsoWithdraw
          ? "Your sign-in is deleted, your open applications are withdrawn, and the files you uploaded are deleted."
          : "Your sign-in is deleted. Your applications stay with the team as they are."}
      </ConfirmDialog>
    </Card>
  );
}
