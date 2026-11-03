"use client";

import type { ReactNode } from "react";
import { ArrowRightLeft, Pencil, UserMinus } from "lucide-react";
import type { MemberAction, MenuEntry } from "@/lib/dashboard/member-actions";
import { MenuItem, RowMenu, type Asking, type AskedPerson } from "./division-members";

// A member's ⋯ menu, on the Team tree's drawers and the Members page alike
// (issues #901, #972): it lists the entries `divisionRowMenu` or `membersRowMenu`
// built (lib/dashboard/member-actions.ts), each open or locked with its
// reason, and opens the "are you sure" each one has (`MemberDialogs`). Edit
// details and Move to… open their own panels, which the place passes in.

const ICON = "h-3.5 w-3.5";

const ICONS: Readonly<Record<MemberAction, ReactNode>> = {
  "edit-details": <Pencil className={ICON} strokeWidth={1.75} />,
  move: <ArrowRightLeft className={ICON} strokeWidth={1.75} />,
  remove: <UserMinus className={ICON} strokeWidth={1.75} />,
  leave: null,
};

function labelOf(entry: MenuEntry): string {
  switch (entry.action) {
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
  entries,
  onAsk,
  onEdit,
  onMove,
}: {
  person: AskedPerson;
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
