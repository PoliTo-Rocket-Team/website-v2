"use client";

import { useState, useTransition } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { toast } from "sonner";
import { advisorOptionDetail, BECOME_AN_ADVISOR, steppingDown, type HandOverOutcome } from "@/lib/dashboard/hand-over";
import { approverName, type HandOverOffer, type HandOverSend } from "@/lib/dashboard/hand-over-request";
import type { WriteResult } from "@/lib/dashboard/write";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { Field, inputClass } from "./field";
import { FullAccessMoves, RadioChoice } from "./hand-over-choice";

// "Hand over your role" on My profile (board 55d, issue #262): a division lead
// or a department head picks who takes over, from their unit, and what they do
// next. Nothing is picked for them. "Send for confirmation" stores the request
// and changes no role: the next level up confirms it from their Overview
// (board 62c). The server checks every rule again (`planHandOverSend`,
// lib/dashboard/hand-over-request.ts).

/** The row's text on My profile: what the button does, or the request waiting. */
export function handOverRowText(offer: HandOverOffer): string {
  const who = approverName(offer.role);
  if (offer.waiting === null) {
    return `You are ${offer.title}. Pick who takes over and what you do next; ${who} confirms it before anything changes.`;
  }
  const next = offer.waiting.outcome === "advisor" ? "become an advisor, without access" : "leave the team";
  return `Waiting for ${who} to confirm. ${offer.waiting.to} takes over, and you then ${next}.`;
}

export function HandOverDialog({
  open,
  onOpenChange,
  offer,
  sendHandOver,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: HandOverOffer;
  sendHandOver: (input: HandOverSend) => Promise<WriteResult<null>>;
  onSent: (waiting: NonNullable<HandOverOffer["waiting"]>) => void;
}) {
  const [to, setTo] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<HandOverOutcome | null>(null);
  const [sending, startSending] = useTransition();
  const picked = offer.successors.find((s) => s.id === to) ?? null;
  const fromWhere = offer.role.kind === "lead" ? "From your division" : "From your department";
  const who = approverName(offer.role);

  const send = () =>
    startSending(async () => {
      if (picked === null || outcome === null) return;
      const result = await sendHandOver({ role: offer.role, to: picked.id, outcome });
      if (!result.ok) {
        toast.error("Could not send it", { description: result.error });
        return;
      }
      toast.success("Sent for confirmation");
      onSent({ to: picked.name, outcome, sentAt: new Date().toISOString() });
    });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setTo(null);
          setOutcome(null);
        }
        onOpenChange(next);
      }}
      icon={<LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />}
      tone="danger"
      title="Hand over your role"
      description={`You are ${offer.title}. Before you step down, pick who takes over and what you want to do next.`}
      cancelLabel="Cancel"
      confirmLabel="Send for confirmation"
      pending={sending}
      confirmDisabled={picked === null || outcome === null}
      onConfirm={send}
    >
      <div className="mt-5 flex flex-col gap-5">
        <Field label="1. Who takes over">
          {(id) => (
            <>
              <div className="relative">
                {picked && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                    <Avatar size="sm" />
                  </span>
                )}
                <select
                  id={id}
                  value={to ?? ""}
                  onChange={(e) => setTo(e.target.value === "" ? null : Number(e.target.value))}
                  aria-describedby={`${id}-hint`}
                  className={`${inputClass()} appearance-none pr-10 [&>option]:bg-panel ${picked ? "pl-12" : ""} ${picked ? "" : "text-prt-muted"}`}
                >
                  <option value="" disabled>
                    Pick who takes over
                  </option>
                  {offer.successors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.unit}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
              </div>
              <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-prt-muted">
                {fromWhere}. {who.charAt(0).toUpperCase() + who.slice(1)} confirms it before it changes.
              </p>
            </>
          )}
        </Field>
        <RadioChoice
          name="hand-over-outcome"
          legend="2. After you hand it over"
          layout="cards"
          value={outcome}
          onChange={setOutcome}
          options={[
            { value: "advisor", title: BECOME_AN_ADVISOR, detail: `${advisorOptionDetail(offer.role, offer.unit, "you")}.` },
            { value: "leave", title: "Leave the team", detail: "Move to Alumni. Your account stays, so you can apply again later." },
          ]}
        />
        <FullAccessMoves seat={offer.seat} successor={picked?.name ?? null} from={null} step={outcome === null ? null : steppingDown(offer.role, outcome)} />
      </div>
    </ConfirmDialog>
  );
}
