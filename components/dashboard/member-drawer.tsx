"use client";

import { useId, useState, useTransition } from "react";
import { ArrowUpRight, ChevronDown, GraduationCap, Info, Pencil } from "lucide-react";
import { toast } from "sonner";
import { DialogClose } from "@/components/ui/dialog";
import { moveToAlumni, promote, saveMember } from "@/app/dashboard/team-actions";
import {
  canPromote,
  checkDeparture,
  LEAVE_REASONS,
  LEAVE_REASON_LABELS,
  yearsLabel,
  type EditableRole,
  type MemberDirectory,
  type MemberRow,
  type PromoteMode,
} from "@/lib/dashboard/team";
import { shortUnitName } from "@/lib/dashboard/division-access";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON, PanelBody, SidePanel } from "./drawer";
import { inputClass } from "./field";
import { GHOST_PILL } from "./page-header";

// The member panel (board 59b): who the person is, the role the Team page
// shows under their name, Promote, and moving them to Alumni. Access is not
// here: the Access page is the only place it is given or removed. The
// operations lead's panel also sets whether the person leads their division
// (board 46b). Where the data source stores no Team page writes, or the row
// is the viewer's own, it shows the same facts with nothing to change.

const ROLE_OPTIONS: readonly { value: EditableRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "division-lead", label: "Division lead" },
];

const LABEL = "mb-2 block text-[14px] font-medium text-prt-text";

export function MemberDrawer({
  row,
  directory,
  editable,
  onClose,
}: {
  row: MemberRow | null;
  directory: MemberDirectory;
  editable: boolean;
  onClose: () => void;
}) {
  // The panel keeps showing the last person while it closes.
  const [shown, setShown] = useState<MemberRow | null>(row);
  if (row !== null && row !== shown) setShown(row);
  const person = row ?? shown;
  return person === null ? null : (
    <MemberPanel key={person.id} open={row !== null} row={person} directory={directory} editable={editable && !person.self} onClose={onClose} />
  );
}

function editableRoleOf(row: MemberRow): EditableRole | null {
  if (row.role === "member") return row.division === null ? null : "member";
  return row.role === "division-lead" ? "division-lead" : null;
}

