"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ArrowRightLeft, ArrowUpRight, Building2, Check, ChevronDown, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { findMoveTargets, moveMember } from "@/app/dashboard/team-actions";
import type { HandOverOutcome } from "@/lib/dashboard/hand-over";
import { headsAfterMove, titleOnMove, type HeadsAfterMove, type MovablePlace, type MoveDepartment, type MoveTo } from "@/lib/dashboard/member-move";
import { andList } from "@/lib/dashboard/team-structure";
import { Chips } from "./division-chips";
import { ConfirmDialog } from "./confirm-dialog";
import { Field, inputClass } from "./field";
import { HandOverChoice, RadioChoice } from "./hand-over-choice";
import { PersonCombobox } from "./person-combobox";

// The one move control (issue #647, boards 98a to 98c): Members Edit details
// and the Team tree's Edit division both pick where someone goes with it, and
// both save through the one server move (`moveMember`), so the two places
// behave the same. A division or a department, then what they are there:
// member or lead of a division, or head of a department only when picked
// (Owner decision, 2026-10-24).

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Where the Team tree's edit view opens, for the "Also on the Team tree" link. */
const TEAM_TREE_EDIT = "/dashboard/team-tree?edit=1";

/** What the move control holds: the unit picked, and the role there. */
export type MoveChoice = {
  readonly unit: { readonly kind: "division" | "department"; readonly id: number };
  readonly as: "member" | "lead" | "head";
};

/** The key a place is held under in a form: one per movable place. */
export function placeKey(place: MovablePlace): string {
  return place.kind === "division" ? `v${place.divisionId}` : `h${place.departmentId}`;
}

/** Where a place is now, as the control starts. */
export function choiceOf(place: MovablePlace): MoveChoice {
  return place.kind === "division"
    ? { unit: { kind: "division", id: place.divisionId }, as: place.role }
    : { unit: { kind: "department", id: place.departmentId }, as: "head" };
}

/** The department a choice's unit is in. */
function departmentOf(departments: readonly MoveDepartment[], unit: MoveChoice["unit"]): MoveDepartment | null {
  return departments.find((d) => (unit.kind === "department" ? d.id === unit.id : d.divisions.some((v) => v.id === unit.id))) ?? null;
}

/**
 * Where the choice moves the person, or null when it keeps them where they
 * are: the same division (only lead or member may change there, which the
 * lead switch saves), or the department they already head.
 */
export function moveToOf(place: MovablePlace, choice: MoveChoice, departments: readonly MoveDepartment[]): MoveTo | null {
  const { unit, as } = choice;
  const to: MoveTo | null =
    unit.kind === "department" || as === "head"
      ? (() => {
          const department = departmentOf(departments, unit);
          return department === null ? null : { kind: "head", departmentId: department.id };
        })()
      : { kind: "division", divisionId: unit.id, as };
  if (to === null) return null;
  if (place.kind === "division" && to.kind === "division" && to.divisionId === place.divisionId) return null;
  if (place.kind === "head" && to.kind === "head" && to.departmentId === place.departmentId) return null;
  return to;
}

/** "Propulsion · Engines", "Propulsion": the unit as the control's box names it. */
export function unitLabel(departments: readonly MoveDepartment[], place: MovablePlace, unit: MoveChoice["unit"]): string {
  const department = departmentOf(departments, unit);
  if (unit.kind === "department") return department?.name ?? (place.kind === "head" ? place.department : "");
  const division = department?.divisions.find((v) => v.id === unit.id);
  if (department && division) return `${department.name} · ${division.name}`;
  return place.kind === "division" ? `${place.department} · ${place.short}` : "";
}

/** "Avionics · Electronics" for a division, "Avionics" for a headship: where a move goes, as its confirm names it. */
export function moveLabel(departments: readonly MoveDepartment[], to: MoveTo): string {
  if (to.kind === "head") return departments.find((d) => d.id === to.departmentId)?.name ?? "";
  const department = departments.find((d) => d.divisions.some((v) => v.id === to.divisionId));
  const division = department?.divisions.find((v) => v.id === to.divisionId);
  return department && division ? `${department.name} · ${division.name}` : "";
}

