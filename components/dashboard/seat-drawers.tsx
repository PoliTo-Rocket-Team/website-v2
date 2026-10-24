"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Armchair, Plus, Repeat, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { addSeat, changeSeatHolder, removeSeat } from "@/app/dashboard/team-actions";
import type { TeamPick } from "@/lib/dashboard/division-edit";
import { fullAccessMovesLine, steppingDown, steppingDownLine, type HandOverOutcome } from "@/lib/dashboard/hand-over";
import { seatRemovalLines, seatTitleError, storedSeatTitle } from "@/lib/dashboard/team-seats";
import type { StructureSeat, TeamStructure } from "@/lib/dashboard/team-structure";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { PeoplePicker } from "./division-drawer";
import { PANEL_DANGER_BUTTON, PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON, PanelBody, SidePanel } from "./drawer";
import { inputClass } from "./field";
import { HandOverChoice } from "./hand-over-choice";

// The seat row's panels on Edit team tree (issue #627): Change holder, opened
// from a seat box, with Remove seat in its footer (issue #643), and Add seat,
// opened from the box at the end of the row.
// They are built like Change head in Edit department (board 77e). Only the
// team leader and full access open them; each save asks "are you sure" first,
// and the server checks every rule again (lib/dashboard/team-seats.ts). A seat
// box changes who holds the seat; its title is changed on Members.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const ADD_LINK = `inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${FOCUS}`;
const LIST = "overflow-hidden rounded-xl border border-hairline";
const SECTION_LABEL = "text-[13px] text-prt-text";
const UNDO = `inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[13px] text-text-2 transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`;

/** Which seat panel is open: Change holder on a seat, or Add seat. */
export type SeatDrawerTarget = { readonly kind: "change"; readonly roleId: number } | { readonly kind: "new" };

const SEAT_STEP = { kind: "team-seat" } as const;

export function SeatDrawer({ target, structure, onClose }: { target: SeatDrawerTarget | null; structure: TeamStructure; onClose: () => void }) {
  // The last target stays while the panel closes, so its content does not vanish mid-close.
  const [shown, setShown] = useState(target);
  if (target !== null && target !== shown) setShown(target);
  if (shown === null) return null;
  const open = target !== null;
  if (shown.kind === "new") return <NewSeatPanel key="new" open={open} onClose={onClose} />;
  const seat = structure.board.find((s) => s.roleId === shown.roleId);
  if (!seat) return null;
  return <ChangeHolder key={`s${seat.roleId}`} open={open} seat={seat} onClose={onClose} />;
}

/** The person picked to hold a seat, with Undo. */
function PickedHolder({ pick, isNew, onUndo }: { pick: TeamPick; isNew: boolean; onUndo: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-accent/[0.05] px-3.5 py-2.5">
      <Avatar size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] text-prt-text">{pick.name}</span>
          {isNew && <span className="inline-flex h-[18px] shrink-0 items-center rounded bg-accent-soft px-1.5 text-[11px] font-medium text-accent">New</span>}
        </span>
        <span className="block truncate text-[12px] text-prt-muted">{pick.place === null ? "In no division yet" : `Keeps ${pick.place}`}</span>
      </span>
      <button type="button" onClick={onUndo} aria-label={`Undo picking ${pick.name}`} className={UNDO}>
        <Undo2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Undo
      </button>
    </div>
  );
}

/**
 * Change holder: who holds the seat now, Change holder to pick who takes it
 * from the team, and "What happens to {name}?". The successor's role keeps
 * the seat's title and its full access, if any.
 */
