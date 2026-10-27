"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { markTeamAddressRemovalDone } from "@/app/dashboard/actions";
import type { MarkRemovalDone as MarkRemovalDoneAction } from "@/lib/dashboard/overview";
import { PAPER } from "./answer-alias";
import { SHEET_CONTENT, SHEET_OVERLAY, SheetGrabber } from "./confirm-dialog";

/**
 * A team address removal's Mark done (issue #797), drawn as the routing
 * item's row (`MarkTeamAddressMoved`, ./team-address-reroute.tsx): the paper
 * pill opens the dialog below.
 */
export function MarkTeamAddressRemoved({ action, chip = false }: { action: MarkRemovalDoneAction; chip?: boolean }) {
  const [removing, setRemoving] = useState(false);
  return (
    <span className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => setRemoving(true)}
        className={`${PAPER} ${chip ? "h-6 px-2.5 text-[12px] font-medium" : "h-8 px-3.5 text-[13px]"}`}
      >
        Mark done
      </button>
      <MarkRemovedDialog open={removing} onOpenChange={setRemoving} action={action} />
    </span>
  );
}

/**
 * Mark done, drawn as the routing item's dialog with no Forwards to: there
 * is no new holder. It asks to turn the routing off in Google Workspace
 * first; Mark done then deletes the address, so it leaves the holder's team
 * addresses and can be requested again, and the Overview reads again
 * without the row. A refusal (already removed) shows as a toast and closes
 * nothing. 440px wide with a 24px pad and the row's 32px pills.
 */
function MarkRemovedDialog({ open, onOpenChange, action }: { open: boolean; onOpenChange: (open: boolean) => void; action: MarkRemovalDoneAction }) {
  const [pending, startTransition] = useTransition();
  const first = action.member.split(" ")[0] || action.member;
  const markDone = () =>
    startTransition(async () => {
      const result = await markTeamAddressRemovalDone(action.markRemovalDone);
      if (!result.ok) {
        toast.error(`Could not remove ${action.address}`, { description: result.error });
        return;
      }
      toast.success(`${action.address} removed from ${action.member}`);
      onOpenChange(false);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={SHEET_OVERLAY} />
        <DialogPrimitive.Content aria-describedby={undefined} className={cn(SHEET_CONTENT, "sm:w-[440px] sm:p-6")}>
          <SheetGrabber />
          <DialogTitle className="break-words text-[20px] font-bold leading-snug">
            Remove {action.address} from {action.member}
          </DialogTitle>
          <p className="mt-2 text-[14px] leading-relaxed text-prt-muted">
            Turn off its routing in Google Workspace first (recipient address map), then mark it done here.{" "}
            {`It leaves ${first}'s team addresses and can be requested again for someone else.`}
          </p>
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
