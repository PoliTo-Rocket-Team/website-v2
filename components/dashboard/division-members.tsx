"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Copy, ExternalLink, Lock, Mail, MoreHorizontal, Pencil, UserCheck, UserMinus, UserX } from "lucide-react";
import { toast } from "sonner";
import { moveApplication } from "@/app/dashboard/recruitment-actions";
import { cancelAdd, confirmJoin, confirmNda, removeFromDivision } from "@/app/dashboard/team-actions";
import { noDetailsFilled } from "@/lib/dashboard/details";
import type { DivisionPerson, WaitingPerson } from "@/lib/dashboard/division-members";
import type { Joining } from "@/lib/dashboard/team";
import { Avatar } from "./avatar";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "./confirm-dialog";
import { AlumniDialog } from "./member-drawer";
import { GHOST_PILL } from "./page-header";

// The parts a Members page and the Team tree's division panel share (boards
// 61e to 61h2, issue #231): the people added by email who wait for Confirm
// NDA, the amber note that the site sends no emails, a row's ⋯ menu and the
// "are you sure" dialogs behind it. The Members page itself is one view for
// every role (issue #408, ./team-members.tsx).

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Who a removal or a move to Alumni is about: a division page's person or one on the whole team. */
type AskedPerson = Pick<DivisionPerson, "id" | "name" | "since" | "divisions">;

/** The "are you sure" a row, a note or Edit details opened, with the division it is about. */
export type Asking =
  | { readonly kind: "nda"; readonly waiting: WaitingPerson; readonly division: string }
  | { readonly kind: "cancel"; readonly waiting: WaitingPerson; readonly short: string }
  | { readonly kind: "remove"; readonly person: AskedPerson; readonly divisionId: number; readonly short: string }
  | { readonly kind: "leave"; readonly person: AskedPerson };

export { matchesWaiting } from "@/lib/dashboard/members-view";

/**
 * The "are you sure" dialogs a Members page's rows, notes and Edit details
 * open. `onDone` runs after a removal or a move to Alumni went through, so
 * Edit details can close behind it.
 */
export function MemberDialogs({ asking, onClose, onDone }: { asking: Asking | null; onClose: () => void; onDone?: () => void }) {
  return (
    <>
      <ConfirmNdaDialog asking={asking?.kind === "nda" ? asking : null} onClose={onClose} />
      <CancelAddDialog asking={asking?.kind === "cancel" ? asking : null} onClose={onClose} />
      <RemoveDialog asking={asking?.kind === "remove" ? asking : null} onClose={onClose} onDone={onDone} />
      {asking?.kind === "leave" && (
        <AlumniDialog
          open
          onOpenChange={(next) => !next && onClose()}
          person={{ id: asking.person.id, name: asking.person.name, joined: asking.person.since }}
          onDone={() => {
            onClose();
            onDone?.();
          }}
        />
      )}
    </>
  );
}

/**
 * Private data is blurred until hover (Owner decision, 2026-10-11), and
 * until keyboard focus, so it can be read without a mouse. The Members list
 * shows no phone (issue #251); the Members table does.
 */
export function Private({ children, label }: { children: ReactNode; label: string }) {
  return (
    <span
      tabIndex={0}
      aria-label={label}
      className={`inline-block max-w-full truncate rounded-sm align-middle blur-[5px] transition-[filter] duration-300 ease-out hover:blur-none focus-visible:blur-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
    >
      {children}
    </span>
  );
}

export function MailAvatar() {
  return (
    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white-10 text-prt-muted">
      <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
    </span>
  );
}

export function WaitingLine({ waiting }: { waiting: WaitingPerson }) {
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
      <span className="inline-flex h-5 items-center whitespace-nowrap rounded bg-warning-soft px-1.5 font-medium text-warning">Waiting for NDA</span>
      {noDetailsFilled(waiting.details) && <span className="min-w-0 max-w-full truncate text-prt-muted">Details not filled yet</span>}
    </span>
  );
}

export function ConfirmNdaButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-full border border-success/60 px-3 text-[13px] font-semibold text-success transition-colors duration-300 ease-out hover:border-success hover:bg-success/10 ${FOCUS}`}
    >
      Confirm NDA
    </button>
  );
}