/** "Electronics" for a division, "Avionics" for a headship: where a move goes, as a confirm's question names it. */
export function moveShort(departments: readonly MoveDepartment[], to: MoveTo): string {
  if (to.kind === "head") return moveLabel(departments, to);
  return departments.flatMap((d) => d.divisions).find((v) => v.id === to.divisionId)?.name ?? "";
}

/** The short name a title field reads: "Engines" for a division, the department's name for a head. */
export function unitShort(departments: readonly MoveDepartment[], unit: MoveChoice["unit"]): string | null {
  const department = departmentOf(departments, unit);
  if (unit.kind === "department") return department?.name ?? null;
  return department?.divisions.find((v) => v.id === unit.id)?.name ?? null;
}

/**
 * Where the viewer may move `personId`, read once the control opens; empty
 * while it loads, or for someone the viewer may not move.
 */
export function useMoveTargets(personId: number | null): readonly MoveDepartment[] {
  const [departments, setDepartments] = useState<readonly MoveDepartment[]>([]);
  useEffect(() => {
    if (personId === null) return;
    let live = true;
    findMoveTargets(personId).then(
      (answer) => live && setDepartments(answer.kind === "targets" ? answer.departments : []),
      () => live && setDepartments([]),
    );
    return () => {
      live = false;
    };
  }, [personId]);
  return departments;
}

/**
 * The Division (or Move to, for a head) box and the As box (boards 98a,
 * 98b). `taken` are the person's other divisions, which they cannot move
 * into. Changing the unit starts them as a member there (Owner decision,
 * 2026-10-24).
 */
export function MoveFields({
  place,
  departments,
  value,
  taken,
  onChange,
}: {
  place: MovablePlace;
  departments: readonly MoveDepartment[];
  value: MoveChoice;
  taken: readonly number[];
  onChange: (choice: MoveChoice) => void;
}) {
  const start = choiceOf(place);
  const changed = value.unit.kind !== start.unit.kind || value.unit.id !== start.unit.id;
  const department = departmentOf(departments, value.unit);
  const division = value.unit.kind === "division" ? department?.divisions.find((v) => v.id === value.unit.id) : undefined;
  // Before the targets arrive, the box offers what they are now.
  const leadAllowed = division?.lead ?? (place.kind === "division" && place.role === "lead");
  const headAllowed = place.kind === "head" && (department?.headable ?? value.unit.kind === "department");
  const options: { value: MoveChoice["as"]; label: string; disabled: boolean }[] =
    value.unit.kind === "department"
      ? [{ value: "head", label: `Head of ${unitLabel(departments, place, value.unit)}`, disabled: false }]
      : [
          { value: "member", label: "Member", disabled: false },
          { value: "lead", label: "Division lead", disabled: !leadAllowed },
          ...(place.kind === "head" && department ? [{ value: "head" as const, label: `Head of ${department.name}`, disabled: !headAllowed }] : []),
        ];
  const pick = (key: string) => {
    const unit = key.startsWith("d") ? ({ kind: "department", id: Number(key.slice(1)) } as const) : ({ kind: "division", id: Number(key.slice(1)) } as const);
    const back = unit.kind === start.unit.kind && unit.id === start.unit.id;
    onChange({ unit, as: back ? start.as : unit.kind === "department" ? "head" : "member" });
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-3">
      <Field label={place.kind === "head" ? "Move to" : "Division"}>
        {(id) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              id={id}
              className={`${inputClass()} flex items-center gap-2.5 text-left data-[state=open]:border-accent ${changed ? "border-accent" : ""} ${FOCUS}`}
            >
              <span className="min-w-0 truncate">{unitLabel(departments, place, value.unit)}</span>
              <ChevronDown aria-hidden className="ml-auto h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuPrimitive.Content
                align="start"
                sideOffset={6}
                className="z-50 max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
              >
                <DropdownMenuPrimitive.RadioGroup value={`${value.unit.kind === "department" ? "d" : "v"}${value.unit.id}`} onValueChange={pick}>
                  {departments.map((d) => (
                    <DropdownMenuPrimitive.Group key={d.id} className="py-1 first:pt-0">
                      <DropdownMenuPrimitive.Label className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-dim">{d.name}</DropdownMenuPrimitive.Label>
                      {place.kind === "head" && d.headable && (
                        <MoveItem value={`d${d.id}`} disabled={false}>
                          <Building2 aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
                          <span className="min-w-0 truncate">{d.name}</span>
                          <span className="shrink-0 text-[12px] text-prt-muted">department</span>
                        </MoveItem>
                      )}
                      {d.divisions.map((v) => {
                        const own = place.kind === "division" && v.id === place.divisionId;
                        const isTaken = !own && taken.includes(v.id);
                        return (
                          <MoveItem key={v.id} value={`v${v.id}`} disabled={isTaken}>
                            {v.code !== null && <Chips chips={[{ divisionId: v.id, label: v.code, code: true }]} />}
                            <span className="min-w-0 truncate">{v.name}</span>
                            {isTaken && <span className="shrink-0 text-[12px] text-prt-muted">already in</span>}
                          </MoveItem>
                        );
                      })}
                    </DropdownMenuPrimitive.Group>
                  ))}
                </DropdownMenuPrimitive.RadioGroup>
              </DropdownMenuPrimitive.Content>
            </DropdownMenuPortal>
          </DropdownMenu>
        )}
      </Field>
      <Field label="As">
        {(id) => (
          <div className="relative">
            <select
              id={id}
              value={value.as}
              onChange={(e) => onChange({ ...value, as: e.target.value as MoveChoice["as"] })}
              className={`${inputClass()} cursor-pointer appearance-none truncate pr-10`}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled} className="bg-panel text-prt-text">
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
          </div>
        )}
      </Field>
    </div>
  );
}

