"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronDown, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { saveMember, moveToAlumni } from "@/app/dashboard/team-actions";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import type { EditableRole, MemberDirectory, MemberRow } from "@/lib/dashboard/team";
import { Avatar } from "./avatar";

// The member drawer (board 46b): who the person is, their role, their title
// on the public Team page, their access, and moving them to Alumni. It is
// the repo's Radix dialog built on the primitive (manifest, Components): it
// slides in only under motion-safe and closes at once. Where the data
// source stores no Team page writes, it shows the same facts with nothing to
// change.

const ROLE_OPTIONS: readonly { value: EditableRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "division-lead", label: "Division lead" },
];

const FIELD =
  "flex h-12 w-full items-center rounded-xl border border-hairline bg-transparent px-4 text-[15px] text-prt-text transition-colors duration-300 ease-out";

const LABEL = "mb-2 block text-[14px] font-medium text-prt-text";

export function MemberDrawer({
  row,
  scope,
  editable,
  onClose,
}: {
  row: MemberRow | null;
  scope: MemberDirectory["scope"];
  editable: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="bg-transparent" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col border-l border-hairline bg-ground text-prt-text focus:outline-none motion-safe:duration-300 motion-safe:ease-out motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-right"
        >
          {row && <DrawerBody key={row.id} row={row} scope={scope} editable={editable && !row.self} onClose={onClose} />}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function editableRoleOf(row: MemberRow): EditableRole | null {
  if (row.role === "member") return row.division === null ? null : "member";
  return row.role === "division-lead" ? "division-lead" : null;
}

function DrawerBody({
  row,
  scope,
  editable,
  onClose,
}: {
  row: MemberRow;
  scope: MemberDirectory["scope"];
  editable: boolean;
  onClose: () => void;
}) {
  const startRole = editableRoleOf(row);
  const [role, setRole] = useState<EditableRole | null>(startRole);
  const [title, setTitle] = useState(row.pageTitle ?? "");
  const [pending, startTransition] = useTransition();
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

  const move = () =>
    startTransition(async () => {
      const result = await moveToAlumni(row.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${row.name} moved to Alumni`);
      onClose();
    });

  return (
    <>
      <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-hairline px-6">
        <DialogTitle className="text-[20px] font-bold">Member</DialogTitle>
        <DialogClose
          aria-label="Close"
          className="-mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </DialogClose>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-7">
        <div className="flex items-center gap-4">
          <Avatar name={row.name} size="xl" accent={row.role !== "member"} />
          <div className="min-w-0">
            <p className="truncate text-[18px] font-semibold">{row.name}</p>
            <p className="truncate text-[14px] text-prt-muted">{row.email}</p>
            <p className="text-[13px] text-prt-muted">{facts}</p>
          </div>
        </div>

        <div className="mt-7">
          <span className={LABEL}>
            Role
            {scope === "division" && <span className="ml-1.5 font-normal text-prt-muted">in your division</span>}
          </span>
          {editable && startRole !== null ? (
            <label className="relative block">
              <span className="sr-only">Role</span>
              <select
                value={role ?? "member"}
                onChange={(event) => setRole(event.target.value as EditableRole)}
                className={`${FIELD} cursor-pointer appearance-none pr-10 hover:border-border-strong focus:border-border-strong focus:outline-none`}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-panel">
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
            </label>
          ) : (
            <p className={`${FIELD} text-text-2`}>{row.roleLabel}</p>
          )}
        </div>

        <div className="mt-6">
          <label htmlFor="member-title" className={LABEL}>
            Title on the Team page
            <span className="ml-1.5 font-normal text-prt-muted">optional</span>
          </label>
          <div className="relative">
            <input
              id="member-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              readOnly={!editable}
              maxLength={80}
              className={`${FIELD} pr-11 placeholder:text-dim hover:border-border-strong focus:border-border-strong focus:outline-none read-only:hover:border-hairline`}
            />
            {editable && (
              <Pencil aria-hidden className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
            )}
          </div>
        </div>

        <div className="mt-6">
          <span className={LABEL}>Access</span>
          <div className={`${FIELD} justify-between gap-4`}>
            <span className="truncate">{row.access.length > 0 ? row.access.join(", ") : "Own pages only"}</span>
            {scope === "division" && (
              <Link
                href="/dashboard/access"
                className="shrink-0 text-[14px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover"
              >
                Manage
              </Link>
            )}
          </div>
        </div>

        {editable && (
          <section className="mt-10 rounded-xl border border-danger/40 bg-danger/[0.06] p-5">
            <h2 className="text-[15px] font-semibold">Leaving the team</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-prt-muted">
              Moves {firstName} to Alumni with the years on the team. The account stays; team access ends.
            </p>
            <button
              type="button"
              onClick={move}
              disabled={pending}
              className="mt-4 inline-flex h-10 items-center rounded-full border border-danger/60 px-5 text-[14px] font-medium text-danger transition-colors duration-300 ease-out hover:border-danger hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-50"
            >
              Move to alumni
            </button>
          </section>
        )}
      </div>

      <footer className="flex shrink-0 gap-3 border-t border-hairline px-6 py-5">
        <DialogClose className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-white-10 text-[15px] font-medium transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          {editable ? "Cancel" : "Close"}
        </DialogClose>
        {editable && (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-prt-text text-[15px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          >
            Save
          </button>
        )}
      </footer>
    </>
  );
}
