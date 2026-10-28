"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { changeStatusList } from "@/app/dashboard/recruitment-actions";
import {
  BUILT_IN_STATUSES,
  checkStatusName,
  colourName,
  deleteRefusal,
  STATUS_COLOURS,
  STATUS_NAME_MAX,
  type BuiltInStatusKey,
  type ListedStatus,
  type StatusColour,
} from "@/lib/dashboard/application-status";
import { SHEET_FRAME, SHEET_OVERLAY, SheetGrabber } from "./confirm-dialog";

// The Statuses editor (board 97d, issue #752), opened from "Manage statuses…"
// in the drawer's Status picker: every status of the list with how many
// applications use it, built-in ones locked (renamed and recoloured, never
// deleted), added ones under their parent, and a row that adds a status with
// a name, a colour and a parent. Each change is one server write
// (`changeStatusList`), which checks who may make it and whether a delete is
// allowed; the page's refresh brings back the list as it now stands. Which
// colours a status may take and the delete rule are
// lib/dashboard/application-status.ts's; a status's colour is data, so it is
// painted from the list, not from a token. A bottom sheet on a phone.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const ICON_BUTTON = `flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-prt-muted ${FOCUS}`;
const FIELD = `h-9 min-w-0 rounded-lg border border-hairline bg-transparent px-3 text-[13px] text-prt-text placeholder:text-dim transition-colors duration-300 ease-out hover:border-border-strong focus:border-border-strong focus:outline-none`;
const MENU =
  "z-50 rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0";

/** The colour new statuses start in (board 97d): one no built-in status ships with, so an added one stands apart. */
const NEW_STATUS_COLOUR: StatusColour = "#E5489A";

type Change =
  | { readonly kind: "add"; readonly name: string; readonly colour: StatusColour; readonly parent: BuiltInStatusKey }
  | { readonly kind: "edit"; readonly key: string; readonly was: { readonly name: string; readonly colour: string }; readonly name: string; readonly colour: string }
  | { readonly kind: "delete"; readonly key: string };

function usesLine(uses: number): string {
  return uses === 1 ? "1 application" : `${uses} applications`;
}

function Dot({ colour, size = "h-2.5 w-2.5" }: { colour: string; size?: string }) {
  return <span aria-hidden="true" className={`${size} shrink-0 rounded-full`} style={{ backgroundColor: colour }} />;
}

