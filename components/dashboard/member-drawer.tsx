"use client";

import { useId, useState, useTransition } from "react";
import { ChevronDown, GraduationCap, Pencil } from "lucide-react";
import { toast } from "sonner";
import { DialogClose } from "@/components/ui/dialog";
import { moveToAlumni, saveMember } from "@/app/dashboard/team-actions";
import { checkDeparture, LEAVE_REASONS, LEAVE_REASON_LABELS, yearsLabel, type EditableRole, type MemberRow } from "@/lib/dashboard/team";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON, PanelBody, SidePanel } from "./drawer";
import { inputClass } from "./field";

// The operations lead's member panel (board 46b): who the person is, the role
// the Team page shows under their name, whether they lead their division, and
// moving them to Alumni. Access is not here: the Access page is the only
// place it is given or removed. A division lead's panel is board 61f
// (./division-members.tsx). Where the data source stores no Team page
// writes, or the row is the viewer's own, it shows the same facts with
// nothing to change.

const ROLE_OPTIONS: readonly { value: EditableRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "division-lead", label: "Division lead" },
];

const LABEL = "mb-2 block text-[14px] font-medium text-prt-text";

export function MemberDrawer({
  row,
  editable,
  onClose,
}: {
  row: MemberRow | null;
  editable: boolean;
  onClose: () => void;
}) {
  // The panel keeps showing the last person while it closes.
  const [shown, setShown] = useState<MemberRow | null>(row);
  if (row !== null && row !== shown) setShown(row);
  const person = row ?? shown;
  return person === null ? null : (
    <MemberPanel key={person.id} open={row !== null} row={person} editable={editable && !person.self} onClose={onClose} />
  );
}

function editableRoleOf(row: MemberRow): EditableRole | null {
  if (row.role === "member") return row.division === null ? null : "member";
  return row.role === "division-lead" ? "division-lead" : null;
}

function MemberPanel({
  open,
  row,
  editable,
  onClose,
}: {
  open: boolean;
  row: MemberRow;
  editable: boolean;
  onClose: () => void;
}) {
  const startRole = editableRoleOf(row);
  const [role, setRole] = useState<EditableRole | null>(startRole);
  const [title, setTitle] = useState(row.pageTitle ?? "");
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const titleId = useId();
  const firstName = row.name.split(" ")[0];
  const facts = [row.program, row.study, `joined ${row.joined}`].filter(Boolean).join(" · ");

  const save = () =>
    startTransition(async () => {
      const result = await saveMember(row.id, role, title.trim() === "" ? null : title);
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
          <Avatar size="xl" accent={row.role !== "member"} />
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

        {editable && startRole !== null && (
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

        {editable && (
          <section className="mt-10 rounded-xl border border-danger/40 bg-danger/[0.06] p-4 md:mt-auto">
            <h2 className="text-[14px] font-semibold">Leaving the team</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-prt-muted">
              Moves {firstName} to Alumni with the years on the team. The account stays; dashboard access ends.
            </p>
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="mt-4 inline-flex h-9 items-center rounded-full border border-danger/60 px-4 text-[13px] font-semibold text-danger transition-colors duration-300 ease-out hover:border-danger hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Move to alumni
            </button>
          </section>
        )}
      </PanelBody>

      <AlumniDialog open={asking} onOpenChange={setAsking} person={row} onDone={onClose} />
    </SidePanel>
  );
}

/**
 * Board 59d, and "Leaves the team" on a division's Members page (#231): the
 * years on the team and an optional reason. Every role and every access
 * grant ends; the account stays.
 */
export function AlumniDialog({
  open,
  onOpenChange,
  person,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: { readonly id: number; readonly name: string; readonly joined: number };
  onDone: () => void;
}) {
  const thisYear = new Date().getFullYear();
  const [years, setYears] = useState(yearsLabel(Math.min(person.joined, thisYear), thisYear));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const yearsId = useId();
  const reasonId = useId();
  const firstName = person.name.split(" ")[0];

  const confirm = () => {
    const checked = checkDeparture({ years, reason }, thisYear);
    if (!checked.ok) return setError(checked.error);
    setError(undefined);
    startTransition(async () => {
      const result = await moveToAlumni(person.id, years, reason === "" ? null : reason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${person.name} moved to Alumni`);
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<GraduationCap className="h-5 w-5" strokeWidth={1.75} />}
      title={`${person.name} leaves the team?`}
      description={`${firstName} leaves every division and shows on the Alumni page with the years on the team. All their dashboard access ends. Their account stays.`}
      confirmLabel="Leaves the team"
      cancelLabel={`Keep ${firstName} on the team`}
      danger
      pending={pending}
      onConfirm={confirm}
    >
      <div className="mt-5 grid grid-cols-2 gap-3">
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
    </ConfirmDialog>
  );
}