export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text data-[state=open]:bg-white-5 data-[state=open]:text-prt-text ${FOCUS}`}
      >
        <MoreHorizontal aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[280px] rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

/**
 * A menu item; when `locked` names a reason the item is disabled, with a
 * lock and the reason under it (Owner decision, 2026-10-11).
 */
export function MenuItem({
  onSelect,
  icon,
  danger = false,
  locked = null,
  detail = null,
  children,
}: {
  onSelect: () => void;
  icon?: ReactNode;
  danger?: boolean;
  locked?: string | null;
  /** A muted line under an open item: "Stays in Structures" (board 68b5). */
  detail?: string | null;
  children: ReactNode;
}) {
  const disabled = locked !== null;
  const under = locked ?? detail;
  return (
    <DropdownMenuPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors data-[disabled]:cursor-not-allowed data-[highlighted]:bg-white-5 ${
        disabled ? "text-prt-muted" : danger ? "text-danger" : "text-text-2 data-[highlighted]:text-prt-text"
      }`}
    >
      <span aria-hidden className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        {disabled ? <Lock className="h-3.5 w-3.5" strokeWidth={1.75} /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block">{children}</span>
        {under !== null && <span className="mt-0.5 block text-[12px] leading-snug text-dim">{under}</span>}
      </span>
    </DropdownMenuPrimitive.Item>
  );
}

/**
 * The amber note under the table (board 61e): the site sends no emails, so
 * the lead tells the person themselves, with Fill details, Copy email and
 * Open email.
 */
export function NoEmailNote({ waiting, editable, onFill }: { waiting: WaitingPerson; editable: boolean; onFill: () => void }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(waiting.email);
      toast.success("Email copied");
    } catch {
      toast.error("Could not copy the email");
    }
  };
  return (
    <section className="mt-4 rounded-xl border border-warning/30 bg-warning/[0.05] px-4 py-3.5">
      <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-text-2">
        <Mail aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
        <span>
          The site doesn&apos;t send emails, so you need to let {waiting.email} know. A lead or head can fill in their details, or they can sign in
          with this email and fill them in themselves.
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2 md:pl-[26px]">
        {editable && (
          <button type="button" onClick={onFill} className={GHOST_PILL}>
            <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Fill details
          </button>
        )}
        <button type="button" onClick={copy} className={GHOST_PILL}>
          <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Copy email
        </button>
        <a href={`mailto:${waiting.email}`} className={GHOST_PILL}>
          <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Open email
        </a>
      </div>
    </section>
  );
}