export function StatusesEditor({
  open,
  onOpenChange,
  statuses,
  uses,
  defaultParent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: readonly ListedStatus[];
  /** How many applications use each status, by key (`ApplicationsPage.statusUses`). */
  uses: Readonly<Record<string, number>>;
  /** The parent the add row starts under: the built-in status the open application behaves like. */
  defaultParent: BuiltInStatusKey;
}) {
  const [pending, startTransition] = useTransition();
  const save = (change: Change, done?: () => void) =>
    startTransition(async () => {
      const result = await changeStatusList(change);
      if (!result.ok) toast.error(result.error);
      else done?.();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={SHEET_OVERLAY} />
        <DialogPrimitive.Content className={`${SHEET_FRAME} flex flex-col sm:w-[520px] sm:px-6 sm:pb-5 sm:pt-6`}>
          <SheetGrabber />
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-[20px] font-bold leading-snug">Statuses</DialogTitle>
            <DialogClose aria-label="Close" className={`-mr-1.5 -mt-0.5 ${ICON_BUTTON} h-8 w-8`}>
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </DialogClose>
          </div>
          <DialogPrimitive.Description className="mt-1.5 text-[13px] leading-relaxed text-prt-muted">
            Built-in statuses can be renamed and recoloured. Added statuses sit under a built-in one and act like it: same buttons, same view for the applicant.
          </DialogPrimitive.Description>

          {/* Mounted only while open, so each opening starts from the list as it is saved. */}
          {open && (
            <>
              <ul className="-mx-1 mt-4 min-h-0 flex-1 overflow-y-auto px-1">
                {statuses.map((listed) => (
                  <StatusRow key={`${listed.status.kind}:${listed.status.key}`} listed={listed} uses={uses[listed.status.key] ?? 0} pending={pending} onSave={save} />
                ))}
              </ul>
              <AddRow statuses={statuses} defaultParent={defaultParent} pending={pending} onSave={save} />
            </>
          )}

          <div className="-mx-5 mt-5 flex items-center gap-4 border-t border-hairline px-5 pt-4 sm:-mx-6 sm:px-6">
            <p className="min-w-0 flex-1 text-[12px] leading-snug text-prt-muted">Built-in statuses can&apos;t be deleted. An added one can, while no application uses it.</p>
            <DialogClose
              className={`inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-prt-text px-5 text-[14px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 ${FOCUS}`}
            >
              Done
            </DialogClose>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/** One status: its colour, its name (or the rename field), how many applications use it, rename, and lock or delete. */
function StatusRow({ listed, uses, pending, onSave }: { listed: ListedStatus; uses: number; pending: boolean; onSave: (change: Change, done?: () => void) => void }) {
  const { status, name, colour } = listed;
  const [renaming, setRenaming] = useState<string | null>(null);
  const added = status.kind === "added";
  const refusal = deleteRefusal(status, uses);
  const rename = () => {
    if (renaming === null) return;
    const checked = checkStatusName(renaming);
    if (!checked.ok) return toast.error(checked.error);
    if (checked.value === name) return setRenaming(null);
    onSave({ kind: "edit", key: status.key, was: { name, colour }, name: checked.value, colour }, () => setRenaming(null));
  };
  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      rename();
    } else if (event.key === "Escape") {
      // Escape leaves the rename, not the editor.
      event.stopPropagation();
      setRenaming(null);
    }
  };

  return (
    <li className={`flex h-9 items-center gap-3 ${added ? "pl-[26px]" : ""}`}>
      <ColourMenu
        label={`Colour of ${name}: ${colourName(colour)}`}
        colour={colour}
        disabled={pending}
        onPick={(picked) => picked !== colour && onSave({ kind: "edit", key: status.key, was: { name, colour }, name, colour: picked })}
      />
      {renaming === null ? (
        <span className="min-w-0 flex-1 truncate text-[13px]">{name}</span>
      ) : (
        <input
          autoFocus
          aria-label={`New name for ${name}`}
          value={renaming}
          maxLength={STATUS_NAME_MAX}
          onChange={(e) => setRenaming(e.target.value)}
          onKeyDown={keys}
          className={`${FIELD} h-8 flex-1`}
        />
      )}
      <span className="shrink-0 font-mono text-[10px] tracking-[0.05em] text-dim">{usesLine(uses)}</span>
      {renaming === null ? (
        <button type="button" aria-label={`Rename ${name}`} disabled={pending} onClick={() => setRenaming(name)} className={ICON_BUTTON}>
          <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      ) : (
        <button type="button" aria-label={`Save the name of ${name}`} disabled={pending} onClick={rename} className={ICON_BUTTON}>
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      )}
      {added ? (
        <button
          type="button"
          aria-label={refusal === null ? `Delete ${name}` : `Delete ${name}: ${refusal}`}
          title={refusal ?? undefined}
          disabled={pending || refusal !== null}
          onClick={() => onSave({ kind: "delete", key: status.key })}
          className={`${ICON_BUTTON} hover:text-danger`}
        >
          <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      ) : (
        <span role="img" aria-label="Built-in: can't be deleted" title="Built-in statuses can't be deleted" className="flex h-7 w-7 shrink-0 items-center justify-center text-dim">
          <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
      )}
    </li>
  );
}

/** The add row (board 97d): a colour, a name and the built-in parent the new status sits under. */
function AddRow({
  statuses,
  defaultParent,
  pending,
  onSave,
}: {
  statuses: readonly ListedStatus[];
  defaultParent: BuiltInStatusKey;
  pending: boolean;
  onSave: (change: Change, done?: () => void) => void;
}) {
  const [name, setName] = useState("");
  const [colour, setColour] = useState<StatusColour>(NEW_STATUS_COLOUR);
  const [parent, setParent] = useState<BuiltInStatusKey>(defaultParent);
  const parents = statuses.filter((s) => s.status.kind === "built-in");
  const parentName = parents.find((s) => s.status.key === parent)?.name ?? BUILT_IN_STATUSES.find((s) => s.key === parent)!.name;
  const add = () => {
    const checked = checkStatusName(name);
    if (!checked.ok) return toast.error(checked.error);
    onSave({ kind: "add", name: checked.value, colour, parent }, () => setName(""));
  };

  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2 sm:flex-nowrap"
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
    >
      <ColourMenu label={`Colour of the new status: ${colourName(colour)}`} colour={colour} disabled={pending} onPick={setColour} large />
      <input
        aria-label="New status name"
        placeholder="New status name"
        value={name}
        maxLength={STATUS_NAME_MAX}
        onChange={(e) => setName(e.target.value)}
        className={`${FIELD} min-w-[140px] flex-1`}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Under ${parentName}`}
          className={`flex h-9 min-w-0 max-w-[180px] items-center gap-1.5 rounded-lg border border-hairline px-3 text-[13px] transition-colors duration-300 ease-out hover:border-border-strong data-[state=open]:border-border-strong ${FOCUS}`}
        >
          <span className="shrink-0 text-dim">Under</span>
          <span className="truncate">{parentName}</span>
          <ChevronDown aria-hidden className="ml-auto h-3.5 w-3.5 shrink-0 text-prt-muted" strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuPrimitive.Content align="end" sideOffset={6} className={`${MENU} max-h-[min(360px,var(--radix-dropdown-menu-content-available-height))] min-w-[240px] overflow-y-auto`}>
            <DropdownMenuPrimitive.Label className="px-2.5 pb-1.5 pt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-dim">Sits under</DropdownMenuPrimitive.Label>
            <DropdownMenuPrimitive.RadioGroup value={parent} onValueChange={(value) => setParent(value as BuiltInStatusKey)}>
              {parents.map((s) => (
                <DropdownMenuPrimitive.RadioItem
                  key={s.status.key}
                  value={s.status.key}
                  className="flex h-[30px] cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-text-2 outline-none transition-colors data-[highlighted]:bg-white-5 data-[state=checked]:bg-white-5 data-[highlighted]:text-prt-text data-[state=checked]:text-prt-text"
                >
                  <Dot colour={s.colour} size="h-2 w-2" />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <DropdownMenuPrimitive.ItemIndicator>
                    <Check aria-hidden className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                  </DropdownMenuPrimitive.ItemIndicator>
                </DropdownMenuPrimitive.RadioItem>
              ))}
            </DropdownMenuPrimitive.RadioGroup>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPortal>
      </DropdownMenu>
      <button
        type="submit"
        disabled={pending || name.trim() === ""}
        className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white-10 px-4 text-[13px] font-semibold transition-colors duration-300 ease-out hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white-10 ${FOCUS}`}
      >
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Add status
      </button>
    </form>
  );
}

