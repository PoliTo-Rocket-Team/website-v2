"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Building2, ChevronDown, Lock, Pencil, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { closeDepartment, createDepartment, saveDepartment } from "@/app/dashboard/team-actions";
import {
  departmentCodeError,
  departmentNameError,
  normalizeDepartmentCode,
  planDepartmentClose,
  storedDepartmentName,
  type DivisionFate,
  type HeadOutcome,
} from "@/lib/dashboard/department-edit";
import type { TeamPick } from "@/lib/dashboard/division-edit";
import { divisionLabel, type OrgChart } from "@/lib/dashboard/team";
import type { StructureDepartment, StructureDivision, TeamStructure } from "@/lib/dashboard/team-structure";
import { initialsOf } from "@/lib/dashboard/viewer";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { PeoplePicker } from "./division-drawer";
import { PANEL_DANGER_BUTTON, PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON, PanelBody, SidePanel } from "./drawer";
import { inputClass } from "./field";

// New department (board 77d), Edit department (77e) and Close department
// (77f), on the Team tree's edit view (issue #251). Only the team leader and
// full access open them. Each save asks "are you sure" first, and the server
// checks every rule again (lib/dashboard/department-edit.ts). Changing a
// department's head is not here: role hand-over is its own issue (#253).

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const ADD_LINK = `inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${FOCUS}`;
const LIST = "overflow-hidden rounded-xl border border-hairline";
const SECTION_LABEL = "text-[13px] text-prt-text";
const CODE_BOX = "inline-flex h-6 shrink-0 items-center rounded-md border border-hairline bg-white-5 px-1.5 font-mono text-[11px] font-medium tracking-[0.08em] text-prt-text";
/** The red footer button that closes the department (board 77f): filled, and muted until every division has a choice. */
const DANGER_FILLED = `inline-flex h-11 items-center justify-center rounded-full bg-danger px-4 text-[14px] font-semibold text-prt-text transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`;

/** Which department panel is open: New department, or Edit department and its Close department step. */
export type DepartmentDrawerTarget =
  | { readonly kind: "new" }
  | { readonly kind: "edit"; readonly departmentId: number }
  | { readonly kind: "close"; readonly departmentId: number };

/** The chart the edit view shows, as the department rules read it. */
function orgOf(structure: TeamStructure): OrgChart {
  return {
    departments: structure.departments.map((d) => ({ id: d.id, name: d.name, code: d.code })),
    divisions: structure.departments.flatMap((d) => d.divisions.map((v) => ({ id: v.id, name: v.name, departmentId: d.id, code: v.code }))),
  };
}

