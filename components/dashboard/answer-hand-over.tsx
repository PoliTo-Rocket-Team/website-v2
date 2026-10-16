"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { answerHandOver } from "@/app/dashboard/actions";
import type { HandOverAnswer } from "@/lib/dashboard/hand-over-request";
import { rowActionClass } from "./panel";

/**
 * Decline and Confirm on a hand-over waiting for the viewer (board 62c, issue
 * #262): Decline is the row's outlined pill, Confirm the paper one. Confirm
 * runs the hand-over at once; either answer notifies the sender, and the
 * Overview then reads again without the row.
 */
export function AnswerHandOver({ requestId, chip = false }: { requestId: number; chip?: boolean }) {
  const [pending, startTransition] = useTransition();
  const answer = (choice: HandOverAnswer) =>
    startTransition(async () => {
      const result = await answerHandOver(requestId, choice);
      if (!result.ok) {
        toast.error(choice === "confirm" ? "Could not confirm the hand-over" : "Could not decline the hand-over", { description: result.error });
        return;
      }
      toast.success(choice === "confirm" ? "Hand-over confirmed" : "Hand-over declined");
    });
  const confirm = chip
    ? "h-6 bg-prt-text px-2.5 text-[12px] text-ground hover:opacity-90"
    : "h-8 bg-prt-text px-3.5 text-[13px] font-semibold text-ground hover:opacity-90";
  return (
    <span className="flex shrink-0 items-center gap-2" aria-busy={pending}>
      <button type="button" disabled={pending} onClick={() => answer("decline")} className={`${rowActionClass(chip)} disabled:opacity-60`}>
        Decline
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => answer("confirm")}
        className={`inline-flex shrink-0 items-center rounded-full font-medium transition-opacity duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${confirm}`}
      >
        Confirm
      </button>
    </span>
  );
}