function MoveItem({ value, disabled, children }: { value: string; disabled: boolean; children: ReactNode }) {
  return (
    <DropdownMenuPrimitive.RadioItem
      value={value}
      disabled={disabled}
      className="flex h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[14px] outline-none transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-white-5"
    >
      {children}
      <DropdownMenuPrimitive.ItemIndicator className="ml-auto">
        <Check aria-hidden className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.RadioItem>
  );
}

/**
 * The line under the boxes in Edit details (boards 98a, 98b): what Save does
 * with the move, and that the same move is on the Team tree, linked there.
 */
export function MoveHint({ place, moving }: { place: MovablePlace; moving: boolean }) {
  const words =
    place.kind === "head"
      ? moving
        ? `No longer head of ${place.department} after Save.`
        : "Pick where they go to move them on Save."
      : moving
        ? `Moves from ${place.short} on Save.`
        : "Pick another division to move them on Save.";
  return (
    <p className="mt-3 text-[13px] text-prt-muted">
      {words}{" "}
      <Link href={TEAM_TREE_EDIT} className={`inline-flex items-center gap-1 rounded-sm text-prt-muted transition-colors duration-300 ease-out hover:text-accent ${FOCUS}`}>
        Also on the Team tree
        <ArrowUpRight aria-hidden className="h-3.5 w-3.5 text-accent" strokeWidth={1.75} />
      </Link>
    </p>
  );
}

/**
 * The amber note when a head's move leaves their department with no head
 * (board 98b): shown only for its last head, since any other heads stay
 * (issue #879; `headsAfterMove`).
 */
export function NoHeadNote({ department }: { department: string }) {
  return (
    <p className="mt-3 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/[0.05] px-4 py-3 text-[13px] leading-snug text-warning">
      <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span>
        Moving them leaves {department} with no head. When you save, you can pick a new head, or do it later on the Team tree. They become head of
        their new department only if you choose that under As.
      </span>
    </p>
  );
}