function MemberPanel({
  open,
  row,
  directory,
  editable,
  onClose,
}: {
  open: boolean;
  row: MemberRow;
  directory: MemberDirectory;
  editable: boolean;
  onClose: () => void;
}) {
  const startRole = editableRoleOf(row);
  const [role, setRole] = useState<EditableRole | null>(startRole);
  const [title, setTitle] = useState(row.pageTitle ?? "");
  const [asking, setAsking] = useState<"promote" | "alumni" | null>(null);
  const [pending, startTransition] = useTransition();
  const titleId = useId();
  const firstName = row.name.split(" ")[0];
  const facts = [row.program, row.study, `joined ${row.joined}`].filter(Boolean).join(" · ");
  const division = directory.scope === "division";

  const save = () =>
    startTransition(async () => {
      const result = await saveMember(row.id, division ? null : role, title.trim() === "" ? null : title);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Saved ${row.name}`);
      onClose();
    });

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Member"
      footer={
        editable ? (
          <>
            <DialogClose className={PANEL_GHOST_BUTTON}>Cancel</DialogClose>
            <button type="button" onClick={save} disabled={pending} className={PANEL_PRIMARY_BUTTON}>
              Save
            </button>
          </>
        ) : (
          <DialogClose className={`${PANEL_GHOST_BUTTON} col-span-2`}>Close</DialogClose>
        )
      }
    >
      <PanelBody className="flex flex-col">
        <div className="flex items-center gap-4">
          <Avatar name={row.name} size="xl" accent={row.role !== "member"} />
          <div className="min-w-0">
            <p className="truncate text-[18px] font-semibold">{row.name}</p>
            <p className="truncate text-[13px] text-prt-muted">{row.email}</p>
            <p className="text-[12px] text-prt-muted">{facts}</p>
          </div>
        </div>

        <div className="mt-7">
          <label htmlFor={titleId} className={LABEL}>
            Role
            <span className="ml-1.5 font-normal text-prt-muted">shown on the Team page</span>
          </label>
          <div className="relative">
            <input
              id={titleId}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              readOnly={!editable}
              maxLength={80}
              className={`${inputClass()} pr-11 read-only:focus:border-white-10 read-only:focus:bg-white-5`}
            />
            {editable && (
              <Pencil aria-hidden className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
            )}
          </div>
        </div>

        {!division && editable && startRole !== null && (
          <div className="mt-6">
            <label className="relative block">
              <span className={LABEL}>Leads their division</span>
              <select
                value={role ?? "member"}
                onChange={(event) => setRole(event.target.value as EditableRole)}
                className={`${inputClass()} cursor-pointer appearance-none pr-10`}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-panel">
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute bottom-3.5 right-4 h-4 w-4 text-prt-muted" strokeWidth={1.75} />
            </label>
          </div>
        )}

        {division && editable && canPromote(row) && (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-hairline px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">Promote</p>
              <p className="text-[12px] text-prt-muted">Make {firstName} a division lead</p>
            </div>
            <button type="button" onClick={() => setAsking("promote")} className={GHOST_PILL}>
              <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Promote
            </button>
          </div>
        )}

        {editable && (
          <section className="mt-10 rounded-xl border border-danger/40 bg-danger/[0.06] p-4 md:mt-auto">
            <h2 className="text-[14px] font-semibold">Leaving the team</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-prt-muted">
              Moves {firstName} to Alumni with the years on the team. The account stays; dashboard access ends.
            </p>
            <button
              type="button"
              onClick={() => setAsking("alumni")}
              className="mt-4 inline-flex h-9 items-center rounded-full border border-danger/60 px-4 text-[13px] font-semibold text-danger transition-colors duration-300 ease-out hover:border-danger hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Move to alumni
            </button>
          </section>
        )}
      </PanelBody>

      {directory.scope === "division" && (
        <PromoteDialog
          open={asking === "promote"}
          onOpenChange={(next) => setAsking(next ? "promote" : null)}
          row={row}
          unit={shortUnitName(directory.division)}
          head={directory.head}
          onDone={onClose}
        />
      )}
      <AlumniDialog
        open={asking === "alumni"}
        onOpenChange={(next) => setAsking(next ? "alumni" : null)}
        row={row}
        unit={row.division === null ? null : shortUnitName(row.division)}
        onDone={onClose}
      />
    </SidePanel>
  );
}

const PROMOTE_OPTIONS: readonly { mode: PromoteMode; title: string; detail: (first: string, unit: string) => string }[] = [
  { mode: "together", title: "Lead together with you", detail: (_, unit) => `${unit} has two leads` },
  { mode: "hand-over", title: "Hand over the division", detail: (first) => `${first} leads; you become a member` },
];

/** Board 59e. The site sends no email: the lead tells the department head themselves. */
function PromoteDialog({
  open,
  onOpenChange,
  row,
  unit,
  head,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: MemberRow;
  unit: string;
  head: { name: string; department: string } | null;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<PromoteMode>("together");
  const [pending, startTransition] = useTransition();
  const firstName = row.name.split(" ")[0];

  const confirm = () =>
    startTransition(async () => {
      const result = await promote(row.id, mode);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${row.name} is now a division lead`);
      onOpenChange(false);
      onDone();
    });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={ArrowUpRight}
      title={`Promote ${row.name} to division lead?`}
      confirmLabel={`Promote ${firstName}`}
      pending={pending}
      onConfirm={confirm}
      body={
        <>
          <div role="radiogroup" aria-label="How they lead" className="flex flex-col gap-2.5">
            {PROMOTE_OPTIONS.map((option) => {
              const on = option.mode === mode;
              return (
                <label
                  key={option.mode}
                  className={`flex cursor-pointer items-center gap-3.5 rounded-xl border px-4 py-3 transition-colors duration-300 ease-out has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                    on ? "border-accent bg-accent/[0.08]" : "border-white-10 hover:border-border-strong"
                  }`}
                >
                  <input type="radio" name="promote-mode" checked={on} onChange={() => setMode(option.mode)} className="sr-only" />
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-accent" : "border-border-strong"}`}
                  >
                    {on && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-prt-text">{option.title}</span>
                    <span className="block text-[12px] text-prt-muted">{option.detail(firstName, unit)}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-4 flex items-start gap-2 text-[13px] text-text-2">
            <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
            {head
              ? `Email ${head.name}, head of ${head.department}, to tell them.`
              : "Email your department head to tell them."}
          </p>
        </>
      }
    >
      {firstName} gets the lead view for {unit}: positions, applications, members, access and orders.
    </ConfirmDialog>
  );
}

/** Board 59d: the years on the team and an optional reason. Access ends; the account stays. */
function AlumniDialog({
  open,
  onOpenChange,
  row,
  unit,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: MemberRow;
  unit: string | null;
  onDone: () => void;
}) {
  const thisYear = new Date().getFullYear();
  const [years, setYears] = useState(yearsLabel(Math.min(row.joined, thisYear), thisYear));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const yearsId = useId();
  const reasonId = useId();
  const firstName = row.name.split(" ")[0];

  const confirm = () => {
    const checked = checkDeparture({ years, reason }, thisYear);
    if (!checked.ok) return setError(checked.error);
    setError(undefined);
    startTransition(async () => {
      const result = await moveToAlumni(row.id, years, reason === "" ? null : reason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${row.name} moved to Alumni`);
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={GraduationCap}
      tone="danger"
      title={`Move ${row.name} to alumni?`}
      confirmLabel="Move to alumni"
      cancelLabel={`Keep ${firstName} on the team`}
      danger
      pending={pending}
      onConfirm={confirm}
      body={
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor={yearsId} className="mb-2 block text-[13px] text-prt-text">
              On the team
            </label>
            <input
              id={yearsId}
              value={years}
              onChange={(e) => {
                setYears(e.target.value);
                setError(undefined);
              }}
              aria-invalid={error !== undefined}
              aria-describedby={error ? `${yearsId}-error` : undefined}
              className={inputClass(error)}
            />
          </div>
          <div className="relative min-w-0">
            <label htmlFor={reasonId} className="mb-2 block text-[13px] text-prt-text">
              Reason <span className="ml-1 text-prt-muted">optional</span>
            </label>
            <select
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`${inputClass()} cursor-pointer appearance-none pr-10`}
            >
              <option value="" className="bg-panel">
                No reason
              </option>
              {LEAVE_REASONS.map((r) => (
                <option key={r} value={r} className="bg-panel">
                  {LEAVE_REASON_LABELS[r]}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute bottom-3.5 right-3.5 h-4 w-4 text-prt-muted" strokeWidth={1.75} />
          </div>
          {error && (
            <p id={`${yearsId}-error`} className="col-span-2 -mt-1 text-[12px] text-danger">
              {error}
            </p>
          )}
        </div>
      }
    >
      {firstName} leaves {unit ?? "the team"} and shows on the Alumni page with the years on the team. Their dashboard
      access ends. Their account stays.
    </ConfirmDialog>
  );
}