function ChangeHolder({ open, seat, onClose }: { open: boolean; seat: StructureSeat; onClose: () => void }) {
  const [next, setNext] = useState<TeamPick | null>(null);
  const [picking, setPicking] = useState(false);
  const [outcome, setOutcome] = useState<HandOverOutcome | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [pending, startTransition] = useTransition();
  const { holder } = seat;

  const remove = () =>
    startTransition(async () => {
      const result = await removeSeat(seat.roleId);
      if (!result.ok) {
        toast.error("Could not remove the seat", { description: result.error });
        return;
      }
      toast.success(`${seat.title} is removed`);
      setRemoving(false);
      onClose();
    });

  const error = next === null ? "Pick who takes the seat." : outcome === null ? `Choose what happens to ${holder.name}: Become an advisor or Leave the team.` : null;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowErrors(true);
    if (error === null) setConfirming(true);
  };

  const undo = () => {
    setNext(null);
    setOutcome(null);
  };

  const confirm = () =>
    startTransition(async () => {
      if (next === null) return;
      const result = await changeSeatHolder(seat.roleId, { to: next.id, outcome });
      if (!result.ok) {
        toast.error("Could not change who holds the seat", { description: result.error });
        return;
      }
      toast.success(`${next.name} holds ${seat.title}`);
      setConfirming(false);
      onClose();
    });

  const step = outcome === null ? null : steppingDown(SEAT_STEP, outcome);
  const lines: string[] = [];
  if (next !== null) lines.push(`${next.name} holds ${seat.title} and keeps their divisions.`);
  if (next !== null && step !== null) {
    lines.push(`${holder.name} ${steppingDownLine(step, null)}.`);
    const access = fullAccessMovesLine({ seat: seat.flag, successor: next.name, from: holder.name, step });
    if (access !== null) lines.push(access);
  }
  const leaving = outcome === "leave";

  return (
    <SidePanel
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title={seat.title}
      detail={`Held by ${holder.name}`}
      footer={
        <>
          <button type="button" onClick={() => setRemoving(true)} disabled={pending} className={PANEL_DANGER_BUTTON}>
            Remove seat
          </button>
          <button type="submit" form={`seat-${seat.roleId}-form`} disabled={pending} className={PANEL_PRIMARY_BUTTON}>
            Save changes
          </button>
        </>
      }
    >
      <form id={`seat-${seat.roleId}-form`} noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <PanelBody>
          <section>
            <h3 className={SECTION_LABEL}>Holder</h3>
            {next === null ? (
              <div className={`${LIST} mt-2.5 flex items-center gap-3 px-3.5 py-3`}>
                <Avatar size="md" accent />
                <span className="min-w-0 flex-1 truncate text-[15px] text-prt-text">{holder.name}</span>
              </div>
            ) : (
              <ul className={`${LIST} mt-2.5 divide-y divide-hairline`}>
                <li className="flex items-center gap-3 px-3.5 py-2.5 opacity-60">
                  <Avatar size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-prt-text">{holder.name}</span>
                    <span className="block truncate text-[12px] text-prt-muted">Replaced by {next.name}</span>
                  </span>
                </li>
                <li>
                  <PickedHolder pick={next} isNew onUndo={undo} />
                </li>
              </ul>
            )}
            {picking ? (
              <PeoplePicker
                mode="seat"
                short={seat.title}
                taken={(p) => (p.id === holder.id ? "Holds it now" : p.seated ? `Already ${p.role}` : null)}
                onPick={(p) => {
                  setNext(p);
                  setPicking(false);
                }}
                onClose={() => setPicking(false)}
              />
            ) : (
              next === null && (
                <button type="button" onClick={() => setPicking(true)} className={`${ADD_LINK} mt-3`}>
                  <Repeat aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Change holder
                </button>
              )
            )}
            {next !== null && (
              <div className="mt-5">
                <HandOverChoice
                  name={`seat-${seat.roleId}`}
                  person={holder.name}
                  handed={SEAT_STEP}
                  unit="the team"
                  value={outcome}
                  leave={{ allowed: true }}
                  seat={seat.flag}
                  successor={next.name}
                  onChange={setOutcome}
                />
              </div>
            )}
            {showErrors && error !== null && <p className="mt-2 text-[12px] text-danger">{error}</p>}
            <p className="mt-6 text-[12px] leading-relaxed text-prt-muted">The seat keeps its title. Change the title on Members, in Edit details.</p>
          </section>
        </PanelBody>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        icon={<Repeat className="h-5 w-5" strokeWidth={1.75} />}
        tone={leaving ? "danger" : "accent"}
        danger={leaving}
        title={`Change who holds ${seat.title}?`}
        description={
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        }
        cancelLabel="Back"
        confirmLabel="Save changes"
        pending={pending}
        onConfirm={confirm}
      />
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        icon={<Armchair className="h-5 w-5" strokeWidth={1.75} />}
        danger
        title={`Remove ${seat.title}?`}
        description={
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {seatRemovalLines(seat, holder.name).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        }
        cancelLabel="Back"
        confirmLabel="Remove seat"
        pending={pending}
        onConfirm={remove}
      />
    </SidePanel>
  );
}