/** What a head's move asks on Save (board 98c): the head picked for the department they leave, the head they replace (issue #872) and what that head does. */
export type HeadMoveAnswer = { readonly successor: number | null; readonly replacing: number | null; readonly replaced: HandOverOutcome | null };

/**
 * Save's confirm for a head's move (board 98c). When they are the last head of
 * the department they leave, it will have no head, so pick one now from its
 * people or leave it empty for the Team tree. When it has other heads, they
 * stay (issue #879): the confirm names them and adding a head is optional,
 * still offered for a head whose full-access seat needs someone to take it
 * over. And when they are made head of a department that has heads, which one
 * they replace and what that head does (the replace-head choice).
 */
export function HeadMoveConfirm({
  open,
  onOpenChange,
  person,
  personId,
  from,
  to,
  departments,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Marco Bianchi" */
  person: string;
  personId: number;
  /** The department they stop heading. */
  from: { readonly id: number; readonly name: string };
  to: MoveTo;
  departments: readonly MoveDepartment[];
  pending: boolean;
  onConfirm: (answer: HeadMoveAnswer) => void;
}) {
  const left = headsAfterMove(departments, from.id, personId);
  // Pick a new head is the default only for the last head; with other heads it stays an option.
  const [leaveChoice, setLeave] = useState<"pick" | "empty" | null>(null);
  const leave = leaveChoice ?? (left.kind === "none" ? "pick" : "empty");
  const [successor, setSuccessor] = useState<number | null>(null);
  const [replaced, setReplaced] = useState<HandOverOutcome | null>(null);
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const first = person.split(" ")[0] ?? person;
  const source = departments.find((d) => d.id === from.id);
  const target = to.kind === "head" ? departments.find((d) => d.id === to.departmentId) : undefined;
  const targetHeads = target?.heads ?? [];
  // They replace one head of it: its only head, or the one picked among several; every other head stays (issue #872).
  const replacing = targetHeads.length === 1 ? targetHeads[0] : (targetHeads.find((h) => h.id === replacingId) ?? null);
  const staying = replacing === null ? [] : targetHeads.filter((h) => h.id !== replacing.id).map((h) => h.name);
  const toLabel = moveLabel(departments, to);
  const joins = to.kind === "head" ? `${first} becomes head of ${toLabel}.` : `${first} joins ${toLabel} as ${to.as === "lead" ? "its lead" : "a member"}.`;
  const ready = (leave === "empty" || successor !== null) && (targetHeads.length === 0 || (replacing !== null && replaced !== null));
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<ArrowRightLeft className="h-5 w-5" strokeWidth={1.75} />}
      title={`Move ${person} to ${moveShort(departments, to)}?`}
      description={`${joins} ${fromAfter(from.name, left)}`}
      cancelLabel="Cancel"
      confirmLabel="Move"
      pending={pending}
      confirmDisabled={!ready}
      onConfirm={() =>
        onConfirm({ successor: leave === "pick" ? successor : null, replacing: replacing?.id ?? null, replaced: replacing === null ? null : replaced })
      }
    >
      <div className="mt-5">
        <RadioChoice
          name="head-move-successor"
          legend={left.kind === "none" ? `Who heads ${from.name}?` : `Add a head to ${from.name}?`}
          layout="cards"
          value={leave}
          onChange={setLeave}
          options={
            left.kind === "none"
              ? [
                  { value: "pick", title: `Pick a new head for ${from.name} now`, detail: `Search ${from.name} members` },
                  { value: "empty", title: "Leave it empty for now", detail: "Set it later on the Team tree" },
                ]
              : [
                  { value: "empty", title: "No new head", detail: `${from.name} keeps the heads it has` },
                  { value: "pick", title: `Pick a new head for ${from.name} too`, detail: `Search ${from.name} members` },
                ]
          }
        />
        {leave === "pick" && (
          <div className="mt-3">
            <PersonCombobox
              label={`New head of ${from.name}`}
              people={(source?.successors ?? []).map((p) => ({ id: p.id, name: p.name, photoUrl: p.photoUrl }))}
              value={successor}
              onChoose={setSuccessor}
              placeholder={`Search ${from.name} members`}
            />
          </div>
        )}
      </div>
      {targetHeads.length > 1 && to.kind === "head" && (
        <div className="mt-5">
          <RadioChoice
            name="head-move-replacing"
            legend={`Which head of ${toLabel} does ${first} replace?`}
            layout="cards"
            value={replacingId === null ? null : String(replacingId)}
            onChange={(id) => {
              setReplacingId(Number(id));
              setReplaced(null);
            }}
            options={targetHeads.map((h) => ({ value: String(h.id), title: h.name, detail: "The other heads stay" }))}
          />
        </div>
      )}
      {replacing !== null && to.kind === "head" && (
        <div className="mt-5">
          {staying.length > 0 && (
            <p className="mb-3 text-[13px] text-text-2">
              {andList(staying)} {staying.length === 1 ? "stays" : "stay"} head of {toLabel}.
            </p>
          )}
          <HandOverChoice
            name="head-move-replaced"
            person={replacing.name}
            handed={{ kind: "head", departmentId: to.departmentId }}
            unit={toLabel}
            value={replaced}
            leave={{ allowed: true }}
            seat={null}
            successor={person}
            onChange={setReplaced}
          />
        </div>
      )}
    </ConfirmDialog>
  );
}

