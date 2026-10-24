"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Lock, Pencil, RefreshCw, Search, Undo2, UserMinus, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { addMember, createDivision, findPeople, saveDivision } from "@/app/dashboard/team-actions";
import {
  divisionCodeError,
  divisionNameError,
  normalizeDivisionCode,
  storedDivisionName,
  type DivisionSave,
  type OldLead,
  type RemovedLeadOutcome,
  type TeamPick,
  type TeamSearch,
} from "@/lib/dashboard/division-edit";
import { matchesPerson, type DivisionMembers, type DivisionPerson, type WaitingPerson } from "@/lib/dashboard/division-members";
import { fullAccessMovesLine, seatOfHandedRole, steppingDown, steppingDownLine, type HandOverOutcome, type HeldSeat } from "@/lib/dashboard/hand-over";
import { divisionLabel, type Permission } from "@/lib/dashboard/team";
import type { FullAccessSeat } from "@/lib/dashboard/viewer";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { ConfirmNdaButton, MailAvatar, MemberDialogs, MenuItem, NoEmailNote, RowMenu, WaitingLine, matchesWaiting, type Asking } from "./division-members";
import { PANEL_DANGER_BUTTON, PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON, PanelBody, SidePanel } from "./drawer";
import { Field, inputClass } from "./field";
import { HandOverChoice } from "./hand-over-choice";
import { PersonCombobox } from "./person-combobox";

// New division (boards 77c, 69d) and Edit division (77g, 68b to 68b8): name
// and code, the leads, and the members, in one drawer, opened from the Team
// tree's edit view (#251). Edit division's footer holds Close division (68c).
//
// Name, code and leads are a draft until "Save changes", which asks "are you
// sure" first; the server checks every rule again (lib/dashboard/division-
// edit.ts). An open division's members are changed one by one, as on the
// Members page: Add member, Confirm NDA, Remove and Leaves the team act at
// once, each behind its own confirm. New division gathers its members in the
// draft, since the division is not open yet.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const ADD_LINK = `inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${FOCUS}`;
const LIST = "overflow-hidden rounded-xl border border-hairline";
const SECTION_LABEL = "text-[13px] text-prt-text";
const MEMBERS_SHOWN = 5;

/** What the drawer is about: a new division in a department, or an open division. */
export type DivisionDrawerTarget =
  | { readonly kind: "new"; readonly department: { readonly id: number; readonly name: string } }
  | { readonly kind: "edit"; readonly tab: DivisionMembers };

type TakenCode = { readonly id: number; readonly name: string; readonly code: string | null };

/** A lead picked in the draft, and the lead they replace, if any (board 68b3). */
type NewLead = { readonly pick: TeamPick; readonly replaces: number | null };

/** The drawer's draft: what "Save changes" sends. */
type Draft = {
  readonly name: string;
  readonly code: string;
  readonly added: readonly NewLead[];
  /** Leads removed with Remove, not replaced. */
  readonly removed: readonly number[];
  /** What happens to each lead removed with Remove; "member" when not chosen (Owner decision, 2026-10-11). */
  readonly outcomes: Readonly<Record<number, RemovedLeadOutcome>>;
  /** What each replaced lead does next (issue #253, board 68b4): nothing is picked for them. */
  readonly handOvers: Readonly<Record<number, HandOverOutcome>>;
  /** New division only: people from the team, and emails new to it. */
  readonly members: readonly TeamPick[];
  readonly emails: readonly string[];
};