function peopleLine(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

/** "Head Chiara Rinaldi · 2 divisions · 24 people" under the panel title (boards 77e, 77f). */
function departmentDetail(department: StructureDepartment): string {
  const divisions = department.divisions.length;
  return [
    department.head ? `Head ${department.head.name}` : null,
    `${divisions} ${divisions === 1 ? "division" : "divisions"}`,
    peopleLine(department.size),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function DepartmentDrawer({
  target,
  structure,
  onClose,
  onTarget,
}: {
  target: DepartmentDrawerTarget | null;
  structure: TeamStructure;
  onClose: () => void;
  onTarget: (target: DepartmentDrawerTarget) => void;
}) {
  // The last target stays while the panel closes, so its content does not vanish mid-close.
  const [shown, setShown] = useState(target);
  if (target !== null && target !== shown) setShown(target);
  if (shown === null) return null;
  const open = target !== null;
  if (shown.kind === "new") return <NewDepartment key="new" open={open} structure={structure} onClose={onClose} />;
  // The panel reads the department from the page, so a change saved elsewhere shows at once.
  const department = structure.departments.find((d) => d.id === shown.departmentId);
  if (!department) return null;
  return shown.kind === "edit" ? (
    <EditDepartment key={`e${department.id}`} open={open} department={department} structure={structure} onClose={onClose} onCloseDepartment={() => onTarget({ kind: "close", departmentId: department.id })} />
  ) : (
    <CloseDepartment key={`c${department.id}`} open={open} department={department} structure={structure} onClose={onClose} />
  );
}

/** Name and code, side by side (boards 77d, 77e), with the code's rule or its error under them. */
function NameAndCode({
  name,
  code,
  nameError,
  codeError,
  showErrors,
  onName,
  onCode,
}: {
  name: string;
  code: string;
  nameError: string | null;
  codeError: string | null;
  showErrors: boolean;
  onName: (name: string) => void;
  onCode: (code: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <label className="min-w-0">
          <span className={`mb-2 block ${SECTION_LABEL}`}>Name</span>
          <input
            value={name}
            maxLength={60}
            autoComplete="off"
            placeholder="e.g. Propulsion"
            onChange={(e) => onName(e.target.value)}
            aria-invalid={showErrors && nameError !== null}
            className={inputClass(showErrors && nameError !== null ? nameError : undefined)}
          />
        </label>
        <label className="min-w-0">
          <span className={`mb-2 block ${SECTION_LABEL}`}>Code</span>
          <input
            value={code}
            maxLength={3}
            autoComplete="off"
            placeholder="PR"
            onChange={(e) => onCode(e.target.value.toUpperCase())}
            aria-invalid={code !== "" && codeError !== null}
            className={`${inputClass(code !== "" && codeError !== null ? codeError : undefined)} font-mono uppercase tracking-[0.15em]`}
          />
        </label>
      </div>
      {showErrors && nameError !== null && <p className="mt-1.5 text-[12px] text-danger">{nameError}</p>}
      {code !== "" && codeError !== null ? (
        <p className="mt-2 text-[12px] text-danger">{codeError}</p>
      ) : (
        <p className="mt-2 text-[12px] text-prt-muted">2–3 letters, like AE.</p>
      )}
    </>
  );
}

/** Board 77d: the name, a 2 or 3 letter code, and its one head, picked from the team. */
function NewDepartment({ open, structure, onClose }: { open: boolean; structure: TeamStructure; onClose: () => void }) {
  const [name, setName] = useState("");
  const [rawCode, setCode] = useState("");
  const [head, setHead] = useState<TeamPick | null>(null);
  const [picking, setPicking] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const code = normalizeDepartmentCode(rawCode);
  const nameError = departmentNameError(name);
  const codeError = rawCode.trim() === "" ? "Write a code." : departmentCodeError(code, structure.departments, null);
  const headError = head === null ? "Pick the head." : null;
  const valid = nameError === null && codeError === null && headError === null;
  const stored = storedDepartmentName(name);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowErrors(true);
    if (valid) setConfirming(true);
  };

  const confirm = () =>
    startTransition(async () => {
      if (!head) return;
      const result = await createDepartment({ name, code, heads: [head.id] });
      if (!result.ok) {
        toast.error("Could not create the department", { description: result.error });
        return;
      }
      toast.success(`${stored} Department is open`);
      setConfirming(false);
      onClose();
    });

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="New department"
      detail="For the whole team"
      footer={
        <>
          <button type="button" onClick={onClose} className={PANEL_GHOST_BUTTON}>
            Cancel
          </button>
          <button type="submit" form="new-department-form" disabled={pending || !valid} className={`${PANEL_PRIMARY_BUTTON} disabled:cursor-not-allowed disabled:opacity-50`}>
            Create department
          </button>
        </>
      }
    >
      <form id="new-department-form" noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <PanelBody>
          <NameAndCode name={name} code={rawCode} nameError={nameError} codeError={codeError} showErrors={showErrors} onName={setName} onCode={setCode} />
          <section className="mt-6">
            <h3 className={SECTION_LABEL}>
              Head
              <span className="ml-1.5 text-prt-muted">1 person</span>
            </h3>
            <div className="mt-2.5">
              {head === null ? (
                <p className={`${LIST} px-4 py-3 text-center text-[13px] text-prt-muted`}>No head yet</p>
              ) : (
                <div className={`${LIST} flex items-center gap-3 bg-accent/[0.05] px-3.5 py-2.5`}>
                  <Avatar name={head.name} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-prt-text">{head.name}</span>
                    <span className="block truncate text-[12px] text-prt-muted">{head.place === null ? "In no division yet" : `Keeps ${head.place}`}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setHead(null)}
                    aria-label={`Undo picking ${head.name}`}
                    className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[13px] text-text-2 transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
                  >
                    <Undo2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Undo
                  </button>
                </div>
              )}
            </div>
            {picking ? (
              <PeoplePicker
                mode="head"
                short={stored === "" ? "the new department" : stored}
                taken={(p) => (p.seated ? `Already ${p.role}` : null)}
                onPick={(p) => {
                  setHead(p);
                  setPicking(false);
                }}
                onClose={() => setPicking(false)}
              />
            ) : (
              head === null && (
                <button type="button" onClick={() => setPicking(true)} className={`${ADD_LINK} mt-3`}>
                  <PlusIcon />
                  Pick head
                </button>
              )
            )}
            {showErrors && headError !== null && <p className="mt-2 text-[12px] text-danger">{headError}</p>}
            <p className="mt-6 text-[12px] leading-relaxed text-prt-muted">The head keeps their other divisions. Add divisions after you create it, with Add division.</p>
          </section>
        </PanelBody>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        icon={<Building2 className="h-5 w-5" strokeWidth={1.75} />}
        title={`Create ${stored} Department?`}
        description={`It opens with the code ${code}. ${head?.name ?? "The head"} becomes its head and keeps their divisions.`}
        cancelLabel="Back"
        confirmLabel="Create department"
        pending={pending}
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

/** Board 77e: name and code, the head, and the divisions as read-only rows; Close department and Save changes. */
function EditDepartment({
  open,
  department,
  structure,
  onClose,
  onCloseDepartment,
}: {
  open: boolean;
  department: StructureDepartment;
  structure: TeamStructure;
  onClose: () => void;
  onCloseDepartment: () => void;
}) {
  const [name, setName] = useState(department.name);
  const [rawCode, setCode] = useState(department.code ?? "");
  const [showErrors, setShowErrors] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [openDivision, setOpenDivision] = useState<number | null>(department.divisions[0]?.id ?? null);
  const [pending, startTransition] = useTransition();

  const code = normalizeDepartmentCode(rawCode);
  const nameError = departmentNameError(name);
  const codeError = rawCode.trim() === "" ? "Write a code." : departmentCodeError(code, structure.departments, department.id);
  const valid = nameError === null && codeError === null;
  const stored = storedDepartmentName(name);
  const nameChanged = stored !== department.name;
  const codeChanged = code !== normalizeDepartmentCode(department.code ?? "");

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowErrors(true);
    if (!valid) return;
    if (!nameChanged && !codeChanged) {
      onClose();
      return;
    }
    setConfirming(true);
  };

  const confirm = () =>
    startTransition(async () => {
      const result = await saveDepartment(department.id, { name, code });
      if (!result.ok) {
        toast.error("Could not save the department", { description: result.error });
        return;
      }
      toast.success("Department saved");
      setConfirming(false);
      onClose();
    });

  const lines: ReactNode[] = [];
  if (nameChanged) lines.push(`The department is renamed ${stored}.`);
  if (codeChanged) {
    lines.push(
      <>
        The code changes from <span className="font-mono">{normalizeDepartmentCode(department.code ?? "") || "none"}</span> to <span className="font-mono">{code}</span>.
      </>,
    );
  }
  const head = department.head;

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={`${department.name} Department`}
      detail={departmentDetail(department)}
      footer={
        <>
          <button type="button" onClick={onCloseDepartment} className={PANEL_DANGER_BUTTON}>
            Close department
          </button>
          <button type="submit" form={`department-${department.id}-form`} disabled={pending} className={PANEL_PRIMARY_BUTTON}>
            Save changes
          </button>
        </>
      }
    >
      <form id={`department-${department.id}-form`} noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <PanelBody>
          <NameAndCode name={name} code={rawCode} nameError={nameError} codeError={codeError} showErrors={showErrors} onName={setName} onCode={setCode} />
          <section className="mt-6">
            <h3 className={SECTION_LABEL}>Head</h3>
            {head ? (
              <div className={`${LIST} mt-2.5 flex items-center gap-3 px-3.5 py-3`}>
                <Avatar name={head.name} size="md" accent />
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="shrink-0 text-[15px] text-prt-text">{head.name}</span>
                  {head.divisions.length > 0 && <span className="truncate text-[12px] text-prt-muted">also in {head.divisions.join(", ")}</span>}
                </span>
              </div>
            ) : (
              <p className={`${LIST} mt-2.5 px-4 py-3 text-center text-[13px] text-prt-muted`}>No head</p>
            )}
          </section>
          <section className="mt-6">
            <h3 className={SECTION_LABEL}>
              Divisions
              <span className="ml-1.5 text-prt-muted">{department.divisions.length}</span>
            </h3>
            <ul className="mt-2.5 flex flex-col gap-2">
              {department.divisions.map((division) => (
                <DivisionRow
                  key={division.id}
                  division={division}
                  open={openDivision === division.id}
                  onToggle={() => setOpenDivision((current) => (current === division.id ? null : division.id))}
                />
              ))}
            </ul>
            {department.divisions.length > 0 && (
              <p className="mt-2.5 text-[12px] leading-relaxed text-prt-muted">Open a division to see who is in it. Edit it from its own box in the tree.</p>
            )}
          </section>
        </PanelBody>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        icon={<Pencil className="h-5 w-5" strokeWidth={1.75} />}
        title={`Save changes to ${department.name} Department?`}
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
    </SidePanel>
  );
}

/** One division of Edit department (board 77e): its code, name, lead and count; open, its people, lead first, read-only. */
function DivisionRow({ division, open, onToggle }: { division: StructureDivision; open: boolean; onToggle: () => void }) {
  const people = [...(division.page?.people ?? [])].sort((a, b) => Number(b.role === "lead") - Number(a.role === "lead"));
  return (
    <li className={LIST}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-300 ease-out hover:bg-white-5 ${FOCUS}`}
      >
        {division.code !== null && <span className={CODE_BOX}>{division.code}</span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] text-prt-text">{division.name}</span>
          <span className="block truncate text-[12px] text-prt-muted">{[division.lead?.name, peopleLine(division.size)].filter(Boolean).join(" · ")}</span>
        </span>
        <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-prt-muted motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out ${open ? "rotate-180" : ""}`} />
      </button>
      {open && people.length > 0 && (
        <ul className="border-t border-hairline px-3.5 py-2">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-1.5">
              <Avatar name={p.name} size="sm" accent={p.role === "lead"} photoUrl={p.photoUrl} />
              <span className="truncate text-[14px] text-prt-text">{p.name}</span>
              {p.role === "lead" && <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Lead</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** A division's choice on Close department: move (to a department, once picked) or close. */
type Fate = { readonly action: "move"; readonly to: number | null } | { readonly action: "close" };

/** One option of a two-way choice on Close department (board 77f): the picked one filled, the other plain. */
function choiceClass(current: boolean): string {
  return `flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] transition-colors duration-300 ease-out ${FOCUS} ${
    current ? "bg-white-10 font-semibold text-prt-text" : "text-text-2 enabled:hover:text-prt-text"
  } disabled:cursor-not-allowed disabled:text-dim`;
}

/** Everyone in the division, those waiting for their NDA included: a division with anyone in it can only move. */
function inDivision(division: StructureDivision): number {
  return division.size + (division.page?.waiting.length ?? 0);
}

/**
 * Board 77f: each division moves to another department or, when empty,
 * closes, and the head becomes an advisor or leaves the team, with neither
 * picked at first (Owner decision, 2026-10-16). Close department stays
 * disabled until every division and the head have a choice.
 */
function CloseDepartment({
  open,
  department,
  structure,
  onClose,
}: {
  open: boolean;
  department: StructureDepartment;
  structure: TeamStructure;
  onClose: () => void;
}) {
  const [fates, setFates] = useState<Readonly<Record<number, Fate>>>(() =>
    Object.fromEntries(department.divisions.flatMap((d) => (inDivision(d) > 0 ? [[d.id, { action: "move", to: null } satisfies Fate]] : []))),
  );
  const [headOutcome, setHeadOutcome] = useState<HeadOutcome | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const others = structure.departments.filter((d) => d.id !== department.id);
  const { head } = department;

  const sent: DivisionFate[] = department.divisions.flatMap((d): DivisionFate[] => {
    const fate = fates[d.id];
    if (!fate) return [];
    if (fate.action === "close") return [{ divisionId: d.id, action: "close" }];
    return fate.to === null ? [] : [{ divisionId: d.id, action: "move", to: fate.to }];
  });
  const planned = planDepartmentClose({
    actor: { kind: "team" },
    org: orgOf(structure),
    departmentId: department.id,
    close: { divisions: sent, head: headOutcome },
    inIt: Object.fromEntries(department.divisions.map((d) => [d.id, inDivision(d)])),
    headIds: head ? [head.id] : [],
  });

  const confirm = () =>
    startTransition(async () => {
      const result = await closeDepartment(department.id, { divisions: sent, head: headOutcome });
      if (!result.ok) {
        toast.error("Could not close the department", { description: result.error });
        return;
      }
      toast.success(`${department.name} Department is closed`);
      setConfirming(false);
      onClose();
    });

  const nameOf = (id: number) => others.find((d) => d.id === id)?.name ?? "";
  const lines = sent.map((f) => {
    const label = divisionLabel(department.divisions.find((d) => d.id === f.divisionId)?.name ?? "");
    return f.action === "move" ? `${label} moves to ${nameOf(f.to)}, with its people, leads and open positions.` : `${label} closes, and its open positions close.`;
  });
  if (head && headOutcome === "advisor") lines.push(`${head.name} stops being Head of ${department.name} and stays on the team as an Advisor, in no department or division; their access ends.`);
  if (head && headOutcome === "leave") lines.push(`${head.name} leaves the team: every role they hold ends and they move to Alumni.`);

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={`Close ${department.name} Department`}
      detail={departmentDetail(department)}
      footer={
        <>
          <button type="button" onClick={onClose} className={PANEL_GHOST_BUTTON}>
            Cancel
          </button>
          <button type="button" onClick={() => setConfirming(true)} disabled={!planned.ok || pending} className={DANGER_FILLED}>
            Close department
          </button>
        </>
      }
    >
      <PanelBody>
        <p className="text-[14px] leading-relaxed text-prt-text">
          {head ? "Choose what happens to each division and to the head." : "Choose what happens to each division."} A division with people in it can only move.
        </p>
        {department.divisions.length > 0 && (
          <section className="mt-6">
            <h3 className={SECTION_LABEL}>
              Divisions
              <span className="ml-1.5 text-prt-muted">{department.divisions.length}</span>
            </h3>
            <ul className="mt-2.5 flex flex-col gap-3">
              {department.divisions.map((division) => (
                <FateCard
                  key={division.id}
                  division={division}
                  fate={fates[division.id] ?? null}
                  departments={others}
                  onChange={(fate) => setFates((current) => ({ ...current, [division.id]: fate }))}
                />
              ))}
            </ul>
          </section>
        )}
        {head && (
          <section className="mt-6">
            <h3 className={SECTION_LABEL}>
              Head
              <span className="ml-1.5 text-prt-muted">1</span>
            </h3>
            <div className="mt-2.5 rounded-xl border border-hairline p-3.5">
              <div className="flex items-center gap-3">
                <span aria-hidden className={CODE_BOX}>
                  {initialsOf(head.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-prt-text">{head.name}</span>
                <span className="shrink-0 text-[13px] text-prt-muted">Head of {department.name}</span>
              </div>
              <div role="group" aria-label={`What happens to ${head.name}`} className="mt-3 flex rounded-lg border border-hairline bg-panel/60 p-0.5">
                <button type="button" aria-pressed={headOutcome === "advisor"} onClick={() => setHeadOutcome("advisor")} className={choiceClass(headOutcome === "advisor")}>
                  Become an advisor
                </button>
                <button type="button" aria-pressed={headOutcome === "leave"} onClick={() => setHeadOutcome("leave")} className={choiceClass(headOutcome === "leave")}>
                  Leave the team
                </button>
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-prt-muted">
                Pick one before you close. Become an advisor: stays in the team with the Advisor role, in no department or division; their access ends. Leave the
                team: moves to Alumni.
              </p>
            </div>
          </section>
        )}
      </PanelBody>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        icon={<Building2 className="h-5 w-5" strokeWidth={1.75} />}
        danger
        title={`Close ${department.name} Department?`}
        description={
          <>
            <p>A closed department cannot be reopened.</p>
            {lines.length > 0 && (
              <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5">
                {lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </>
        }
        cancelLabel="Back"
        confirmLabel="Close department"
        pending={pending}
        onConfirm={confirm}
      />
    </SidePanel>
  );
}

/** One division on Close department (board 77f): Move to another department, or Close it when nobody is in it. */
function FateCard({
  division,
  fate,
  departments,
  onChange,
}: {
  division: StructureDivision;
  fate: Fate | null;
  departments: readonly StructureDepartment[];
  onChange: (fate: Fate) => void;
}) {
  const count = inDivision(division);
  const full = count > 0;
  const help = full
    ? `${peopleLine(count)} in it, so it can't close. Its people, leads and open positions move with it.`
    : fate?.action === "close"
      ? "No one is in it. Closing it also closes its open positions."
      : fate?.action === "move"
        ? "No one is in it. Its open positions move with it."
        : "No one is in it, so it can move or close.";
  return (
    <li className="rounded-xl border border-hairline p-3.5">
      <div className="flex items-center gap-3">
        {division.code !== null && <span className={CODE_BOX}>{division.code}</span>}
        <span className="min-w-0 flex-1 truncate text-[14px] text-prt-text">{division.name}</span>
        <span className="shrink-0 text-[13px] text-prt-muted">{full ? peopleLine(count) : "Empty"}</span>
      </div>
      <div role="group" aria-label={`What happens to ${division.name}`} className="mt-3 flex rounded-lg border border-hairline bg-panel/60 p-0.5">
        <button type="button" aria-pressed={fate?.action === "move"} onClick={() => onChange({ action: "move", to: fate?.action === "move" ? fate.to : null })} className={choiceClass(fate?.action === "move")}>
          Move to another department
        </button>
        <button type="button" aria-pressed={fate?.action === "close"} disabled={full} onClick={() => onChange({ action: "close" })} className={choiceClass(fate?.action === "close")}>
          {full && <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
          Close it
        </button>
      </div>
      {fate?.action === "move" && (
        <span className="relative mt-3 block">
          <select
            aria-label={`Department ${division.name} moves to`}
            value={fate.to ?? ""}
            onChange={(e) => onChange({ action: "move", to: e.target.value === "" ? null : Number(e.target.value) })}
            className={`${inputClass()} cursor-pointer appearance-none pr-10 ${fate.to === null ? "text-prt-muted" : ""}`}
          >
            <option value="" disabled className="bg-panel text-prt-muted">
              Pick a department
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id} className="bg-panel text-prt-text">
                {d.name} Department
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
        </span>
      )}
      <p className="mt-2.5 text-[12px] leading-relaxed text-prt-muted">{help}</p>
    </li>
  );
}
