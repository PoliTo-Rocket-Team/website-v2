"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { markTeamAddressRerouteDone } from "@/app/dashboard/actions";
import type { MarkRerouteDone as MarkRerouteDoneAction } from "@/lib/dashboard/overview";
import { ForwardsTo, PAPER } from "./answer-alias";
import { SHEET_CONTENT, SHEET_OVERLAY, SheetGrabber } from "./confirm-dialog";

/**
 * A team address routing item's Mark done (epic #578, issue #789), drawn as
 * the team address request row: the paper pill opens the dialog below, as
 * Mark created does on a request.
 */
export function MarkTeamAddressMoved({ action, chip = false }: { action: MarkRerouteDoneAction; chip?: boolean }) {
  const [moving, setMoving] = useState(false);
  return (
    <span className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => setMoving(true)}
        className={`${PAPER} ${chip ? "h-6 px-2.5 text-[12px] font-medium" : "h-8 px-3.5 text-[13px]"}`}
      >
        Mark done
      </button>
      <MarkDoneDialog open={moving} onOpenChange={setMoving} action={action} />
    </span>
  );
}

/**
 * Mark done, drawn as the Mark created dialog of board 94d: the new holder's
 * sign-in email the address now forwards to, as Forwards to with a copy
 * button (issue #586), for Google Workspace's recipient address map. Mark
 * done moves the address to the new holder, who gets the setup steps, and the
 * Overview reads again without the row. A refusal (already moved) shows as a
 * toast and closes nothing. 440px wide with a 24px pad and the row's 32px
 * pills.
 */
function MarkDoneDialog({ open, onOpenChange, action }: { open: boolean; onOpenChange: (open: boolean) => void; action: MarkRerouteDoneAction }) {
  const [pending, startTransition] = useTransition();
  const first = action.member.split(" ")[0] || action.member;
  const markDone = () =>
    startTransition(async () => {
      const result = await markTeamAddressRerouteDone(action.markRerouteDone);
      if (!result.ok) {
        toast.error(`Could not move ${action.address}`, { description: result.error });
        return;
      }
      toast.success(`${action.address} moved to ${action.member}`);
      onOpenChange(false);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={SHEET_OVERLAY} />
        <DialogPrimitive.Content aria-describedby={undefined} className={cn(SHEET_CONTENT, "sm:w-[440px] sm:p-6")}>
          <SheetGrabber />
          <DialogTitle className="break-words text-[20px] font-bold leading-snug">
            Move {action.address} to {action.member}
          </DialogTitle>
          <p className="mt-2 text-[14px] leading-relaxed text-prt-muted">
            Point it at {first}&apos;s sign-in email in Google Workspace first (recipient address map), then mark it done here.{" "}
            {`It moves to ${first}'s PRT emails and ${first} gets the setup steps.`}
          </p>
          <ForwardsTo signInEmail={action.signInEmail} className="mt-6" />
          <div className="mt-6 flex flex-col-reverse gap-3 sm:mt-5 sm:flex-row sm:justify-end sm:gap-2.5">
            <DialogClose className="inline-flex h-10 items-center justify-center rounded-full border border-white-10 px-5 text-[14px] font-medium transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-8 sm:px-3.5">
              Cancel
            </DialogClose>
            <button type="button" disabled={pending} onClick={markDone} className={`${PAPER} h-10 px-5 text-[14px] sm:h-8 sm:px-3.5`}>
              Mark done
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
