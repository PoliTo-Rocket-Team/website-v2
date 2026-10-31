"use client";

import { useState, useTransition } from "react";
import { Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { TeamActionResult } from "@/app/dashboard/team-actions";
import type { TeamPick } from "@/lib/dashboard/division-edit";
import { holderAddRefusal } from "@/lib/dashboard/seat-holders";
import { andList, type StructurePerson } from "@/lib/dashboard/team-structure";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { PeoplePicker } from "./division-drawer";

// Add another holder (epic #861, issue #869) in the Team tree's seat panels:
// the team leader's, a team-level seat's and a department's head. One more
// person holds the seat beside the holders it has, with the seat's full
// rights, and nobody is replaced. Only the team leader and full access see
// it. The picker refuses only someone who holds this exact seat already
// (issue #837), with the reason the server gives (`holderAddRefusal`), and the
// server checks every rule again (lib/dashboard/seat-holders.ts).

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const ADD_LINK = `inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${FOCUS}`;
const LIST = "overflow-hidden rounded-xl border border-hairline";

/** The "Add another holder" link, set beside the panel's replace action. */
export function AddHolderLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={ADD_LINK}>
      <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      Add another holder
    </button>
  );
}

/**
 * Every holder of a seat, one row each, as the panels list them: their
 * photo, their name and a line under it (`line`). The viewer's own row reads
 * "You".
 */
export function HolderRows<P extends StructurePerson>({ holders, selfId = null, line }: { holders: readonly P[]; selfId?: number | null; line?: (holder: P) => string | null }) {
  return (
    <ul className={`${LIST} divide-y divide-hairline`}>
      {holders.map((holder) => {
        const under = line?.(holder) ?? null;
        return (
          <li key={holder.id} className="flex items-center gap-3 px-3.5 py-2.5">
            <Avatar size="md" accent person={holder} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] text-prt-text">{holder.name}</span>
              {under !== null && <span className="block truncate text-[12px] text-prt-muted">{under}</span>}
            </span>
            {holder.id === selfId && (
              <span className="inline-flex h-[18px] shrink-0 items-center rounded bg-white-10 px-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-prt-muted">You</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Add another holder, once the link is pressed: pick someone from the team,
 * then "are you sure". Back returns to the picker; the save closes the panel,
 * and the tree then names the new holder in the seat's box.
 */
export function AddHolderPicker({
  mode,
  seat,
  short,
  holders,
  save,
  onCancel,
  onSaved,
  name,
}: {
  mode: "leader" | "seat" | "head";
  /** The search field's form name, when the panel's form names a field it should focus (issue #927). */
  name?: string;
  /** The seat by name: "Team Leader", "Project Manager", "Head of Aerodynamics". */
  seat: string;
  /** What the picker's hint names: the seat, or the department a head heads. */
  short: string;
  holders: readonly StructurePerson[];
  save: (personId: number) => Promise<TeamActionResult>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pick, setPick] = useState<TeamPick | null>(null);
  const [pending, startTransition] = useTransition();
  const holderIds = holders.map((h) => h.id);
  const names = andList(holders.map((h) => h.name));

  const confirm = () =>
    startTransition(async () => {
      if (pick === null) return;
      const result = await save(pick.id);
      if (!result.ok) {
        toast.error("Could not add the holder", { description: result.error });
        return;
      }
      toast.success(`${pick.name} holds ${seat} now`);
      setPick(null);
      onSaved();
    });

  return (
    <>
      <PeoplePicker mode={mode} name={name} short={short} taken={(p) => holderAddRefusal(p, holderIds)} onPick={setPick} onClose={onCancel} />
      <ConfirmDialog
        open={pick !== null}
        onOpenChange={(open) => !open && setPick(null)}
        icon={<UserPlus className="h-5 w-5" strokeWidth={1.75} />}
        title={`Add ${pick?.name ?? "them"} to ${seat}?`}
        description={
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>
              {pick?.name ?? "They"} {holders.length > 0 ? `holds ${seat} beside ${names}, with the same rights.` : `holds ${seat}.`}
            </li>
            <li>Nobody is replaced. {pick?.name ?? "They"} keeps their roles and divisions.</li>
          </ul>
        }
        cancelLabel="Back"
        confirmLabel="Add holder"
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
