"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { answerTeamAddress } from "@/app/dashboard/actions";
import { TEAM_DOMAIN } from "@/lib/dashboard/alias-request";
import type { AnswerTeamAddress as AnswerTeamAddressAction } from "@/lib/dashboard/overview";
import { checkTeamAddress } from "@/lib/dashboard/team-address";
import { PAPER } from "./answer-alias";
import { SHEET_CONTENT, SHEET_OVERLAY, SheetGrabber } from "./confirm-dialog";
import { Field, inputClass, LOCKED_INPUT } from "./field";
import { rowActionClass } from "./panel";

/**
 * Decline and Mark created on an open team address request (epic #578,
 * issue #788), drawn as the alias row of board 94c: Decline is the row's
 * outlined pill, Mark created the paper one, which opens the dialog below.
 * Either answer closes the request, and the Overview reads again without
 * the row.
 */
export function AnswerTeamAddress({ action, chip = false }: { action: AnswerTeamAddressAction; chip?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [marking, setMarking] = useState(false);
  const decline = () =>
    startTransition(async () => {
      const result = await answerTeamAddress(action.answerTeamAddress, { kind: "decline" });
      if (!result.ok) {
        toast.error("Could not decline the team address request", { description: result.error });
        return;
      }
      toast.success("Team address request declined");
    });
  return (
    <span className="flex shrink-0 items-center gap-2" aria-busy={pending}>
      <button type="button" disabled={pending} onClick={decline} className={`${rowActionClass(chip)} disabled:opacity-60`}>
        Decline
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setMarking(true)}
        className={`${PAPER} ${chip ? "h-6 px-2.5 text-[12px] font-medium" : "h-8 px-3.5 text-[13px]"}`}
      >
        Mark created
      </button>
      <MarkCreatedDialog open={marking} onOpenChange={setMarking} action={action} />
    </span>
  );
}

/**
 * Mark created, drawn as the alias dialog of board 94d: the address,
 * prefilled with the one asked for and checked again on the team domain
 * before it is sent; the server checks it once more and stores it under the
 * member. What it is for shows above it, read-only. A refusal (taken
 * meanwhile, already answered) shows under the field and keeps the dialog
 * open. 440px wide with a 24px pad and the row's 32px pills.
 */
function MarkCreatedDialog({ open, onOpenChange, action }: { open: boolean; onOpenChange: (open: boolean) => void; action: AnswerTeamAddressAction }) {
  const [address, setAddress] = useState(action.address);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const first = action.member.split(" ")[0] || action.member;

  const save = () => {
    const checked = checkTeamAddress(address);
    if (!checked.ok) return setError(checked.error);
    setError(undefined);
    startTransition(async () => {
      const result = await answerTeamAddress(action.answerTeamAddress, { kind: "created", address: checked.value });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Team address saved for ${action.member}`);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={SHEET_OVERLAY} />
        <DialogPrimitive.Content aria-describedby={undefined} className={cn(SHEET_CONTENT, "sm:w-[440px] sm:p-6")}>
          <SheetGrabber />
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <DialogTitle className="text-[20px] font-bold leading-snug">Team address for {action.member}</DialogTitle>
            <p className="mt-2 text-[14px] leading-relaxed text-prt-muted">
              Create it in Google Workspace first, then confirm it here. It is saved under {first}&apos;s team addresses and the person who asked is told.
            </p>
            <Field label="What it's for" className="mt-6">
              {(id) => (
                <span id={id} className={LOCKED_INPUT}>
                  <span className="min-w-0 flex-1 truncate text-prt-text">{action.purpose}</span>
                </span>
              )}
            </Field>
            <Field label="Address" error={error} className="mt-5">
              {(id, describedBy) => (
                <>
                  <input
                    id={id}
                    type="email"
                    value={address}
                    onChange={(event) => {
                      setAddress(event.target.value);
                      setError(undefined);
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={error !== undefined}
                    aria-describedby={[describedBy, `${id}-hint`].filter(Boolean).join(" ")}
                    className={inputClass(error)}
                  />
                  <p id={`${id}-hint`} className="mt-2 text-[12px] text-prt-muted">
                    One word or a dotted name, @{TEAM_DOMAIN}
                  </p>
                </>
              )}
            </Field>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:mt-5 sm:flex-row sm:justify-end sm:gap-2.5">
              <DialogClose className="inline-flex h-10 items-center justify-center rounded-full border border-white-10 px-5 text-[14px] font-medium transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-8 sm:px-3.5">
                Cancel
              </DialogClose>
              <button type="submit" disabled={pending} className={`${PAPER} h-10 px-5 text-[14px] sm:h-8 sm:px-3.5`}>
                Mark created
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
