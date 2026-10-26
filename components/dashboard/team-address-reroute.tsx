"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { markTeamAddressRerouteDone } from "@/app/dashboard/actions";
import type { MarkRerouteDone as MarkRerouteDoneAction } from "@/lib/dashboard/overview";
import { PAPER } from "./answer-alias";
import { CopyButton } from "./copy-button";

/**
 * A team address routing item's buttons (epic #578, issue #789), drawn as
 * the team address request row: the copy button takes the new holder's
 * sign-in email, which the address forwards to once it is moved in Google
 * Workspace, and Mark done is the paper pill. Mark done moves the address to
 * the new holder, and the Overview reads again without the row.
 */
export function MarkTeamAddressMoved({ action, chip = false }: { action: MarkRerouteDoneAction; chip?: boolean }) {
  const [pending, startTransition] = useTransition();
  const markDone = () =>
    startTransition(async () => {
      const result = await markTeamAddressRerouteDone(action.markRerouteDone);
      if (!result.ok) {
        toast.error(`Could not move ${action.address}`, { description: result.error });
        return;
      }
      toast.success(`${action.address} moved to ${action.member}`);
    });
  return (
    <span className="flex shrink-0 items-center gap-2" aria-busy={pending}>
      <CopyButton value={action.signInEmail} what="Sign-in email" />
      <button
        type="button"
        disabled={pending}
        onClick={markDone}
        className={`${PAPER} ${chip ? "h-6 px-2.5 text-[12px] font-medium" : "h-8 px-3.5 text-[13px]"}`}
      >
        Mark done
      </button>
    </span>
  );
}
