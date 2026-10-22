"use client";

import { useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, Briefcase, KeyRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { closeDivision } from "@/app/dashboard/team-actions";
import type { DivisionMembers } from "@/lib/dashboard/division-members";
import { advisorsStayLine } from "@/lib/dashboard/hand-over";
import { SHEET_BUTTONS, SHEET_CANCEL, SHEET_CONTENT, SHEET_OVERLAY, SheetGrabber, sheetConfirm } from "./confirm-dialog";

// Close division (board 68c, #232), opened from Edit division's footer in the
// Team tree's edit view (#251). A division with anyone in it cannot close:
// the dialog says so and offers Edit division in place of the way out. An
// empty one asks "are you sure", since its open positions close, its division
// access goes, and a closed division never opens again (board 68e is
// dropped). An advisor does not keep it open: they stay in its department
// with the Advisor role, and the dialog says so (issue #441).

/** "9 people to move", "2 open positions will close", "Division access goes away". */
function Summary({ people, positions }: { people: number; positions: number }) {
  const lines = [
    ...(people > 0 ? [{ icon: Users, text: `${people} ${people === 1 ? "person" : "people"} to move` }] : []),
    {
      icon: Briefcase,
      text: positions === 0 ? "No open positions to close" : `${positions} open ${positions === 1 ? "position" : "positions"} will close`,
    },
    { icon: KeyRound, text: "Division access goes away" },
  ];
  return (
    <ul className="mt-5 flex flex-col gap-2 rounded-xl border border-hairline px-4 py-3 text-[13px] text-text-2">
      {lines.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-2.5">
          <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-prt-muted" strokeWidth={1.75} />
          {text}
        </li>
      ))}
    </ul>
  );
}

export function CloseDivisionDialog({
  tab,
  openPositions,
  onClose,
  onEdit,
}: {
  tab: DivisionMembers | null;
  openPositions: number;
  onClose: () => void;
  /** Edit division, where the people still in it are removed or moved. */
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [shownTab, setShown] = useState(tab);
  if (tab !== null && tab !== shownTab) setShown(tab);
  const name = shownTab?.division.name ?? "";
  // An advisor does not keep the division open: they stay in its department (issue #441).
  const advisors = shownTab?.people.filter((p) => p.advisor) ?? [];
  const people = (shownTab?.people.length ?? 0) - advisors.length + (shownTab?.waiting.length ?? 0);
  const blocked = people > 0;
  const department = shownTab?.division.department ?? "";

  const close = () =>
    startTransition(async () => {
      if (!shownTab) return;
      const result = await closeDivision(shownTab.division.id);
      if (!result.ok) {
        toast.error("Could not close the division", { description: result.error });
        return;
      }
      toast.success(`${name} is closed`);
      onClose();
    });

  return (
    <Dialog open={tab !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogPortal>
        <DialogOverlay className={SHEET_OVERLAY} />
        <DialogPrimitive.Content aria-describedby={undefined} className={`${SHEET_CONTENT} sm:w-[440px]`}>
          <SheetGrabber />
          <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full border border-danger/40 bg-danger-soft text-danger">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <DialogTitle className="mt-5 text-[20px] font-bold leading-snug">Close {name}?</DialogTitle>
          <p className="mt-2 text-[14px] leading-relaxed text-text-2">
            {blocked
              ? `${people} ${people === 1 ? "person is" : "people are"} still in this division. Remove them or add them to another division from Edit division first, then close it.`
              : advisors.length > 0
                ? `Only advisors are in this division. ${advisorsStayLine(
                    advisors.map((a) => a.name),
                    department,
                  )} Once closed, it cannot be reopened; its name stays in the team's history.`
                : "Nobody is in this division. Once closed, it cannot be reopened; its name stays in the team's history."}
          </p>
          <Summary people={people} positions={openPositions} />
          <div className={SHEET_BUTTONS}>
            {blocked ? (
              <button type="button" onClick={onEdit} className={SHEET_CANCEL}>
                Edit division
              </button>
            ) : (
              <DialogClose className={SHEET_CANCEL}>Cancel</DialogClose>
            )}
            <button type="button" onClick={close} disabled={blocked || pending} className={sheetConfirm(true)}>
              Close division
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