/** Add seat: the seat's title and who holds it, picked from the team. A new seat gives no full access. */
function NewSeatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [holder, setHolder] = useState<TeamPick | null>(null);
  const [picking, setPicking] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const titleError = seatTitleError(title);
  const holderError = holder === null ? "Pick who holds the seat." : null;
  const valid = titleError === null && holderError === null;
  const stored = storedSeatTitle(title);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowErrors(true);
    if (valid) setConfirming(true);
  };

  const confirm = () =>
    startTransition(async () => {
      if (holder === null) return;
      const result = await addSeat({ personId: holder.id, title });
      if (!result.ok) {
        toast.error("Could not add the seat", { description: result.error });
        return;
      }
      toast.success(`${stored} is added`);
      setConfirming(false);
      onClose();
    });

  return (
    <SidePanel
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title="Add seat"
      detail="Under the team leader"
      footer={
        <>
          <button type="button" onClick={onClose} className={PANEL_GHOST_BUTTON}>
            Cancel
          </button>
          <button type="submit" form="new-seat-form" disabled={pending || !valid} className={`${PANEL_PRIMARY_BUTTON} disabled:cursor-not-allowed disabled:opacity-50`}>
            Add seat
          </button>
        </>
      }
    >
      <form id="new-seat-form" noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <PanelBody>
          <label className="block">
            <span className={`mb-2 block ${SECTION_LABEL}`}>Title</span>
            <input
              value={title}
              maxLength={80}
              autoComplete="off"
              placeholder="e.g. Safety Officer"
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={showErrors && titleError !== null}
              className={inputClass(showErrors && titleError !== null ? titleError : undefined)}
            />
          </label>
          {showErrors && titleError !== null && <p className="mt-1.5 text-[12px] text-danger">{titleError}</p>}
          <section className="mt-6">
            <h3 className={SECTION_LABEL}>
              Holder
              <span className="ml-1.5 text-prt-muted">1 person</span>
            </h3>
            <div className="mt-2.5">
              {holder === null ? (
                <p className={`${LIST} px-4 py-3 text-center text-[13px] text-prt-muted`}>No one yet</p>
              ) : (
                <div className={LIST}>
                  <PickedHolder pick={holder} isNew={false} onUndo={() => setHolder(null)} />
                </div>
              )}
            </div>
            {picking ? (
              <PeoplePicker
                mode="seat"
                short={stored === "" ? "the new seat" : stored}
                taken={(p) => (p.seated ? `Already ${p.role}` : null)}
                onPick={(p) => {
                  setHolder(p);
                  setPicking(false);
                }}
                onClose={() => setPicking(false)}
              />
            ) : (
              holder === null && (
                <button type="button" onClick={() => setPicking(true)} className={`${ADD_LINK} mt-3`}>
                  <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Pick holder
                </button>
              )
            )}
            {showErrors && holderError !== null && <p className="mt-2 text-[12px] text-danger">{holderError}</p>}
            <p className="mt-6 text-[12px] leading-relaxed text-prt-muted">The holder keeps their divisions. A new seat gives no full access of its own.</p>
          </section>
        </PanelBody>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        icon={<Armchair className="h-5 w-5" strokeWidth={1.75} />}
        title={`Add ${stored}?`}
        description={`${holder?.name ?? "The holder"} holds the new seat under the team leader and keeps their divisions. It gives no full access.`}
        cancelLabel="Back"
        confirmLabel="Add seat"
        pending={pending}
        onConfirm={confirm}
      />
    </SidePanel>
  );
}
