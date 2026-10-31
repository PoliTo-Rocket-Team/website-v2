"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Building2, ChevronDown, Pencil, RefreshCw, Repeat, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { addDepartmentHead, closeDepartment, createDepartment, saveDepartment } from "@/app/dashboard/team-actions";
import {
  departmentCodeError,
  departmentNameError,
  destinationName,
  normalizeDepartmentCode,
  PICK_REPLACED_HEAD,
  planDepartmentClose,
  stepsDown,
  storedDepartmentName,
  type ClosingPerson,
  type DestinationRole,
  type PersonMove,
} from "@/lib/dashboard/department-edit";
import {
  advisorInDestinationDetail,
  BECOME_AN_ADVISOR,
  fullAccessMovesLine,
  movesWithAdvisorRoleLine,
  seatOfHandedRole,
  steppingDown,
  steppingDownLine,
  type HandOverOutcome,
  type Unit,
} from "@/lib/dashboard/hand-over";
import type { TeamPick } from "@/lib/dashboard/division-edit";
import { defaultHeadTitle, divisionLabel, type OrgChart } from "@/lib/dashboard/team";
import { departmentLabel } from "@/lib/dashboard/recruitment";
import { andList, type StructureDepartment, type StructureDivision, type TeamStructure } from "@/lib/dashboard/team-structure";
import { AddHolderLink, AddHolderPicker } from "./add-holder";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { PeoplePicker } from "./division-drawer";
import { MenuItem, RowMenu } from "./division-members";
import { PANEL_DANGER_BUTTON, PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON, PanelBody, SidePanel } from "./drawer";
import { inputClass } from "./field";
import { FooterSummary, useFormSummary } from "./form-summary";
import { HandOverChoice, RadioChoice } from "./hand-over-choice";

// New department (board 77d), Edit department (77e) and Close department
// (77f, reworked by issue #441), on the Team tree's edit view (issue #251).
// Only the team leader and full access open them. Each save asks "are you
// sure" first, and the server checks every rule again
// (lib/dashboard/department-edit.ts). Change head in Edit department hands
// the head role over (issue #253): the head replaced becomes an advisor in
// the department or leaves the team. Add another holder beside it gives the
// department one more head (epic #861, issue #869). With several heads, each
// head's row names its own Replace, which hands over that head's role alone:
// every other head stays (issue #872).

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const ADD_LINK = `inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${FOCUS}`;
const LIST = "overflow-hidden rounded-xl border border-hairline";
const SECTION_LABEL = "text-[13px] text-prt-text";
const CODE_BOX = "inline-flex h-6 shrink-0 items-center rounded-md border border-hairline bg-white-5 px-1.5 font-mono text-[11px] font-medium tracking-[0.08em] text-prt-text";
/** The red footer button that closes the department (board 77f): filled, and muted until every person has a destination. */
const DANGER_FILLED = `inline-flex h-11 items-center justify-center rounded-full bg-danger px-4 text-[14px] font-semibold text-prt-text transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`;

/** Which department panel is open: New department, or Edit department and its Close department step. */
export type DepartmentDrawerTarget =
  | { readonly kind: "new" }
  | { readonly kind: "edit"; readonly departmentId: number }
  | { readonly kind: "close"; readonly departmentId: number };

/** The chart the edit view shows, as the department rules read it. */
function orgOf(structure: TeamStructure): OrgChart {
  return {
    departments: structure.departments.map((d) => ({ id: d.id, name: d.name, code: d.code, kind: d.kind })),
    divisions: structure.departments.flatMap((d) => d.divisions.map((v) => ({ id: v.id, name: v.name, departmentId: d.id, code: v.code }))),
  };
}

