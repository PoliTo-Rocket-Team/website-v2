"use client";

import { useState, useTransition } from "react";
import { AtSign, Mail, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { ALIAS_FORM_HINT, checkAliasAddress } from "@/lib/dashboard/alias-request";
import { editsPrtEmail, PRT_EMAIL_EDIT_WARNING, PRT_EMAIL_REQUESTED, type OwnPrtEmail } from "@/lib/dashboard/own-prt-email";
import type { WriteResult } from "@/lib/dashboard/write";
import { cn } from "@/lib/utils";
import { SHEET_BUTTONS, SHEET_CANCEL, SHEET_CONTENT, SHEET_OVERLAY, SheetGrabber, sheetConfirm } from "./confirm-dialog";
import { Field, inputClass } from "./field";
import { GHOST_PILL } from "./page-header";

// The member's own PRT email on My profile (issue #921): the field they edit,
// the warning while they edit it, and, while it is empty, Request my PRT email
// or the request waiting for IT. The rules are ./own-prt-email.ts's.

export type RequestOwnAlias = (address: string) => Promise<WriteResult<null>>;

/** The PRT email box: a mail icon and the address, typed in lower case on the team domain. */
export function PrtEmailInput({
  id,
  describedBy,
  value,
  error,
  onChange,
}: {
  id: string;
  describedBy: string | undefined;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Mail aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-2" strokeWidth={1.75} />
      <input
        id={id}
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ALIAS_FORM_HINT}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className={`${inputClass(error)} pl-10`}
      />
    </div>
  );
}

/** The warning under the field while the typed PRT email differs from the saved one. */
export function PrtEmailWarning({ saved, typed }: { saved: string; typed: string }) {
  if (!editsPrtEmail(saved, typed)) return null;
  return (
    <p role="note" className="mt-2.5 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/[0.05] px-3.5 py-2.5 text-[13px] leading-snug text-warning">
      <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      {PRT_EMAIL_EDIT_WARNING}
    </p>
  );
}

/**
 * Under an empty PRT email: Request my PRT email, which opens the request
 * dialog, or, once a request is open, "Requested · waiting for IT" in its
 * place. A set PRT email shows nothing here.
 */
export function PrtEmailRequest({
  own,
  requestOwnAlias,
  onRequested,
  className = "",
}: {
  own: OwnPrtEmail;
  requestOwnAlias: RequestOwnAlias;
  onRequested: () => void;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (own.kind === "set") return null;
  if (own.kind === "requested") {
    return (
      <p className={cn("inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-0.5 text-[13px] font-medium text-warning", className)}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />
        {PRT_EMAIL_REQUESTED}
      </p>
    );
  }
  return (
    <div className={className}>
      <button type="button" onClick={() => setAsking(true)} className={GHOST_PILL}>
        <AtSign aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Request my PRT email
      </button>
      <RequestOwnPrtEmailDialog
        open={asking}
        onOpenChange={setAsking}
        prefill={own.prefill}
        requestOwnAlias={requestOwnAlias}
        onRequested={() => {
          setAsking(false);
          onRequested();
        }}
      />
    </div>
  );
}

/**
 * Request my PRT email (issue #921): the address, prefilled as
 * firstname.lastname on the team domain from the member's name and editable,
 * then Cancel and Send request, as Request PRT email's Personal choice draws
 * it (issue #798). It is checked before sending (`checkAliasAddress`); the
 * server checks it again, and a refusal shows above the buttons and keeps the
 * dialog open. Closing it drops what was typed.
 */
function RequestOwnPrtEmailDialog({
  open,
  onOpenChange,
  prefill,
  requestOwnAlias,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill: string;
  requestOwnAlias: RequestOwnAlias;
  onRequested: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={SHEET_OVERLAY} />
        <DialogPrimitive.Content aria-describedby={undefined} className={cn(SHEET_CONTENT, "sm:w-[480px] sm:p-6")}>
          <SheetGrabber />
          <DialogTitle className="text-[17px] font-bold leading-snug">Request my PRT email</DialogTitle>
          <p className="mt-1.5 text-[14px] leading-relaxed text-prt-muted">
            The IT lead creates it in Google Workspace. Then it shows on your profile.
          </p>
          <RequestForm prefill={prefill} requestOwnAlias={requestOwnAlias} onRequested={onRequested} />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function RequestForm({ prefill, requestOwnAlias, onRequested }: { prefill: string; requestOwnAlias: RequestOwnAlias; onRequested: () => void }) {
  const [address, setAddress] = useState(prefill);
  const [error, setError] = useState<string>();
  const [refusal, setRefusal] = useState<string>();
  const [pending, startTransition] = useTransition();

  const send = () => {
    const checked = checkAliasAddress(address);
    setRefusal(undefined);
    if (!checked.ok) return setError(checked.error);
    setError(undefined);
    startTransition(async () => {
      const result = await requestOwnAlias(checked.value.address);
      if (!result.ok) {
        setRefusal(result.error);
        return;
      }
      toast.success("PRT email requested");
      onRequested();
    });
  };

  return (
    <form
      noValidate
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
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
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={error !== undefined}
              aria-describedby={[describedBy, `${id}-hint`].filter(Boolean).join(" ")}
              className={cn(inputClass(error), "h-10")}
            />
            <p id={`${id}-hint`} className="mt-2 text-[12px] text-prt-muted">
              {ALIAS_FORM_HINT}
            </p>
          </>
        )}
      </Field>
      {refusal !== undefined && (
        <p role="alert" className="mt-5 text-[13px] text-danger">
          {refusal}
        </p>
      )}
      <div className={SHEET_BUTTONS}>
        <DialogClose className={cn(SHEET_CANCEL, "sm:h-10")}>Cancel</DialogClose>
        <button type="submit" disabled={pending} className={cn(sheetConfirm(false), "sm:h-10")}>
          Send request
        </button>
      </div>
    </form>
  );
}