function draftOf(target: DivisionDrawerTarget): Draft {
  const division = target.kind === "edit" ? target.tab.division : null;
  return {
    name: division ? divisionLabel(division.name) : "",
    code: division?.code ?? "",
    added: [],
    removed: [],
    outcomes: {},
    handOvers: {},
    members: [],
    emails: [],
  };
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

export function DivisionDrawer({
  target,
  takenCodes,
  seats,
  editable,
  onClose,
  onFill,
  onCloseDivision,
}: {
  target: DivisionDrawerTarget | null;
  takenCodes: readonly TakenCode[];
  /** The full-access seats on the team's roles: replacing a lead whose role carries one says it moves (issue #501). */
  seats: readonly HeldSeat[];
  editable: boolean;
  onClose: () => void;
  /** Fill details on someone waiting for their NDA: the page's Edit details drawer. */
  onFill: (waiting: WaitingPerson, division: DivisionMembers) => void;
  /** Close division in Edit division's footer (boards 77g, 68b): the page's Close division dialog. */
  onCloseDivision: (division: DivisionMembers) => void;
}) {
  // The last target stays while the panel closes, so its content does not vanish mid-close.
  const [shown, setShown] = useState(target);
  if (target !== null && target !== shown) setShown(target);
  const key = shown === null ? "none" : shown.kind === "edit" ? `e${shown.tab.division.id}` : `n${shown.department.id}`;
  if (shown === null) return null;
  return (
    <DrawerForm
      key={key}
      open={target !== null}
      target={shown}
      takenCodes={takenCodes}
      seats={seats}
      editable={editable}
      onClose={onClose}
      onFill={onFill}
      onCloseDivision={onCloseDivision}
    />
  );
}

function DrawerForm({
  open,
  target,
  takenCodes,
  seats,
  editable,
  onClose,
  onFill,
  onCloseDivision,
}: {
  open: boolean;
  target: DivisionDrawerTarget;
  takenCodes: readonly TakenCode[];
  seats: readonly HeldSeat[];
  editable: boolean;
  onClose: () => void;
  onFill: (waiting: WaitingPerson, division: DivisionMembers) => void;
  onCloseDivision: (division: DivisionMembers) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(target));
  const [picking, setPicking] = useState<{ readonly replaces: number | null } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [pending, startTransition] = useTransition();

  const tab = target.kind === "edit" ? target.tab : null;
  const divisionId = target.kind === "edit" ? target.tab.division.id : null;
  // Only a division being created is new; one being edited already exists (issue #249).
  const unnamed = target.kind === "new" ? "the new division" : "this division";
  const short = draft.name.trim() === "" ? unnamed : divisionLabel(draft.name.trim());
  const leads = tab?.people.filter((p) => p.role === "lead") ?? [];
  const replacedBy = (leadId: number) => draft.added.find((a) => a.replaces === leadId) ?? null;
  // The full-access seat a lead's role carries moves to whoever replaces them (issue #501).
  const seatOfLead = (leadId: number) => (divisionId === null ? null : seatOfHandedRole(seats, leadId, { kind: "lead", divisionId }));
  const gone = leads.filter((l) => draft.removed.includes(l.id) || replacedBy(l.id) !== null);
  const leadCount = leads.length - gone.length + draft.added.length;

  const code = normalizeDivisionCode(draft.code);
  const nameError = divisionNameError(draft.name);
  const codeError = draft.code.trim() === "" ? "Write a code." : divisionCodeError(code, takenCodes, target.kind === "edit" ? target.tab.division.id : null);
  const leadError = leadCount < 1 ? "A division needs at least one lead." : null;
  const undecided = gone.find((l) => replacedBy(l.id) !== null && draft.handOvers[l.id] === undefined);
  const handOverError = undecided ? `Choose what happens to ${undecided.name}: Become an advisor or Leave the team.` : null;
  const valid = nameError === null && codeError === null && leadError === null && handOverError === null;

  const original = draftOf(target);
  const nameChanged = target.kind === "edit" && storedDivisionName(draft.name) !== storedDivisionName(original.name);
  const codeChanged = target.kind === "edit" && code !== normalizeDivisionCode(original.code);
  const changes = Number(nameChanged) + Number(codeChanged) + draft.added.length + draft.removed.length;

  const save: DivisionSave = {
    name: draft.name,
    code,
    newLeads: draft.added.map((a) => a.pick.id),
    oldLeads: gone.flatMap((l): OldLead[] => {
      if (replacedBy(l.id) === null) return [{ personId: l.id, via: "removed", outcome: draft.outcomes[l.id] ?? "member" }];
      const outcome = draft.handOvers[l.id];
      return outcome === undefined ? [] : [{ personId: l.id, via: "replaced", outcome }];
    }),
    members: draft.members.map((m) => m.id),
    emails: draft.emails,
  };

  const set = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }));
  const pickLead = (pick: TeamPick) => {
    const replaces = picking?.replaces ?? null;
    setDraft((d) => ({ ...d, added: [...d.added, { pick, replaces }] }));
    // Replace picks one; Add lead keeps the field for the next lead.
    if (replaces !== null) setPicking(null);
  };
  const undoLead = (personId: number) => set({ added: draft.added.filter((a) => a.pick.id !== personId) });
  const setReplaces = (personId: number, replaces: number | null) =>
    set({ added: draft.added.map((a) => (a.pick.id === personId ? { ...a, replaces } : a.replaces === replaces && replaces !== null ? { ...a, replaces: null } : a)) });
  const removeLead = (leadId: number) => set({ removed: [...draft.removed, leadId] });
  const undoRemove = (leadId: number) =>
    set({ removed: draft.removed.filter((id) => id !== leadId), added: draft.added.map((a) => (a.replaces === leadId ? { ...a, replaces: null } : a)) });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowErrors(true);
    if (!valid) return;
    if (target.kind === "edit" && changes === 0) {
      onClose();
      return;
    }
    setConfirming(true);
  };

  const confirm = () =>
    startTransition(async () => {
      if (target.kind === "new") {
        const result = await createDivision(target.department.id, save);
        if (!result.ok) {
          toast.error("Could not create the division", { description: result.error });
          return;
        }
        toast.success(`${storedDivisionName(draft.name)} is open`);
      } else {
        const result = await saveDivision(divisionId!, save);
        if (!result.ok) {
          toast.error("Could not save the division", { description: result.error });
          return;
        }
        toast.success("Division saved");
      }
      setConfirming(false);
      onClose();
    });

  const title = target.kind === "new" ? "New division" : "Edit division";
  const detail = target.kind === "new" ? `In ${target.department.name} Department` : `${target.tab.division.name} · ${target.tab.division.department} Department`;
  const submitLabel = target.kind === "new" ? "Create division" : changes > 0 ? `Save changes · ${changes}` : "Save changes";
  const formId = `division-${divisionId ?? "new"}-form`;
  const blocked = target.kind === "new" && !valid;

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      detail={detail}
      footer={
        <>
          {tab ? (
            <button type="button" onClick={() => onCloseDivision(tab)} className={PANEL_DANGER_BUTTON}>
              Close division
            </button>
          ) : (
            <button type="button" onClick={onClose} className={PANEL_GHOST_BUTTON}>
              Cancel
            </button>
          )}
          <button type="submit" form={formId} disabled={pending || blocked} className={`${PANEL_PRIMARY_BUTTON} disabled:cursor-not-allowed disabled:opacity-50`}>
            {submitLabel}
          </button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <PanelBody>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <label className="min-w-0">
              <span className={`mb-2 block ${SECTION_LABEL}`}>Name</span>
              <input
                value={draft.name}
                maxLength={60}
                autoComplete="off"
                placeholder="e.g. Flight Dynamics"
                onChange={(e) => set({ name: e.target.value })}
                aria-invalid={showErrors && nameError !== null}
                className={inputClass(showErrors && nameError !== null ? nameError : undefined)}
              />
            </label>
            <label className="min-w-0">
              <span className={`mb-2 block ${SECTION_LABEL}`}>Code</span>
              <input
                value={draft.code}
                maxLength={3}
                autoComplete="off"
                placeholder="FD"
                onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                aria-invalid={draft.code !== "" && codeError !== null}
                className={`${inputClass(draft.code !== "" && codeError !== null ? codeError : undefined)} font-mono uppercase tracking-[0.15em]`}
              />
            </label>
          </div>
          {showErrors && nameError !== null && <p className="mt-1.5 text-[12px] text-danger">{nameError}</p>}
          {draft.code !== "" && codeError !== null ? (
            <p className="mt-2 text-[12px] text-danger">{codeError}</p>
          ) : (
            <p className="mt-2 text-[12px] text-prt-muted">2–3 letters. Used in position codes, like MA-01.</p>
          )}

          <section className="mt-6">
            <h3 className={SECTION_LABEL}>
              Leads
              <span className="ml-1.5 text-prt-muted">{target.kind === "edit" ? `${leadCount} · at least 1` : leadCount > 0 ? `${leadCount} · at least 1` : "at least 1"}</span>
            </h3>
            <div className="mt-2.5">
              {leads.length === 0 && draft.added.length === 0 ? (
                <p className={`${LIST} px-4 py-3 text-center text-[13px] text-prt-muted`}>No lead yet</p>
              ) : (
                <ul className={`${LIST} divide-y divide-hairline`}>
                  {leads.map((lead) => (
                    <OldLeadRow
                      key={lead.id}
                      lead={lead}
                      short={short}
                      replacedBy={replacedBy(lead.id)?.pick.name ?? null}
                      removed={draft.removed.includes(lead.id)}
                      onReplace={() => setPicking({ replaces: lead.id })}
                      onRemove={() => removeLead(lead.id)}
                      onUndo={() => undoRemove(lead.id)}
                    />
                  ))}
                  {draft.added.map((a) => (
                    <NewLeadRow key={a.pick.id} added={a} divisionId={divisionId} short={short} onUndo={() => undoLead(a.pick.id)} />
                  ))}
                </ul>
              )}
            </div>
            {picking !== null ? (
              <PeoplePicker
                mode="lead"
                short={short}
                taken={(p) =>
                  leads.some((l) => l.id === p.id) || draft.added.some((a) => a.pick.id === p.id) ? "Already a lead" : null
                }
                onPick={pickLead}
                onClose={() => setPicking(null)}
                multi={picking.replaces === null}
              />
            ) : (
              <button type="button" onClick={() => setPicking({ replaces: null })} className={`${ADD_LINK} mt-3`}>
                <PlusIcon />
                Add lead
              </button>
            )}
            {(picking !== null || draft.added.length > 0 || leadError !== null) && (
              <p className={`mt-3 text-[12px] ${showErrors && leadError !== null ? "text-danger" : "text-prt-muted"}`}>A division needs at least one lead.</p>
            )}

            {draft.added.map((a) =>
              leads.length === 0 ? null : (
                <ReplacesSelect
                  key={a.pick.id}
                  added={a}
                  leads={leads.filter((l) => !draft.removed.includes(l.id) && (replacedBy(l.id) === null || replacedBy(l.id)?.pick.id === a.pick.id))}
                  onChange={(replaces) => setReplaces(a.pick.id, replaces)}
                />
              ),
            )}
            {gone.map((lead) => {
              const by = replacedBy(lead.id);
              // Only an open division has leads to replace, so a replaced lead always has its division.
              return by !== null && divisionId !== null ? (
                <div key={lead.id} className="mt-5">
                  <HandOverChoice
                    name={`hand-over-${lead.id}`}
                    person={lead.name}
                    handed={{ kind: "lead", divisionId }}
                    unit={short}
                    value={draft.handOvers[lead.id] ?? null}
                    leave={lead.leave}
                    seat={seatOfLead(lead.id)}
                    successor={by.pick.name}
                    onChange={(outcome) => set({ handOvers: { ...draft.handOvers, [lead.id]: outcome } })}
                  />
                </div>
              ) : (
                <OutcomeChoice
                  key={lead.id}
                  lead={lead}
                  short={short}
                  value={draft.outcomes[lead.id] ?? "member"}
                  onChange={(outcome) => set({ outcomes: { ...draft.outcomes, [lead.id]: outcome } })}
                />
              );
            })}
            {showErrors && handOverError !== null && <p className="mt-2 text-[12px] text-danger">{handOverError}</p>}
          </section>

          {tab ? (
            <LiveMembers tab={tab} editable={editable} onFill={(w) => onFill(w, tab)} />
          ) : (
            <DraftMembers
              short={short}
              unnamed={unnamed}
              members={draft.members}
              emails={draft.emails}
              leadIds={draft.added.map((a) => a.pick.id)}
              onAdd={(pick) => set({ members: [...draft.members, pick] })}
              onAddEmail={(email) => set({ emails: [...draft.emails, email] })}
              onDrop={(id) => set({ members: draft.members.filter((m) => m.id !== id) })}
              onDropEmail={(email) => set({ emails: draft.emails.filter((e) => e !== email) })}
            />
          )}
        </PanelBody>
      </form>

      <SaveConfirm
        open={confirming}
        onOpenChange={setConfirming}
        pending={pending}
        target={target}
        name={storedDivisionName(draft.name)}
        original={original}
        code={code}
        nameChanged={nameChanged}
        codeChanged={codeChanged}
        added={draft.added}
        gone={gone.map((l) => {
          const by = replacedBy(l.id);
          return goneLine(
            l,
            by === null ? { via: "removed", outcome: draft.outcomes[l.id] ?? "member" } : { via: "replaced", outcome: draft.handOvers[l.id] ?? null, by: by.pick.name, seat: seatOfLead(l.id) },
            divisionId,
            short,
          );
        })}
        members={draft.members.length + draft.emails.length}
        onConfirm={confirm}
      />
    </SidePanel>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

/** A lead of the division: ⋯ with Replace and Remove; dimmed once replaced or removed, with Undo (boards 68b, 68b4). */
function OldLeadRow({
  lead,
  short,
  replacedBy,
  removed,
  onReplace,
  onRemove,
  onUndo,
}: {
  lead: DivisionPerson;
  short: string;
  replacedBy: string | null;
  removed: boolean;
  onReplace: () => void;
  onRemove: () => void;
  onUndo: () => void;
}) {
  const goneLine = replacedBy !== null ? `Replaced by ${replacedBy}` : removed ? "Removed as lead" : null;
  return (
    <li className={`flex items-center gap-3 px-3.5 py-2.5 ${goneLine ? "opacity-60" : ""}`}>
      <Avatar size="md" photoUrl={lead.photoUrl} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] text-prt-text">{lead.name}</span>
        <span className="block truncate text-[12px] text-prt-muted">{goneLine ?? short}</span>
      </span>
      {goneLine ? (
        <UndoButton onClick={onUndo} label={`Undo for ${lead.name}`} />
      ) : (
        <RowMenu label={`Actions for ${lead.name}`}>
          <MenuItem onSelect={onReplace} icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />}>
            Replace
          </MenuItem>
          <MenuItem onSelect={onRemove} icon={<UserMinus className="h-3.5 w-3.5" strokeWidth={1.75} />}>
            Remove
          </MenuItem>
        </RowMenu>
      )}
    </li>
  );
}

function UndoButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[13px] text-text-2 transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
    >
      <Undo2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      Undo
    </button>
  );
}

/** "Also Lead · Recovery · Parachutes" under a new lead (board 68b3). */
function alsoLine(pick: TeamPick, divisionId: number | null, short: string): string {
  if (divisionId !== null && pick.divisionIds.includes(divisionId)) return `Member of ${short} now`;
  if (pick.place === null) return "In no division yet";
  return `Also ${pick.role.startsWith("Lead") ? "Lead" : "Member"} · ${pick.place}`;
}

function NewLeadRow({ added, divisionId, short, onUndo }: { added: NewLead; divisionId: number | null; short: string; onUndo: () => void }) {
  const { pick } = added;
  return (
    <li className="flex items-center gap-3 bg-accent/[0.05] px-3.5 py-2.5">
      <Avatar size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] text-prt-text">{pick.name}</span>
          <span className="inline-flex h-[18px] shrink-0 items-center rounded bg-accent-soft px-1.5 text-[11px] font-medium text-accent">New</span>
        </span>
        <span className="block truncate text-[12px] text-prt-muted">{alsoLine(pick, divisionId, short)}</span>
      </span>
      <UndoButton onClick={onUndo} label={`Undo adding ${pick.name}`} />
    </li>
  );
}