/** A status's colour as a ring with its dot; it opens the colours a status may take (`STATUS_COLOURS`). */
function ColourMenu({
  label,
  colour,
  disabled,
  large = false,
  onPick,
}: {
  label: string;
  colour: string;
  disabled: boolean;
  large?: boolean;
  onPick: (colour: StatusColour) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        disabled={disabled}
        className={`flex shrink-0 items-center justify-center rounded-full border border-hairline transition-colors duration-300 ease-out hover:border-border-strong data-[state=open]:border-border-strong disabled:cursor-not-allowed ${
          large ? "h-9 w-9" : "h-6 w-6"
        } ${FOCUS}`}
      >
        <Dot colour={colour} size={large ? "h-3 w-3" : "h-2.5 w-2.5"} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content align="start" sideOffset={6} className={MENU}>
          <DropdownMenuPrimitive.RadioGroup value={colour} onValueChange={(value) => onPick(value as StatusColour)} className="grid grid-cols-5 gap-1">
            {STATUS_COLOURS.map((c) => (
              <DropdownMenuPrimitive.RadioItem
                key={c.colour}
                value={c.colour}
                aria-label={c.name}
                title={c.name}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg outline-none transition-colors data-[highlighted]:bg-white-10 data-[state=checked]:bg-white-5"
              >
                <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: c.colour }}>
                  <DropdownMenuPrimitive.ItemIndicator>
                    <Check className="h-3 w-3 text-ground" strokeWidth={3} />
                  </DropdownMenuPrimitive.ItemIndicator>
                </span>
              </DropdownMenuPrimitive.RadioItem>
            ))}
          </DropdownMenuPrimitive.RadioGroup>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
