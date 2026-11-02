"use client";

import type { ReactNode } from "react";
import { ArrowRightLeft, Crown, GraduationCap, Pencil, Type, UserMinus } from "lucide-react";
import type { MemberPosition } from "@/lib/dashboard/division-members";
import { advisorDivisions, type MemberAction, type MenuEntry } from "@/lib/dashboard/member-actions";
import { MenuItem, RowMenu, type Asking, type AskedPerson } from "./division-members";
import type { AdvisorAsking } from "./member-action-dialogs";

// A member's ⋯ menu, on the Team tree's drawers and the Members page alike
// (issue #901): it lists the entries `divisionRowMenu` or `membersRowMenu`
// built (lib/dashboard/member-actions.ts), each open or locked with its
// reason, and opens the "are you sure" each one has (`MemberDialogs`). Edit
// details and Move to… open their own panels, which the place passes in.

const ICON = "h-3.5 w-3.5";

const ICONS: Readonly<Record<MemberAction, ReactNode>> = {
  "change-title": <Type className={ICON} strokeWidth={1.75} />,
  "make-lead": <Crown className={ICON} strokeWidth={1.75} />,
  "become-advisor": <GraduationCap className={ICON} strokeWidth={1.75} />,
  "edit-details": <Pencil className={ICON} strokeWidth={1.75} />,
  move: <ArrowRightLeft className={ICON} strokeWidth={1.75} />,
  remove: <UserMinus className={ICON} strokeWidth={1.75} />,
  leave: null,
};

/**
 * Becomes an advisor's "are you sure", from the division `divisionId` or,
 * with none, from any division that offers it (`advisorDivisions`); null when
 * none does.
 */
export function advisorAsking(person: AskedPerson, position: MemberPosition, divisionId: number | null): AdvisorAsking | null {
  const [first, ...rest] = advisorDivisions(position).filter((r) => divisionId === null || r.divisionId === divisionId);
  return first === undefined ? null : { kind: "advisor", person, roles: [first, ...rest] };
}

function labelOf(entry: MenuEntry): string {
  switch (entry.action) {
    case "change-title":
      return "Change title";
    case "make-lead":
      return "Make lead";
    case "become-advisor":
      return "Becomes an advisor";
    case "edit-details":
      return "Edit details";
    case "move":
      return "Move to…";
    case "remove":
      return `Remove from ${entry.division?.short ?? "the division"}`;
    case "leave":
      return "Leaves the team";
  }
}

export function MemberMenu({
  person,
  position,
  entries,
  onAsk,
  onEdit,
  onMove,
}: {
  person: AskedPerson;
  position: MemberPosition;
  entries: readonly MenuEntry[];
  onAsk: (asking: Asking) => void;
  /** Edit details: the page's panel, where the place offers it. */
  onEdit?: () => void;
  /** Move to…: the row's move dialog, where the place offers it. */
  onMove?: () => void;
}) {
  const select = (entry: MenuEntry) => {
    const division = entry.division;
    switch (entry.action) {
      case "change-title":
        if (division !== null) {
          const title = person.divisions.find((d) => d.divisionId === division.divisionId)?.title ?? null;
          onAsk({ kind: "title", person, divisionId: division.divisionId, short: division.short, title });
        }
        return;
      case "make-lead":
        if (division !== null) onAsk({ kind: "lead", person, divisionId: division.divisionId, short: division.short });
        return;
      case "become-advisor": {
        const asking = advisorAsking(person, position, division?.divisionId ?? null);
        if (asking !== null) onAsk(asking);
        return;
      }
      case "edit-details":
        onEdit?.();
        return;
      case "move":
        onMove?.();
        return;
      case "remove":
        if (division !== null) onAsk({ kind: "remove", person, divisionId: division.divisionId, short: division.short });
        return;
      case "leave":
        onAsk({ kind: "leave", person });
        return;
    }
  };
  const shown = entries.filter((e) => (e.action === "edit-details" ? onEdit !== undefined : e.action === "move" ? onMove !== undefined : true));
  return (
    <RowMenu label={`Actions for ${person.name}`}>
      {shown.map((entry) => {
        const others = entry.action === "remove" ? person.divisions.filter((d) => d.divisionId !== entry.division?.divisionId).map((d) => d.name) : [];
        return (
          <MenuItem
            key={`${entry.action}-${entry.division?.divisionId ?? ""}`}
            onSelect={() => select(entry)}
            icon={ICONS[entry.action]}
            danger={entry.action === "leave"}
            locked={entry.permission.allowed ? null : entry.permission.reason}
            detail={others.length > 0 ? `Stays in ${others.join(", ")}` : null}
          >
            {labelOf(entry)}
          </MenuItem>
        );
      })}
    </RowMenu>
  );
}
