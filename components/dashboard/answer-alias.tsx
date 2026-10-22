"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { answerAlias } from "@/app/dashboard/actions";
import { ALIAS_FORM_HINT, checkAliasAddress } from "@/lib/dashboard/alias-request";
import type { AnswerAlias as AnswerAliasAction } from "@/lib/dashboard/overview";
import { SHEET_CONTENT, SHEET_OVERLAY, SheetGrabber } from "./confirm-dialog";
import { Field, inputClass } from "./field";
import { rowActionClass } from "./panel";

const PAPER =
  "inline-flex shrink-0 items-center justify-center rounded-full bg-prt-text font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";

/**
 * Decline and Mark created on an open alias request (board 94c, epic #538):
 * Decline is the row's outlined pill, Mark created the paper one, which opens
 * the dialog of board 94d. Either answer closes the request, and the
 * Overview reads again without the row.
 */
export function AnswerAlias({ action, chip = false }: { action: AnswerAliasAction; chip?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [marking, setMarking] = useState(false);
  const decline = () =>
    startTransition(async () => {
      const result = await answerAlias(action.answerAlias, { kind: "decline" });
      if (!result.ok) {
        toast.error("Could not decline the alias request", { description: result.error });
        return;
      }
      toast.success("Alias request declined");
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
 * Board 94d: the alias address, prefilled as firstname.lastname on the team
 * domain from the member's name and checked before it is sent; the server
 * checks it again and saves it on the member's record.
 */
function MarkCreatedDialog({ open, onOpenChange, action }: { open: boolean; onOpenChange: (open: boolean) => void; action: AnswerAliasAction }) {
  const [address, setAddress] = useState(action.prefill);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const first = action.member.split(" ")[0] || action.member;

  const save = () => {
    const checked = checkAliasAddress(address);
    if (!checked.ok) return setError(checked.error);
    setError(undefined);
    startTransition(async () => {
      const result = await answerAlias(action.answerAlias, { kind: "created", address: checked.value.address });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Alias saved for ${action.member}`);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={SHEET_OVERLAY} />
        <DialogPrimitive.Content aria-describedby={undefined} className={`${SHEET_CONTENT} sm:w-[560px]`}>
          <SheetGrabber />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <DialogTitle className="text-[20px] font-bold leading-snug">Email alias for {action.member}</DialogTitle>
            <p className="mt-2 text-[14px] leading-relaxed text-text-2">
              Create it in Google Workspace first (recipient address map), then type it here. It is saved to {first}&apos;s details and {first} gets the
              setup steps.
            </p>
            <Field label="Alias address" error={error} className="mt-6">
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
                    {ALIAS_FORM_HINT}
                  </p>
                </>
              )}
            </Field>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <DialogClose className="inline-flex h-10 items-center justify-center rounded-full border border-white-10 px-5 text-[14px] font-medium transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                Cancel
              </DialogClose>
              <button type="submit" disabled={pending} className={`${PAPER} h-10 px-5 text-[14px]`}>
                Mark created
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