/** "Propulsion will have no head.", or who heads it after the move: "Anna Rossi stays head of Propulsion." */
function fromAfter(department: string, left: HeadsAfterMove): string {
  if (left.kind === "none") return `${department} will have no head.`;
  return `${andList(left.heads.map((h) => h.name))} ${left.heads.length === 1 ? "stays" : "stay"} head of ${department}.`;
}

/**
 * "Move to…" on a member row of the Team tree's Edit division (issue #647):
 * the same control and the same server move as Edit details, for the one
 * division the row is in, with their role title in the new division, typed
 * here: the old division's title never goes with them (issue #777).
 */
export function MoveDialog({
  open,
  onOpenChange,
  personId,
  name,
  place,
  taken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: number;
  name: string;
  place: Extract<MovablePlace, { kind: "division" }>;
  taken: readonly number[];
}) {
  const departments = useMoveTargets(open ? personId : null);
  const [choice, setChoice] = useState<MoveChoice>(choiceOf(place));
  // The title is the new division's, typed here: it starts empty and empties on each new destination (issue #777).
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const to = moveToOf(place, choice, departments);
  const choose = (next: MoveChoice) => {
    setTitle(titleOnMove({ current: title, stored: null, from: to, to: moveToOf(place, next, departments) }));
    setChoice(next);
  };
  const short = unitShort(departments, choice.unit) ?? place.short;
  const save = () =>
    startTransition(async () => {
      if (to === null) return;
      const result = await moveMember({ personId, from: { kind: "division", divisionId: place.divisionId }, to, title, replaced: null, replacing: null, successor: null });
      if (!result.ok) {
        toast.error(`Could not move ${name}`, { description: result.error });
        return;
      }
      toast.success(`${name} moved to ${short}`);
      onOpenChange(false);
    });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setChoice(choiceOf(place));
          setTitle("");
        }
        onOpenChange(next);
      }}
      icon={<ArrowRightLeft className="h-5 w-5" strokeWidth={1.75} />}
      title={`Move ${name}`}
      description={`From ${place.department} · ${place.short}. Their role there ends and the new one starts when you press Move.`}
      cancelLabel="Cancel"
      confirmLabel="Move"
      pending={pending}
      confirmDisabled={to === null}
      onConfirm={save}
    >
      <div className="mt-5 flex flex-col gap-4">
        <MoveFields place={place} departments={departments} value={choice} taken={taken} onChange={choose} />
        <Field label={`Role in ${short}`} hint="shown on the Team page">
          {(id) => <input id={id} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={inputClass()} />}
        </Field>
      </div>
    </ConfirmDialog>
  );
}