function peopleLine(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

/** "Head Chiara Rinaldi · 2 divisions · 24 people" under the panel title (boards 77e, 77f); "Heads A and B" for several. */
function departmentDetail(department: StructureDepartment): string {
  const divisions = department.divisions.length;
  const { heads } = department;
  return [
    heads.length > 0 ? `${heads.length > 1 ? "Heads" : "Head"} ${andList(heads.map((h) => h.name))}` : null,
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
  onAddDivision,
}: {
  target: DepartmentDrawerTarget | null;
  structure: TeamStructure;
  onClose: () => void;
  onTarget: (target: DepartmentDrawerTarget) => void;
  /** New division under the department: Edit department's "+ Add division" (issue #927). */
  onAddDivision: (departmentId: number) => void;
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
    <EditDepartment key={`e${department.id}`} open={open} department={department} structure={structure} onClose={onClose} onCloseDepartment={() => onTarget({ kind: "close", departmentId: department.id })}
      onAddDivision={() => onAddDivision(department.id)}
    />
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
  // An empty code shows its error once a click was refused (issue #927); a typed one shows it at once.
  const codeShown = codeError !== null && (code !== "" || showErrors);
  return (
    <>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <label className="min-w-0">
          <span className={`mb-2 block ${SECTION_LABEL}`}>Name</span>
          <input
            name="name"
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
            name="code"
            value={code}
            maxLength={3}
            autoComplete="off"
            placeholder="PR"
            onChange={(e) => onCode(e.target.value.toUpperCase())}
            aria-invalid={codeShown}
            className={`${inputClass(codeShown ? (codeError ?? undefined) : undefined)} font-mono uppercase tracking-[0.15em]`}
          />
        </label>
      </div>
      {showErrors && nameError !== null && <p className="mt-1.5 text-[12px] text-danger">{nameError}</p>}
      {codeShown ? (
        <p className="mt-2 text-[12px] text-danger">{codeError}</p>
      ) : (
        <p className="mt-2 text-[12px] text-prt-muted">2–3 letters, like AE.</p>
      )}
    </>
  );
}

/**
 * Board 77d: the name, a 2 or 3 letter code, and its one head, picked from
 * the team. Where the head shows on the Team page is set in the Team page
 * editor's department groups, not here (issue #856).
 */
function NewDepartment({ open, structure, onClose }: { open: boolean; structure: TeamStructure; onClose: () => void }) {
  const [name, setName] = useState("");
  const [rawCode, setCode] = useState("");
  const [head, setHead] = useState<TeamPick | null>(null);
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const code = normalizeDepartmentCode(rawCode);
  const nameError = departmentNameError(name);
  const codeError = rawCode.trim() === "" ? "Write a code." : departmentCodeError(code, structure.departments, null);
  const headError = head === null ? "Pick the head." : null;
  const stored = storedDepartmentName(name);
  const { summary, showErrors, check, refuse } = useFormSummary([
    { name: "name", label: "Name", error: nameError ?? undefined },
    { name: "code", label: "Code", error: codeError ?? undefined },
    { name: "head", label: "Head", error: headError ?? undefined },
  ], { open, values: [name, rawCode, head] });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (check(e.currentTarget)) setConfirming(true);
  };

  const confirm = () =>
    startTransition(async () => {
      if (!head) return;
      const result = await createDepartment({ name, code, heads: [head.id] });
      if (!result.ok) {
        // Shown above Create department, where the form's own errors show (issue #927).
        refuse(`Could not create the department. ${result.error}`);
        setConfirming(false);
        return;
      }
      toast.success(`${departmentLabel(stored)} is open`);
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
          <FooterSummary summary={summary} />
          <button type="button" onClick={onClose} className={PANEL_GHOST_BUTTON}>
            Cancel
          </button>
          <button type="submit" form="new-department-form" disabled={pending} className={PANEL_PRIMARY_BUTTON}>
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
                  <Avatar size="md" person={head} />
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
                name="head"
                short={stored === "" ? "the new department" : stored}
                taken={() => null}
                onPick={(p) => {
                  setHead(p);
                  setPicking(false);
                }}
                onClose={() => setPicking(false)}
              />
            ) : (
              head === null && (
                <button type="button" name="head" onClick={() => setPicking(true)} className={`${ADD_LINK} mt-3`}>
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
        title={`Create ${departmentLabel(stored)}?`}
        description={`It opens with the code ${code}. ${head?.name ?? "The head"} becomes its head and keeps their divisions.`}
        cancelLabel="Back"
        confirmLabel="Create department"
        pending={pending}
        onConfirm={confirm}
      />
    </SidePanel>
  );
}

/** "also in Mission Analysis, Optimization" beside a head; null for a head in no division. */
function alsoIn(divisions: readonly string[]): string | null {
  return divisions.length > 0 ? `also in ${divisions.join(", ")}` : null;
}

function PlusIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

/** Board 77e: name and code, the head, and the divisions as read-only rows with Add division under them; Close department and Save changes. */
function EditDepartment({
  open,
  department,
  structure,
  onClose,
  onCloseDepartment,
  onAddDivision,
}: {
  open: boolean;
  department: StructureDepartment;
  structure: TeamStructure;
  onClose: () => void;
  onCloseDepartment: () => void;
  /** "+ Add division" in the Divisions section, as on the department's box in the tree: New division under it (issue #927). */
  onAddDivision: () => void;
}) {
  const [name, setName] = useState(department.name);
  const [rawCode, setCode] = useState(department.code ?? "");
  const [confirming, setConfirming] = useState(false);
  const [openDivision, setOpenDivision] = useState<number | null>(department.divisions[0]?.id ?? null);
  const [newHead, setNewHead] = useState<TeamPick | null>(null);
  const [picking, setPicking] = useState(false);
  const [headOutcome, setHeadOutcome] = useState<HandOverOutcome | null>(null);
  const [addingHead, setAddingHead] = useState(false);
  const [pending, startTransition] = useTransition();
  const { heads } = department;
  const severalHeads = heads.length > 1;
  // Change head replaces one head (issue #872): the only one, or the one whose Replace was pressed; every other head stays.
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const head = heads.find((h) => h.id === replacingId) ?? (severalHeads ? null : (heads[0] ?? null));
  const staying = head === null ? [] : heads.filter((h) => h.id !== head.id).map((h) => h.name);
  // The full-access seat the head role carries moves with it on Change head (issue #501).
  const headSeat = head === null ? null : seatOfHandedRole(structure.seats, head.id, { kind: "head", departmentId: department.id });

  const code = normalizeDepartmentCode(rawCode);
  const nameError = departmentNameError(name);
  const codeError = rawCode.trim() === "" ? "Write a code." : departmentCodeError(code, structure.departments, department.id);
  const headError =
    newHead !== null && head === null && severalHeads
      ? PICK_REPLACED_HEAD
      : newHead !== null && head !== null && headOutcome === null
        ? `Choose what happens to ${head.name}: Become an advisor or Leave the team.`
        : null;
  const stored = storedDepartmentName(name);
  const nameChanged = stored !== department.name;
  const codeChanged = code !== normalizeDepartmentCode(department.code ?? "");
  const { summary, showErrors, check, refuse } = useFormSummary([
    { name: "name", label: "Name", error: nameError ?? undefined },
    { name: "code", label: "Code", error: codeError ?? undefined },
    { name: `head-${department.id}`, label: "Head", error: headError ?? undefined },
  ], { open, values: [name, rawCode, newHead, headOutcome, replacingId] });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!check(e.currentTarget)) return;
    if (!nameChanged && !codeChanged && newHead === null) {
      onClose();
      return;
    }
    setConfirming(true);
  };

  const undoHead = () => {
    setNewHead(null);
    setHeadOutcome(null);
    setReplacingId(null);
  };

  const replaceHead = (headId: number) => {
    setReplacingId(headId);
    setAddingHead(false);
    setPicking(true);
  };

  const confirm = () =>
    startTransition(async () => {
      const result = await saveDepartment(department.id, {
        name,
        code,
        head: newHead === null ? null : { to: newHead.id, from: head?.id ?? null, outcome: headOutcome },
      });
      if (!result.ok) {
        // Shown above Save changes, where the form's own errors show (issue #927).
        refuse(`Could not save the department. ${result.error}`);
        setConfirming(false);
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
  if (newHead !== null) lines.push(`${newHead.name} becomes Head of ${stored} and keeps their divisions.`);
  if (newHead !== null && head !== null && headOutcome !== null) {
    const step = steppingDown({ kind: "head", departmentId: department.id }, headOutcome);
    lines.push(`${head.name} ${steppingDownLine(step, stored)}.`);
    const access = fullAccessMovesLine({ seat: headSeat, successor: newHead.name, from: head.name, step });
    if (access !== null) lines.push(access);
    if (staying.length > 0) lines.push(`${andList(staying)} ${staying.length === 1 ? "stays" : "stay"} head of ${stored}.`);
  }
  const leaving = newHead !== null && headOutcome === "leave";

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={departmentLabel(department.name)}
      titleWraps
      detail={departmentDetail(department)}
      footer={
        <>
          <FooterSummary summary={summary} />
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
            <h3 className={SECTION_LABEL}>
              {heads.length > 1 ? "Heads" : "Head"}
              {heads.length > 1 && <span className="ml-1.5 text-prt-muted">{heads.length}</span>}
            </h3>
            {newHead === null ? (
              severalHeads ? (
                <ul className={`${LIST} mt-2.5 divide-y divide-hairline`}>
                  {heads.map((h) => {
                    const also = alsoIn(h.divisions);
                    return (
                      <li key={h.id} className="flex items-center gap-3 px-3.5 py-2.5">
                        <Avatar size="md" accent person={h} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] text-prt-text">{h.name}</span>
                          {also !== null && <span className="block truncate text-[12px] text-prt-muted">{also}</span>}
                        </span>
                        <RowMenu label={`Actions for ${h.name}`}>
                          <MenuItem onSelect={() => replaceHead(h.id)} icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />} detail="The other heads stay">
                            Replace {h.name}
                          </MenuItem>
                        </RowMenu>
                      </li>
                    );
                  })}
                </ul>
              ) : head ? (
                <div className={`${LIST} mt-2.5 flex items-center gap-3 px-3.5 py-3`}>
                  <Avatar size="md" accent person={head} />
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="shrink-0 text-[15px] text-prt-text">{head.name}</span>
                    {head.divisions.length > 0 && <span className="truncate text-[12px] text-prt-muted">{alsoIn(head.divisions)}</span>}
                  </span>
                </div>
              ) : (
                <p className={`${LIST} mt-2.5 px-4 py-3 text-center text-[13px] text-prt-muted`}>No head</p>
              )
            ) : (
              <ul className={`${LIST} mt-2.5 divide-y divide-hairline`}>
                {heads.map((h) =>
                  h.id === head?.id ? (
                    <li key={h.id} className="flex items-center gap-3 px-3.5 py-2.5 opacity-60">
                      <Avatar size="md" person={h} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] text-prt-text">{h.name}</span>
                        <span className="block truncate text-[12px] text-prt-muted">Replaced by {newHead.name}</span>
                      </span>
                    </li>
                  ) : (
                    <li key={h.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <Avatar size="md" accent person={h} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] text-prt-text">{h.name}</span>
                        <span className="block truncate text-[12px] text-prt-muted">Stays head</span>
                      </span>
                    </li>
                  ),
                )}
                <li className="flex items-center gap-3 bg-accent/[0.05] px-3.5 py-2.5">
                  <Avatar size="md" person={newHead} />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[14px] text-prt-text">{newHead.name}</span>
                      <span className="inline-flex h-[18px] shrink-0 items-center rounded bg-accent-soft px-1.5 text-[11px] font-medium text-accent">New</span>
                    </span>
                    <span className="block truncate text-[12px] text-prt-muted">{newHead.place === null ? "In no division yet" : `Keeps ${newHead.place}`}</span>
                  </span>
                  <button
                    type="button"
                    onClick={undoHead}
                    aria-label={`Undo picking ${newHead.name}`}
                    className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[13px] text-text-2 transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
                  >
                    <Undo2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Undo
                  </button>
                </li>
              </ul>
            )}
            {addingHead ? (
              <AddHolderPicker
                mode="head"
                seat={defaultHeadTitle(department.name)}
                short={department.name}
                holders={heads}
                save={(personId) => addDepartmentHead(department.id, { personId })}
                onCancel={() => setAddingHead(false)}
                onSaved={onClose}
              />
            ) : picking ? (
              <>
                {severalHeads && head !== null && (
                  <p className="mt-3 text-[13px] text-text-2">
                    Who takes over from {head.name}? {andList(staying)} {staying.length === 1 ? "stays" : "stay"} head.
                  </p>
                )}
                <PeoplePicker
                  mode="head"
                  short={stored}
                  taken={(p) => (heads.some((h) => h.id === p.id) ? "Heads it now" : null)}
                  onPick={(p) => {
                    setNewHead(p);
                    setPicking(false);
                  }}
                  onClose={() => {
                    setPicking(false);
                    if (newHead === null) setReplacingId(null);
                  }}
                />
              </>
            ) : (
              newHead === null && (
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  {!severalHeads && (
                    <button type="button" onClick={() => setPicking(true)} className={ADD_LINK}>
                      <Repeat aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      {head ? "Change head" : "Pick head"}
                    </button>
                  )}
                  {heads.length > 0 && (
                    <AddHolderLink
                      onClick={() => {
                        setAddingHead(true);
                        setPicking(false);
                      }}
                    />
                  )}
                </div>
              )
            )}
            {newHead !== null && head !== null && (
              <div className="mt-5">
                <HandOverChoice
                  name={`head-${department.id}`}
                  person={head.name}
                  handed={{ kind: "head", departmentId: department.id }}
                  unit={stored}
                  value={headOutcome}
                  leave={{ allowed: true }}
                  seat={headSeat}
                  successor={newHead.name}
                  onChange={setHeadOutcome}
                />
              </div>
            )}
            {showErrors && headError !== null && <p className="mt-2 text-[12px] text-danger">{headError}</p>}
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
            {/* Shown under the same rule as the department box's Add division (issue #927). */}
            {department.divisionsEditable && (
              <button type="button" onClick={onAddDivision} className={`${ADD_LINK} mt-3`}>
                <PlusIcon />
                Add division
              </button>
            )}
          </section>
        </PanelBody>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        icon={<Pencil className="h-5 w-5" strokeWidth={1.75} />}
        tone={leaving ? "danger" : "accent"}
        danger={leaving}
        title={`Save changes to ${departmentLabel(department.name)}?`}
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
              <Avatar size="sm" accent={p.role === "lead"} person={p} />
              <span className="truncate text-[14px] text-prt-text">{p.name}</span>
              {p.role === "lead" && <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Lead</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** One person's picks on Close department: where they go and, for a former head or lead, their role there. Nothing at first. */
type Pick = { readonly to: Unit | null; readonly role: DestinationRole | null };

const NOTHING_PICKED: Pick = { to: null, role: null };

/** A destination as a select's value: "department:2", "division:7". */
function unitKey(unit: Unit): string {
  return unit.kind === "department" ? `department:${unit.departmentId}` : `division:${unit.divisionId}`;
}

function unitOfKey(key: string): Unit | null {
  const [kind, id] = key.split(":");
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  return kind === "department" ? { kind: "department", departmentId: n } : kind === "division" ? { kind: "division", divisionId: n } : null;
}

function holdsUnit(person: ClosingPerson, unit: Unit): boolean {
  return person.holds.some((u) => unitKey(u) === unitKey(unit));
}

/** What Close department names each person as, beside their name: the head by their stored title. */
function standingLabel(person: ClosingPerson): string {
  switch (person.standing) {
    case "head":
      return person.title;
    case "lead":
      return "Division Lead";
    case "advisor":
      return "Advisor";
    case "member":
      return "Member";
  }
}

const SELECT = `${inputClass()} cursor-pointer appearance-none pr-10`;

/**
 * Close department (Owner decision, 2026-10-19): the department and every
 * division in it close, and every person in it moves to a division picked
 * for them, one each, with "Move everyone to…" to pick one
 * for all at once. A former head or lead picks Advisor or member there.
 * Nobody leaves the team from here. Nothing is picked at first (Owner
 * decision, 2026-10-16), so Close department stays disabled until every
 * person has a destination and every former head and lead a role.
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
  const [picks, setPicks] = useState<Readonly<Record<number, Pick>>>({});
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const others = structure.departments.filter((d) => d.id !== department.id);
  const org = orgOf(structure);
  const people = department.closing;
  const pickOf = (id: number) => picks[id] ?? NOTHING_PICKED;
  const setPick = (id: number, pick: Pick) => setPicks((current) => ({ ...current, [id]: pick }));

  const sent: PersonMove[] = people.flatMap((p): PersonMove[] => {
    const { to, role } = pickOf(p.id);
    return to === null ? [] : [{ personId: p.id, to, role: stepsDown(p.standing) ? role : null }];
  });
  const planned = planDepartmentClose({
    actor: { kind: "team" },
    org,
    departmentId: department.id,
    close: { people: sent },
    people,
    waiting: Object.fromEntries(department.divisions.map((d) => [d.id, d.page?.waiting.length ?? 0])),
  });

  /** "Move everyone to…": the same division for everyone who is not in it already; each role stays as picked. */
  const moveEveryone = (unit: Unit) =>
    setPicks((current) => Object.fromEntries(people.map((p) => [p.id, holdsUnit(p, unit) ? (current[p.id] ?? NOTHING_PICKED) : { ...(current[p.id] ?? NOTHING_PICKED), to: unit }])));

  const confirm = () =>
    startTransition(async () => {
      const result = await closeDepartment(department.id, { people: sent });
      if (!result.ok) {
        toast.error("Could not close the department", { description: result.error });
        return;
      }
      toast.success(`${departmentLabel(department.name)} is closed`);
      setConfirming(false);
      onClose();
    });

  const nameOf = (id: number) => people.find((p) => p.id === id)?.name ?? "";
  const openPositions = department.divisions.reduce((sum, d) => sum + d.openPositions, 0);
  const lines: string[] = [];
  if (department.divisions.length > 0) {
    const closing = department.divisions.map((d) => divisionLabel(d.name)).join(", ");
    lines.push(`${closing} ${department.divisions.length === 1 ? "closes" : "close"} with it${openPositions > 0 ? `, and ${openPositions} open ${openPositions === 1 ? "position closes" : "positions close"}` : ""}.`);
  }
  if (planned.ok) {
    for (const move of planned.value.moves) {
      const where = destinationName(move.to, org, department.id) ?? "";
      lines.push(
        move.becomes.kind === "advisor"
          ? `${nameOf(move.personId)} ${movesWithAdvisorRoleLine(where, move.becomes.access === "ends")}.`
          : `${nameOf(move.personId)} moves to ${where} as a member.`,
      );
    }
  }

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={`Close ${departmentLabel(department.name)}`}
      titleWraps
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
          {people.length > 0
            ? "Every division closes with the department. Pick where each person goes; a former head or lead also picks their role there."
            : "Every division closes with the department. Nobody is in it."}
        </p>
        {department.divisions.length > 0 && (
          <section className="mt-6">
            <h3 className={SECTION_LABEL}>
              Divisions closing
              <span className="ml-1.5 text-prt-muted">{department.divisions.length}</span>
            </h3>
            <ul className={`${LIST} mt-2.5 divide-y divide-hairline`}>
              {department.divisions.map((division) => (
                <li key={division.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  {division.code !== null && <span className={CODE_BOX}>{division.code}</span>}
                  <span className="min-w-0 flex-1 truncate text-[14px] text-prt-text">{division.name}</span>
                  {division.openPositions > 0 && (
                    <span className="shrink-0 text-[13px] text-prt-muted">
                      {division.openPositions} open {division.openPositions === 1 ? "position" : "positions"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {people.length > 0 && (
          <section className="mt-6">
            <h3 className={SECTION_LABEL}>
              People
              <span className="ml-1.5 text-prt-muted">{people.length}</span>
            </h3>
            <DestinationSelect
              label="Move everyone to"
              placeholder="Move everyone to…"
              value={null}
              departments={others}
              taken={() => false}
              onChange={moveEveryone}
              className="mt-2.5"
            />
            <ul className="mt-3 flex flex-col gap-3">
              {people.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  pick={pickOf(person.id)}
                  departments={others}
                  destination={(unit) => destinationName(unit, org, department.id)}
                  onChange={(pick) => setPick(person.id, pick)}
                />
              ))}
            </ul>
          </section>
        )}
        {!planned.ok && <p className="mt-4 text-[12px] leading-relaxed text-prt-muted">{planned.error}</p>}
      </PanelBody>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        icon={<Building2 className="h-5 w-5" strokeWidth={1.75} />}
        danger
        title={`Close ${departmentLabel(department.name)}?`}
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

/**
 * A destination picker on Close department: every open division outside the
 * closing department, grouped by department; a department itself is never a
 * destination (Owner decision, 2026-10-21). A unit `taken` names is listed
 * but cannot be picked.
 */
function DestinationSelect({
  label,
  placeholder,
  value,
  departments,
  taken,
  onChange,
  className = "",
}: {
  label: string;
  placeholder: string;
  value: Unit | null;
  departments: readonly StructureDepartment[];
  taken: (unit: Unit) => boolean;
  onChange: (unit: Unit) => void;
  className?: string;
}) {
  const option = (unit: Unit, text: string) => {
    const held = taken(unit);
    return (
      <option key={unitKey(unit)} value={unitKey(unit)} disabled={held} className="bg-panel text-prt-text">
        {held ? `${text} (already in it)` : text}
      </option>
    );
  };
  return (
    <span className={`relative block ${className}`}>
      <select
        aria-label={label}
        value={value === null ? "" : unitKey(value)}
        onChange={(e) => {
          const unit = unitOfKey(e.target.value);
          if (unit !== null) onChange(unit);
        }}
        className={`${SELECT} ${value === null ? "text-prt-muted" : ""}`}
      >
        <option value="" disabled className="bg-panel text-prt-muted">
          {placeholder}
        </option>
        {departments.map((d) => (
          <optgroup key={d.id} label={departmentLabel(d.name)} className="bg-panel text-prt-muted">
            {d.divisions.map((v) => option({ kind: "division", divisionId: v.id }, divisionLabel(v.name)))}
          </optgroup>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
    </span>
  );
}

/**
 * One person on Close department: where they go and, for a former head or
 * lead, their role there, Become an advisor or Member, neither picked at
 * first. A member goes to a division; an advisor keeps the Advisor role,
 * which may sit on a department.
 */
function PersonCard({
  person,
  pick,
  departments,
  destination,
  onChange,
}: {
  person: ClosingPerson;
  pick: Pick;
  departments: readonly StructureDepartment[];
  destination: (unit: Unit) => string | null;
  onChange: (pick: Pick) => void;
}) {
  const choosesRole = stepsDown(person.standing);
  const where = pick.to === null ? null : destination(pick.to);
  return (
    <li className="rounded-xl border border-hairline p-3.5">
      <div className="flex items-center gap-3">
        <Avatar size="sm" accent={choosesRole} person={person} />
        <span className="min-w-0 flex-1 truncate text-[14px] text-prt-text">{person.name}</span>
        <span className="shrink-0 text-[13px] text-prt-muted">{standingLabel(person)}</span>
      </div>
      <DestinationSelect
        label={`Where ${person.name} goes`}
        placeholder="Pick where they go"
        value={pick.to}
        departments={departments}
        taken={(unit) => holdsUnit(person, unit)}
        onChange={(to) => onChange({ ...pick, to })}
        className="mt-3"
      />
      {choosesRole && (
        <div className="mt-3">
          <RadioChoice<DestinationRole>
            name={`close-role-${person.id}`}
            legend={`${person.name.split(" ")[0] ?? person.name}'s role there`}
            value={pick.role}
            onChange={(role) => onChange({ ...pick, role })}
            options={[
              { value: "advisor", title: BECOME_AN_ADVISOR, detail: advisorInDestinationDetail(where ?? "the division you pick") },
              { value: "member", title: "Member", detail: `Joins ${where ?? "the division you pick"} as a member` },
            ]}
          />
        </div>
      )}
      {person.standing === "advisor" && where !== null && (
        <p className="mt-2.5 text-[12px] leading-relaxed text-prt-muted">Keeps the Advisor role there.</p>
      )}
    </li>
  );
}
