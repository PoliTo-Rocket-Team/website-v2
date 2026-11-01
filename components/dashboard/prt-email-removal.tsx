"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AtSign } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { answerPrtEmailRemoval } from "@/app/dashboard/actions";
import type { AnswerPrtEmailRemoval as AnswerPrtEmailRemovalAction } from "@/lib/dashboard/overview";
import { PAPER } from "./answer-alias";
import { ConfirmDialog, SHEET_CONTENT, SHEET_OVERLAY, SheetGrabber } from "./confirm-dialog";
import { rowActionClass } from "./panel";

/**
 * Keep address and Mark done on a personal PRT email removal (issue #931),
 * drawn as a team address removal's row (`MarkTeamAddressRemoved`,
 * ./team-address-removal.tsx) with Keep address beside it as the outlined
 * pill, as Decline sits beside Mark created on an alias request. Each opens
 * its dialog; either answer closes the removal, and the Overview reads again
 * without the row.
 */
export function AnswerPrtEmailRemoval({ action, chip = false }: { action: AnswerPrtEmailRemovalAction; chip?: boolean }) {
  const [dialog, setDialog] = useState<"keep" | "remove" | null>(null);
  const openChange = (which: "keep" | "remove") => (open: boolean) => setDialog(open ? which : null);
  return (
    <span className="flex shrink-0 items-center gap-2">
      <button type="button" onClick={() => setDialog("keep")} className={rowActionClass(chip)}>
        Keep address
      </button>
      <button
        type="button"
        onClick={() => setDialog("remove")}
        className={`${PAPER} ${chip ? "h-6 px-2.5 text-[12px] font-medium" : "h-8 px-3.5 text-[13px]"}`}
      >
        Mark done
      </button>
      <KeepDialog open={dialog === "keep"} onOpenChange={openChange("keep")} action={action} />
      <MarkRemovedDialog open={dialog === "remove"} onOpenChange={openChange("remove")} action={action} />
    </span>
  );
}

/** Sends one answer; a refusal (answered already by another approver) shows as a toast and closes nothing. */
function useAnswer(action: AnswerPrtEmailRemovalAction, onOpenChange: (open: boolean) => void) {
  const [pending, startTransition] = useTransition();
  const send = (answer: "removed" | "kept", failed: string, done: string) =>
    startTransition(async () => {
      const result = await answerPrtEmailRemoval(action.answerPrtEmailRemoval, answer);
      if (!result.ok) {
        toast.error(failed, { description: result.error });
        return;
      }
      toast.success(done);
      onOpenChange(false);
    });
  return { pending, send };
}

/** Keep address: the member keeps the mailbox, and this leave asks no more. */
function KeepDialog({ open, onOpenChange, action }: { open: boolean; onOpenChange: (open: boolean) => void; action: AnswerPrtEmailRemovalAction }) {
  const { pending, send } = useAnswer(action, onOpenChange);
  const first = action.member.split(" ")[0] || action.member;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<AtSign className="h-5 w-5" strokeWidth={1.75} />}
      title={`Keep ${action.address}?`}
      description={`${first} keeps this PRT email after leaving the team. The task closes, and it does not come back for this leave.`}
      cancelLabel="Cancel"
      confirmLabel="Keep address"
      pending={pending}
      onConfirm={() => send("kept", `Could not keep ${action.address}`, `${action.address} kept for ${action.member}`)}
    />
  );
}

/**
 * Mark done, drawn as a team address removal's dialog: it asks to delete the
 * mailbox in Google Workspace first; Mark done then clears the member's PRT
 * email on the site. 440px wide with a 24px pad and the row's 32px pills.
 */
function MarkRemovedDialog({ open, onOpenChange, action }: { open: boolean; onOpenChange: (open: boolean) => void; action: AnswerPrtEmailRemovalAction }) {
  const { pending, send } = useAnswer(action, onOpenChange);
  const first = action.member.split(" ")[0] || action.member;
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
            Delete the mailbox in Google Workspace first, then mark it done here.{" "}
            {`It is cleared from ${first}'s record on the site.`}
          </p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:mt-5 sm:flex-row sm:justify-end sm:gap-2.5">
            <DialogClose className="inline-flex h-10 items-center justify-center rounded-full border border-white-10 px-5 text-[14px] font-medium transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-8 sm:px-3.5">
              Cancel
            </DialogClose>
            <button
              type="button"
              disabled={pending}
              onClick={() => send("removed", `Could not remove ${action.address}`, `${action.address} removed from ${action.member}`)}
              className={`${PAPER} h-10 px-5 text-[14px] sm:h-8 sm:px-3.5`}
            >
              Mark done
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
