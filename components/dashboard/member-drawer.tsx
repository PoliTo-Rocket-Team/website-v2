"use client";

import { useId, useState, useTransition } from "react";
import { ChevronDown, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { moveToAlumni } from "@/app/dashboard/team-actions";
import { LEAVE_REASONS, LEAVE_REASON_LABELS } from "@/lib/dashboard/team";
import { ConfirmDialog } from "./confirm-dialog";
import { inputClass } from "./field";

// Move to alumni's confirm (board 59d), which the row ⋯ menu's "Leaves the
// team" and the Leaving the team part of Edit details (./member-panels.tsx)
// both open. The whole team's separate member panel (board 46b) that lived
// here is gone: every Members page opens the one Edit details panel (issue
// #584).

/**
 * Board 59d, and "Leaves the team" on a division's Members page (#231): an
 * optional reason. The years on the team are read from stored data on the
 * server (Owner decision, 2026-11-12, issue #980). Every role and every
 * access grant ends; the account stays.
 */
export function AlumniDialog({
  open,
  onOpenChange,
  person,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: { readonly id: number; readonly name: string };
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const reasonId = useId();
  const firstName = person.name.split(" ")[0];

  const confirm = () => {
    startTransition(async () => {
      const result = await moveToAlumni(person.id, reason === "" ? null : reason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${person.name} moved to Alumni`);
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<GraduationCap className="h-5 w-5" strokeWidth={1.75} />}
      title={`${person.name} leaves the team?`}
      description={`${firstName} leaves every division and shows on the Alumni page with the years on the team. All their dashboard access ends. Their account stays.`}
      confirmLabel="Leaves the team"
      cancelLabel={`Keep ${firstName} on the team`}
      danger
      pending={pending}
      onConfirm={confirm}
    >
      <div className="relative mt-5 min-w-0">
        <label htmlFor={reasonId} className="mb-2 block text-[13px] text-prt-text">
          Reason <span className="ml-1 text-prt-muted">optional</span>
        </label>
        <select
          id={reasonId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={`${inputClass()} cursor-pointer appearance-none pr-10`}
        >
          <option value="" className="bg-panel">
            No reason
          </option>
          {LEAVE_REASONS.map((r) => (
            <option key={r} value={r} className="bg-panel">
              {LEAVE_REASON_LABELS[r]}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute bottom-3.5 right-3.5 h-4 w-4 text-prt-muted" strokeWidth={1.75} />
      </div>
    </ConfirmDialog>
  );
}