/** "<new> replaces · optional" (board 68b3): nobody by default, so they lead beside the others. */
function ReplacesSelect({ added, leads, onChange }: { added: NewLead; leads: readonly DivisionPerson[]; onChange: (replaces: number | null) => void }) {
  return (
    <Field label={`${added.pick.name} replaces`} hint="optional" className="mt-5">
      {(id) => (
        <PersonCombobox
          id={id}
          people={leads.map((l) => ({ id: l.id, name: l.name }))}
          value={added.replaces}
          onChoose={onChange}
          placeholder="Search the leads"
          nobody={{ label: "Nobody, add as an extra lead", onChoose: () => onChange(null) }}
          photo={<Avatar size="sm" photoUrl={leads.find((l) => l.id === added.replaces)?.photoUrl ?? null} />}
        />
      )}
    </Field>
  );
}

/** Whether each of a removed lead's three outcomes is open, with the reason when it is not. */
function outcomesFor(lead: DivisionPerson, short: string): Readonly<Record<RemovedLeadOutcome, Permission>> {
  // Someone in another division, or with a seat, keeps a place on the team (`mayLeaveDivision`).
  const mayLeave = lead.removal.kind !== "only-division";
  return {
    member: { allowed: true },
    "leave-division": mayLeave ? { allowed: true } : { allowed: false, reason: `${short} is their only division` },
    "leave-team": lead.leave,
  };
}