/** Confirm NDA: an "are you sure" first; the date and the confirmer are recorded. */
function ConfirmNdaDialog({ asking, onClose }: { asking: Extract<Asking, { kind: "nda" }> | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [shownAsking, setShown] = useState(asking);
  if (asking !== null && asking !== shownAsking) setShown(asking);
  const shown = shownAsking?.waiting ?? null;
  const division = shownAsking?.division ?? "";
  const who = shown?.name ?? shown?.email ?? "";
  const confirm = () =>
    startTransition(async () => {
      if (!shown) return;
      const result = await confirmNda(shown.joinId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${who} joined ${division}`);
      onClose();
    });
  return (
    <ConfirmDialog
      open={asking !== null}
      onOpenChange={(next) => !next && onClose()}
      icon={<UserCheck className="h-5 w-5" strokeWidth={1.75} />}
      tone="success"
      title={`Confirm ${who}'s NDA?`}
      description={`Confirm once you have their signed NDA. They become a member of ${division}, and today's date and your name are recorded.`}
      cancelLabel="Cancel"
      confirmLabel="Confirm NDA"
      pending={pending}
      onConfirm={confirm}
    />
  );
}

/** Cancel add: an "are you sure" first; the wait is deleted and nothing else changes, since they never joined. */
function CancelAddDialog({ asking, onClose }: { asking: Extract<Asking, { kind: "cancel" }> | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [shownAsking, setShown] = useState(asking);
  if (asking !== null && asking !== shownAsking) setShown(asking);
  const shown = shownAsking?.waiting ?? null;
  const short = shownAsking?.short ?? "";
  const who = shown?.name ?? shown?.email ?? "";
  const confirm = () =>
    startTransition(async () => {
      if (!shown) return;
      const result = await cancelAdd(shown.joinId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${who} is no longer added to ${short}`);
      onClose();
    });
  return (
    <ConfirmDialog
      open={asking !== null}
      onOpenChange={(next) => !next && onClose()}
      icon={<UserX className="h-5 w-5" strokeWidth={1.75} />}
      danger
      title={`Cancel adding ${who}?`}
      description={`They are no longer waiting for the NDA in ${short}. They never joined, so nothing else changes.`}
      cancelLabel="Keep them"
      confirmLabel="Cancel add"
      pending={pending}
      onConfirm={confirm}
    />
  );
}

/** "Remove from <division>": an "are you sure" first; the person keeps their other divisions. */
function RemoveDialog({
  asking,
  onClose,
  onDone,
}: {
  asking: Extract<Asking, { kind: "remove" }> | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [shownAsking, setShown] = useState(asking);
  if (asking !== null && asking !== shownAsking) setShown(asking);
  const shown = shownAsking?.person ?? null;
  const divisionId = shownAsking?.divisionId ?? -1;
  const short = shownAsking?.short ?? "";
  const firstName = shown?.name.split(" ")[0] ?? "";
  const others = shown?.divisions.filter((d) => d.divisionId !== divisionId).map((d) => d.name) ?? [];
  const confirm = () =>
    startTransition(async () => {
      if (!shown) return;
      const result = await removeFromDivision(shown.id, divisionId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${shown.name} left ${short}`);
      onClose();
      onDone?.();
    });
  return (
    <ConfirmDialog
      open={asking !== null}
      onOpenChange={(next) => !next && onClose()}
      icon={<UserMinus className="h-5 w-5" strokeWidth={1.75} />}
      danger
      title={`Remove ${shown?.name ?? ""} from ${short}?`}
      description={`Their role and access in ${short} end. ${firstName} stays on the team in ${others.join(", ")}.`}
      cancelLabel="Cancel"
      confirmLabel={`Remove from ${short}`}
      pending={pending}
      onConfirm={confirm}
    />
  );
}

/** The banner's outlined success pill: Confirm join's look, which Mark NDA received shares (issue #601). */
const BANNER_ACTION =
  "inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-success/60 px-4 text-[14px] font-semibold text-success transition-colors duration-300 ease-out hover:border-success hover:bg-success/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-success/60 disabled:hover:bg-transparent md:h-8 md:px-3.5 md:text-[13px]";

/**
 * "Giulia Rossi is joining" (boards 59 and 59m): Confirm join, once "The signed
 * NDA arrived" is ticked on the application (58g). It is the Applications
 * page's own Confirm join, so the button waits for that tick here too, and
 * shows only where `editable`: the viewer may change applications there
 * (`Joining.canConfirm`, issue #584). While the NDA waits, the same viewer
 * records it here with Mark NDA received: the Applications tick's own move
 * (`set-nda`), so the banner adds no rule or write path of its own (issue #601).
 * The server's yes is what readies Confirm join: the banner holds it at once,
 * so it does not wait on the page's refresh to show the NDA arrived.
 */
export function JoiningBanner({ joining, division, editable }: { joining: Joining; division: string; editable: boolean }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [marking, startMarking] = useTransition();
  const [marked, setMarked] = useState(false);
  const ndaArrived = joining.ndaArrived || marked;
  const firstName = joining.name.split(" ")[0];

  const markNda = () =>
    startMarking(async () => {
      const result = await moveApplication(joining.applicationId, { kind: "set-nda", arrived: true });
      if (result.ok) setMarked(true);
      else toast.error(result.error);
    });

  const confirm = () =>
    startTransition(async () => {
      const result = await confirmJoin(joining.applicationId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAsking(false);
      toast.success(`${joining.name} joined ${division}`);
    });

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-success/40 bg-success/[0.06] px-4 py-3.5 md:flex-row md:items-center md:gap-4">
      <span className="flex min-w-0 flex-1 items-center gap-3.5">
        <span className="hidden md:block">
          <Avatar person={joining} />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">{joining.name} is joining</span>
          <span className="block text-[13px] text-prt-muted">
            Accepted for {joining.position} · {ndaArrived ? "signed NDA arrived" : "waiting for the signed NDA"}
          </span>
        </span>
      </span>
      {editable && (
        <span className="flex shrink-0 flex-wrap items-center gap-2">
          {!ndaArrived && (
            <button type="button" onClick={markNda} disabled={marking} className={BANNER_ACTION}>
              Mark NDA received
            </button>
          )}
          <button type="button" onClick={() => setAsking(true)} disabled={!ndaArrived} className={BANNER_ACTION}>
            Confirm join
          </button>
        </span>
      )}
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        icon={<UserCheck className="h-5 w-5" strokeWidth={1.75} />}
        tone="success"
        title={`Confirm ${joining.name} joins?`}
        description={`${firstName} becomes a member of ${division} as ${joining.position}. Confirm once you have their signed NDA.`}
        cancelLabel="Cancel"
        confirmLabel="Confirm join"
        pending={pending}
        onConfirm={confirm}
      />
    </li>
  );
}