/**
 * "What happens to Marco?" for a lead taken off with Remove (board 68b4):
 * stays as a member, leaves this division, or leaves the team. Remove is not
 * a hand-over, so it keeps these three; a replaced lead gets `HandOverChoice`.
 */
function OutcomeChoice({
  lead,
  short,
  value,
  onChange,
}: {
  lead: DivisionPerson;
  short: string;
  value: RemovedLeadOutcome;
  onChange: (outcome: RemovedLeadOutcome) => void;
}) {
  const open = outcomesFor(lead, short);
  const options: readonly { value: RemovedLeadOutcome; title: string; detail: string; danger?: boolean }[] = [
    { value: "member", title: "Stays as a member", detail: `Keeps ${short}, loses lead access` },
    { value: "leave-division", title: `Leaves ${short}`, detail: "Keeps their other divisions, if any" },
    { value: "leave-team", title: "Leaves the team", detail: "Moves to Alumni; their access ends", danger: true },
  ];
  return (
    <fieldset className="mt-5">
      <legend className={`mb-2 ${SECTION_LABEL}`}>What happens to {firstName(lead.name)}?</legend>
      <div className={`${LIST} divide-y divide-hairline`}>
        {options.map((o) => {
          const permission = open[o.value];
          const disabled = !permission.allowed;
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={`flex items-start gap-3 px-3.5 py-3 transition-colors duration-300 ease-out ${disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-white-5"}`}
            >
              <input
                type="radio"
                name={`outcome-${lead.id}`}
                value={o.value}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(o.value)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                  checked ? "border-accent" : "border-white-10"
                }`}
              >
                {checked && <span className="h-2 w-2 rounded-full bg-accent" />}
              </span>
              <span className="min-w-0">
                <span className={`flex items-center gap-1.5 text-[14px] ${disabled ? "text-prt-muted" : o.danger ? "text-danger" : "text-prt-text"}`}>
                  {disabled && <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
                  {o.title}
                </span>
                <span className="block text-[12px] leading-snug text-prt-muted">{permission.allowed ? o.detail : permission.reason}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The picker under "+ Add lead", "+ Add member" (boards 68b2, 68b6, 68b7) or
 * "+ Pick head" (77d, 77e), or who takes over as team leader (77i): the
 * shared person field (issue #511) over a search of the whole team by name,
 * which in member mode also takes an email new to the team. Escape closes it.
 * With `multi`, each pick adds one and the field stays for the next.
 */
export function PeoplePicker({
  mode,
  short,
  taken,
  onPick,
  onEmail,
  onClose,
  multi = false,
}: {
  mode: "lead" | "member" | "head" | "leader" | "seat";
  /** The division or department the pick joins: "Mission Analysis", "the new department". */
  short: string;
  /** Why someone cannot be picked here ("Already a lead"), or null. */
  taken: (pick: TeamPick) => string | null;
  onPick: (pick: TeamPick) => void;
  onEmail?: (email: string) => void;
  onClose: () => void;
  multi?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<TeamSearch>({ kind: "none" });
  const asked = useRef(0);

  useEffect(() => {
    const ask = ++asked.current;
    const timer = setTimeout(async () => {
      const answer = await findPeople(query);
      if (ask === asked.current) setFound(answer);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const newEmail = mode === "member" && found.kind === "new-email" ? found.email : null;
  const footer =
    mode === "leader"
      ? "Search anyone in the team. They become Team Leader when you save and keep their roles."
      : mode === "head"
        ? `Search anyone in the team. They head ${short} and keep their divisions.`
        : mode === "seat"
          ? `Search anyone in the team. They hold ${short} and keep their divisions.`
        : mode === "lead"
          ? `Search anyone in the team. They join ${short} as a lead and keep their other divisions.`
          : newEmail !== null
            ? "They join once you confirm their signed NDA. You or they can fill in their details."
            : "Not in the team yet? Type their email to add them as a new member.";

  const people = found.kind === "people" ? found.people : [];
  const choose = (personId: number) => {
    const pick = people.find((p) => p.id === personId);
    if (pick) onPick(pick);
  };

  return (
    <div className="mt-3 flex items-start gap-2">
      <label htmlFor={id} className="sr-only">
        {mode === "member"
          ? "Search the team, or type an email"
          : mode === "leader"
            ? "Search the team for who takes over"
            : mode === "seat"
              ? "Search the team for who holds the seat"
              : `Search the team for a ${mode}`}
      </label>
      <div className="min-w-0 flex-1">
        <PersonCombobox
          id={id}
          people={people.map((p) => ({ id: p.id, name: p.name, aside: p.place, line: p.role, taken: taken(p) }))}
          value={null}
          onChoose={choose}
          placeholder={mode === "member" ? "Name or email" : "Search the team"}
          search={{ text: query, onText: setQuery }}
          heading={mode === "member" ? "In the team" : undefined}
          note={found.kind === "new-email" ? "No one in the team uses this email." : null}
          extra={newEmail !== null && onEmail ? { label: `Add ${newEmail}`, detail: `New member of ${short}, after the NDA`, onChoose: () => onEmail(newEmail) } : null}
          hint={footer}
          multi={multi}
          autoFocus
          onEscape={onClose}
        />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close the search"
        className={`flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
      >
        <X aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** "Also in Structures · Design & Manufacturing", else their title here (board 68b). */
function memberLine(person: DivisionPerson): string {
  const other = person.divisions.find((d, i) => i > 0);
  if (other) return other.sameDepartment ? `Also in ${other.name}` : `Also in ${other.department} · ${other.name}`;
  return person.title ?? "Member";
}

/**
 * An open division's members (boards 68b, 68b5 to 68b8): the people waiting
 * for their NDA, then everyone who is not a lead, five at first. Each change
 * here is the Members page's own, made at once behind its confirm.
 */
function LiveMembers({ tab, editable, onFill }: { tab: DivisionMembers; editable: boolean; onFill: (waiting: WaitingPerson) => void }) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [, startTransition] = useTransition();
  const { division } = tab;
  const short = divisionLabel(division.name);
  const members = tab.people.filter((p) => p.role !== "lead");
  const people = members.filter((p) => matchesPerson(p, query));
  const waiting = tab.waiting.filter((w) => matchesWaiting(w, query));
  const rows = [...waiting.map((w) => ({ kind: "waiting" as const, w })), ...people.map((p) => ({ kind: "person" as const, p }))];
  const shown = all ? rows : rows.slice(0, MEMBERS_SHOWN);

  const add = (input: Record<string, unknown>, who: string) =>
    startTransition(async () => {
      const result = await addMember({ divisionId: division.id, title: null, ...input });
      if (!result.ok) {
        toast.error("Could not add them", { description: result.error });
        return;
      }
      toast.success(result.value === "joined" ? `${who} joined ${short}` : `${who} is waiting for their NDA. Let them know: the site sends no emails.`);
    });

  return (
    <section className="mt-7">
      <h3 className={SECTION_LABEL}>
        Members
        <span className="ml-1.5 text-prt-muted">{members.length}</span>
        {tab.waiting.length > 0 && <span className="ml-1.5 text-warning">· {tab.waiting.length} waiting</span>}
      </h3>
      <label className="relative mt-2.5 flex h-10 items-center">
        <span className="sr-only">Search members</span>
        <Search aria-hidden className="pointer-events-none absolute left-3.5 h-4 w-4 text-prt-muted" strokeWidth={1.75} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members"
          className="h-full w-full rounded-xl border border-hairline bg-transparent pl-10 pr-3.5 text-[14px] text-prt-text placeholder:text-prt-muted transition-colors duration-300 ease-out hover:border-border-strong focus:border-border-strong focus:outline-none"
        />
      </label>
      {rows.length > 0 && (
        <div className={`${LIST} mt-2.5`}>
          <ul className="divide-y divide-hairline">
            {shown.map((row) =>
              row.kind === "waiting" ? (
                <WaitingItem key={`w${row.w.joinId}`} waiting={row.w} editable={editable} short={short} onAsk={setAsking} onFill={() => onFill(row.w)} division={division.name} />
              ) : (
                <MemberItem key={row.p.id} person={row.p} editable={editable} short={short} divisionId={division.id} onAsk={setAsking} />
              ),
            )}
          </ul>
          {rows.length > MEMBERS_SHOWN && (
            <button
              type="button"
              onClick={() => setAll((a) => !a)}
              className={`block w-full border-t border-hairline py-2.5 text-center text-[13px] text-prt-text transition-colors duration-300 ease-out hover:bg-white-5 ${FOCUS}`}
            >
              {all ? "Show fewer" : `Show all ${rows.length}`}
            </button>
          )}
        </div>
      )}
      {editable &&
        (adding ? (
          <PeoplePicker
            mode="member"
            short={short}
            taken={(p) => (p.divisionIds.includes(division.id) ? `Already in ${short}` : null)}
            onPick={(p) => add({ kind: "member", personId: p.id }, p.name)}
            onEmail={(email) => add({ kind: "email", email, firstName: "", lastName: "", details: null }, email)}
            onClose={() => setAdding(false)}
            multi
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={`${ADD_LINK} mt-3`}>
            <PlusIcon />
            Add member
          </button>
        ))}
      {tab.waiting.map((w) => (
        <NoEmailNote key={w.joinId} waiting={w} editable={editable} onFill={() => onFill(w)} />
      ))}
      <MemberDialogs asking={asking} onClose={() => setAsking(null)} />
    </section>
  );
}

function WaitingItem({
  waiting,
  editable,
  short,
  division,
  onAsk,
  onFill,
}: {
  waiting: WaitingPerson;
  editable: boolean;
  short: string;
  division: string;
  onAsk: (asking: Asking) => void;
  onFill: () => void;
}) {
  return (
    // The text keeps at least 14rem, so the email and the waiting line stay whole (board 68b8); where the
    // row cannot also hold the actions beside it (the 440px drawer, a phone), they wrap under the text, on the right.
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-warning/[0.04] px-3.5 py-2.5">
      <MailAvatar />
      <span className="min-w-0 flex-1 basis-56">
        <span className="block truncate text-[14px] text-prt-text">{waiting.email}</span>
        <WaitingLine waiting={waiting} />
      </span>
      {editable && (
        <span className="ml-auto flex shrink-0 items-center gap-3">
          <ConfirmNdaButton onClick={() => onAsk({ kind: "nda", waiting, division })} />
          <RowMenu label={`Actions for ${waiting.email}`}>
            <MenuItem onSelect={onFill} icon={<Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />}>
              Fill details
            </MenuItem>
            <MenuItem onSelect={() => onAsk({ kind: "cancel", waiting, short })} danger icon={<UserX className="h-3.5 w-3.5" strokeWidth={1.75} />}>
              Cancel add
            </MenuItem>
          </RowMenu>
        </span>
      )}
    </li>
  );
}

/** A member's row and ⋯ menu (board 68b5): Remove from the division, and Leaves the team, each locked with a reason when it is not theirs. */
function MemberItem({
  person,
  editable,
  short,
  divisionId,
  onAsk,
}: {
  person: DivisionPerson;
  editable: boolean;
  short: string;
  divisionId: number;
  onAsk: (asking: Asking) => void;
}) {
  const { removal, leave } = person;
  const others = person.divisions.filter((d) => d.divisionId !== divisionId).map((d) => d.name);
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <Avatar size="md" photoUrl={person.photoUrl} />
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="shrink-0 text-[14px] text-prt-text">{person.name}</span>
        <span className="truncate text-[12px] text-prt-muted">{memberLine(person)}</span>
      </span>
      {editable && !person.self && (
        <RowMenu label={`Actions for ${person.name}`}>
          {(removal.kind === "offered" || removal.kind === "locked") && (
            <MenuItem
              onSelect={() => onAsk({ kind: "remove", person, divisionId, short })}
              icon={<UserMinus className="h-3.5 w-3.5" strokeWidth={1.75} />}
              locked={removal.kind === "locked" ? removal.reason : null}
              detail={`Stays in ${others.join(", ")}`}
            >
              Remove from {short}
            </MenuItem>
          )}
          <MenuItem onSelect={() => onAsk({ kind: "leave", person })} danger locked={leave.allowed ? null : leave.reason}>
            Leaves the team
          </MenuItem>
        </RowMenu>
      )}
    </li>
  );
}

/**
 * The members of New division (board 69d): people from the team and emails
 * new to it, gathered until the division is created.
 */
function DraftMembers({
  short,
  unnamed,
  members,
  emails,
  leadIds,
  onAdd,
  onAddEmail,
  onDrop,
  onDropEmail,
}: {
  short: string;
  /** "the new division" or "this division": the division the footer names, whatever its draft name. */
  unnamed: string;
  members: readonly TeamPick[];
  emails: readonly string[];
  leadIds: readonly number[];
  onAdd: (pick: TeamPick) => void;
  onAddEmail: (email: string) => void;
  onDrop: (id: number) => void;
  onDropEmail: (email: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const count = members.length + emails.length;
  return (
    <section className="mt-7">
      <h3 className={SECTION_LABEL}>
        Members
        <span className="ml-1.5 text-prt-muted">{count}</span>
      </h3>
      {count > 0 && (
        <ul className={`${LIST} mt-2.5 divide-y divide-hairline`}>
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <Avatar size="md" />
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="shrink-0 text-[14px] text-prt-text">{m.name}</span>
                {m.place !== null && <span className="truncate text-[12px] text-prt-muted">Also in {m.place}</span>}
              </span>
              <UndoButton onClick={() => onDrop(m.id)} label={`Undo adding ${m.name}`} />
            </li>
          ))}
          {emails.map((email) => (
            <li key={email} className="flex items-center gap-3 px-3.5 py-2.5">
              <MailAvatar />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-prt-text">{email}</span>
                <span className="block truncate text-[12px] text-warning">Waits for their NDA</span>
              </span>
              <UndoButton onClick={() => onDropEmail(email)} label={`Undo adding ${email}`} />
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <PeoplePicker
          mode="member"
          short={short}
          taken={(p) => (leadIds.includes(p.id) ? "Picked as a lead" : members.some((m) => m.id === p.id) ? "Already added" : null)}
          onPick={onAdd}
          onEmail={(email) => {
            if (!emails.includes(email)) onAddEmail(email);
          }}
          onClose={() => setAdding(false)}
          multi
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`${ADD_LINK} mt-2.5`}>
          <PlusIcon />
          Add member
        </button>
      )}
      <p className="mt-6 text-[12px] leading-relaxed text-prt-muted">The lead and members join {unnamed} and keep their other divisions.</p>
    </section>
  );
}

const OUTCOME_LINES: Readonly<Record<RemovedLeadOutcome, (short: string) => string>> = {
  member: (short) => `stays in ${short} as a member`,
  "leave-division": (short) => `leaves ${short} and keeps their other divisions`,
  "leave-team": () => "leaves the team: they move to Alumni and all their access ends",
};

/**
 * An old lead as the confirm lists them: what becomes of them, whether they
 * leave the team, and, for a replaced lead whose role carries a full-access
 * seat, that the seat moves (`fullAccessMovesLine`, issue #501).
 */
type GoneLine = { readonly lead: DivisionPerson; readonly line: string; readonly leaving: boolean; readonly fullAccess: string | null };

function goneLine(
  lead: DivisionPerson,
  old:
    | { readonly via: "removed"; readonly outcome: RemovedLeadOutcome }
    | { readonly via: "replaced"; readonly outcome: HandOverOutcome | null; readonly by: string; readonly seat: FullAccessSeat | null },
  divisionId: number | null,
  short: string,
): GoneLine {
  if (old.via === "removed") return { lead, line: `${lead.name} ${OUTCOME_LINES[old.outcome](short)}.`, leaving: old.outcome === "leave-team", fullAccess: null };
  const step = old.outcome === null || divisionId === null ? null : steppingDown({ kind: "lead", divisionId }, old.outcome);
  const fullAccess = fullAccessMovesLine({ seat: old.seat, successor: old.by, from: lead.name, step });
  if (step === null) return { lead, line: `${lead.name} is replaced.`, leaving: false, fullAccess };
  return { lead, line: `${lead.name} is replaced and ${steppingDownLine(step, short)}.`, leaving: step.kind === "leave", fullAccess };
}

/** The "are you sure" before Save changes or Create division, saying what will change. */
function SaveConfirm({
  open,
  onOpenChange,
  pending,
  target,
  name,
  original,
  code,
  nameChanged,
  codeChanged,
  added,
  gone,
  members,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  target: DivisionDrawerTarget;
  name: string;
  original: Draft;
  code: string;
  nameChanged: boolean;
  codeChanged: boolean;
  added: readonly NewLead[];
  gone: readonly GoneLine[];
  members: number;
  onConfirm: () => void;
}) {
  const short = divisionLabel(name);
  const lines: ReactNode[] = [];
  if (nameChanged) lines.push(`The division is renamed ${name}.`);
  if (codeChanged) {
    lines.push(
      <>
        The code changes from <span className="font-mono">{normalizeDivisionCode(original.code)}</span> to <span className="font-mono">{code}</span>. Every
        position in this division takes the new code.
      </>,
    );
  }
  for (const a of added) lines.push(`${a.pick.name} becomes a lead and keeps their other divisions.`);
  for (const g of gone) {
    lines.push(g.line);
    if (g.fullAccess !== null) lines.push(g.fullAccess);
  }
  if (target.kind !== "edit" && members > 0) lines.push(`${members} ${members === 1 ? "member joins" : "members join"}.`);
  const leaving = gone.some((g) => g.leaving);

  const title = target.kind === "new" ? `Create ${name}?` : codeChanged && lines.length === 1 ? `Change the code to ${code}?` : `Save changes to ${name}?`;
  const intro = target.kind === "new" ? `It opens in ${target.department.name} with the code ${code}.` : null;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<Pencil className="h-5 w-5" strokeWidth={1.75} />}
      tone={leaving ? "danger" : "accent"}
      danger={leaving}
      title={title}
      description={
        <>
          {intro && <p>{intro}</p>}
          {lines.length > 0 && (
            <ul className={`${intro ? "mt-3" : ""} flex list-disc flex-col gap-1.5 pl-5`}>
              {lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </>
      }
      cancelLabel="Back"
      confirmLabel={target.kind === "new" ? "Create division" : "Save changes"}
      pending={pending}
      onConfirm={onConfirm}
    />
  );
}

