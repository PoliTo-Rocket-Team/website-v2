"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Copy, ExternalLink, Lock, Mail, MoreHorizontal, Pencil, Plus, UserCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { confirmJoin, confirmNda, removeFromDivision } from "@/app/dashboard/team-actions";
import { noDetailsFilled } from "@/lib/dashboard/details";
import {
  headcountLine,
  matchesPerson,
  type DivisionMembers,
  type DivisionPerson,
  type WaitingPerson,
} from "@/lib/dashboard/division-members";
import { divisionLabel, type Joining } from "@/lib/dashboard/team";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { SearchField, TH } from "./directory";
import { Chips } from "./division-chips";
import { DrawerPage } from "./drawer";
import { AlumniDialog } from "./member-drawer";
import { AddMemberDrawer, EditDetailsDrawer, PersonDrawer, type EditTarget } from "./member-panels";
import { GHOST_PILL, PageHeader, PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";

// A division's Members page for its lead (boards 61e to 61h2, issue #231):
// everyone in the division with every division they are in as chips, their
// role, phone (blurred until hover) and Discord, the people added by email
// who wait for Confirm NDA, and the amber note that the site sends no
// emails. A row opens the member panel (61f); its ⋯ menu removes the person
// from this division or records that they leave the team, each behind an
// "are you sure". The leads are read-only here: only the head changes them.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type Asking =
  | { readonly kind: "nda"; readonly waiting: WaitingPerson }
  | { readonly kind: "remove"; readonly person: DivisionPerson }
  | { readonly kind: "leave"; readonly person: DivisionPerson };

export function DivisionMembersView({ page, editable }: { page: DivisionMembers; editable: boolean }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState<Asking | null>(null);

  const { division } = page;
  const people = page.people.filter((p) => matchesPerson(p, query));
  const waiting = page.waiting.filter((w) => query.trim() === "" || w.email.includes(query.trim().toLowerCase()) || (w.name ?? "").toLowerCase().includes(query.trim().toLowerCase()));
  const open = page.people.find((p) => p.id === openId) ?? null;
  const short = divisionLabel(division.name);
  const intro = [division.name, division.code, headcountLine(page)].filter(Boolean).join(" · ");

  const editPerson = (person: DivisionPerson) => {
    setOpenId(null);
    setEditing({ kind: "person", person });
  };
  const fillDetails = (w: WaitingPerson) => setEditing({ kind: "waiting", waiting: w });

  return (
    <DrawerPage drawerOpen={open !== null || editing !== null || adding}>
      <PageHeader
        title="Members"
        intro={intro}
        phone="bar"
        action={
          editable ? (
            <button type="button" onClick={() => setAdding(true)} className={`${PRIMARY_PILL} md:h-10 md:px-5`}>
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              Add member
            </button>
          ) : undefined
        }
      />

      {page.divisions.length > 1 && (
        <nav aria-label="Your divisions" className="mt-6 flex flex-wrap gap-1.5">
          {page.divisions.map((d) => {
            const current = d.id === division.id;
            return (
              <Link
                key={d.id}
                href={`/dashboard/members?division=${d.id}`}
                aria-current={current ? "page" : undefined}
                className={`flex h-8 items-center whitespace-nowrap rounded-full border px-3 text-[13px] transition-colors duration-300 ease-out ${FOCUS} ${
                  current ? "border-white-10 bg-white-10 font-semibold text-prt-text" : "border-hairline text-text-2 hover:text-prt-text"
                }`}
              >
                {divisionLabel(d.name)}
              </Link>
            );
          })}
        </nav>
      )}

      {page.joining.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2.5">
          {page.joining.map((joining) => (
            <JoiningBanner key={joining.applicationId} joining={joining} division={division.name} editable={editable} />
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-col gap-3 md:mt-5 md:flex-row md:items-center md:justify-between">
        <p className="flex items-center gap-2 text-[13px] text-prt-muted">
          <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {division.leadsHint}
        </p>
        <SearchField value={query} onChange={setQuery} placeholder="Search name, email, phone" className="md:w-[240px]" />
      </div>

      <ul aria-label="Members" className="mt-4 flex flex-col gap-2.5 md:hidden">
        {waiting.map((w) => (
          <li key={`w${w.joinId}`} className={`${PANEL} flex items-center gap-3.5 border-warning/30 px-4 py-3.5`}>
            <MailAvatar />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{w.email}</span>
              <WaitingLine waiting={w} />
            </span>
            {editable && <ConfirmNdaButton onClick={() => setAsking({ kind: "nda", waiting: w })} />}
          </li>
        ))}
        {people.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setOpenId(p.id)}
              className={`${PANEL} flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`}
            >
              <Avatar name={p.name} size="ml" photoUrl={p.photoUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold">{p.name}</span>
                <span className="block truncate text-[13px] text-prt-muted">{roleText(p)}</span>
              </span>
              <Chips chips={p.chips} />
            </button>
          </li>
        ))}
      </ul>

      <section className={`${PANEL} mt-4 hidden overflow-hidden md:block`}>
        <table className="w-full table-fixed border-collapse">
          <thead className="border-b border-hairline">
            <tr>
              <th scope="col" className={TH}>
                Member
              </th>
              <th scope="col" className={`${TH} w-[19%]`}>
                Divisions
              </th>
              <th scope="col" className={`${TH} w-[15%]`}>
                Role
              </th>
              <th scope="col" className={`${TH} hidden w-[15%] lg:table-cell`}>
                Phone
              </th>
              <th scope="col" className={`${TH} hidden w-[12%] xl:table-cell`}>
                Discord
              </th>
              <th scope="col" className="w-14">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {waiting.map((w) => (
              <WaitingRow
                key={`w${w.joinId}`}
                waiting={w}
                division={division}
                editable={editable}
                onConfirm={() => setAsking({ kind: "nda", waiting: w })}
                onFill={() => fillDetails(w)}
              />
            ))}
            {people.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                short={short}
                selected={p.id === openId}
                editable={editable}
                onOpen={() => setOpenId(p.id)}
                onRemove={() => setAsking({ kind: "remove", person: p })}
                onLeave={() => setAsking({ kind: "leave", person: p })}
              />
            ))}
          </tbody>
        </table>
      </section>

      {page.waiting.map((w) => (
        <NoEmailNote key={w.joinId} waiting={w} editable={editable} onFill={() => fillDetails(w)} />
      ))}

      <PersonDrawer
        person={open}
        editable={editable}
        onClose={() => setOpenId(null)}
        onEdit={editPerson}
      />
      <EditDetailsDrawer target={editing} division={division} onClose={() => setEditing(null)} />
      <AddMemberDrawer open={adding} onOpenChange={setAdding} division={division} />

      <ConfirmNdaDialog asking={asking?.kind === "nda" ? asking.waiting : null} division={division.name} onClose={() => setAsking(null)} />
      <RemoveDialog
        person={asking?.kind === "remove" ? asking.person : null}
        divisionId={division.id}
        short={short}
        onClose={() => setAsking(null)}
      />
      {asking?.kind === "leave" && (
        <AlumniDialog
          open
          onOpenChange={(next) => !next && setAsking(null)}
          person={{ id: asking.person.id, name: asking.person.name, joined: asking.person.since }}
          onDone={() => setAsking(null)}
        />
      )}
    </DrawerPage>
  );
}

/** The Role column: "Division Lead" in accent for a lead (board 61e), else their title in this division. */
function roleText(person: DivisionPerson): string {
  return person.role === "lead" ? "Division Lead" : (person.title ?? "Member");
}

/**
 * Private data is blurred until hover (Owner decision, 2026-10-11), and
 * until keyboard focus, so it can be read without a mouse.
 */
export function Private({ children, label }: { children: ReactNode; label: string }) {
  return (
    <span
      tabIndex={0}
      aria-label={label}
      className={`inline-block max-w-full truncate rounded-sm align-middle blur-[5px] transition-[filter] duration-300 ease-out hover:blur-none focus-visible:blur-none ${FOCUS}`}
    >
      {children}
    </span>
  );
}

function MailAvatar() {
  return (
    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white-10 text-prt-muted">
      <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
    </span>
  );
}

function WaitingLine({ waiting }: { waiting: WaitingPerson }) {
  return (
    <span className="mt-0.5 flex items-center gap-2 text-[12px]">
      <span className="inline-flex h-5 items-center whitespace-nowrap rounded bg-warning-soft px-1.5 font-medium text-warning">Waiting for NDA</span>
      {noDetailsFilled(waiting.details) && <span className="text-prt-muted">Details not filled yet</span>}
    </span>
  );
}

function ConfirmNdaButton({ onClick }: { onClick: () => void }) {
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

const DASH = <span className="text-dim">–</span>;

function WaitingRow({
  waiting,
  division,
  editable,
  onConfirm,
  onFill,
}: {
  waiting: WaitingPerson;
  division: DivisionMembers["division"];
  editable: boolean;
  onConfirm: () => void;
  onFill: () => void;
}) {
  return (
    <tr className="bg-warning/[0.04]">
      <td className="px-5 py-2.5">
        <span className="flex min-w-0 items-center gap-3.5">
          <MailAvatar />
          <span className="min-w-0">
            <span className="block truncate text-[15px] text-prt-text">{waiting.email}</span>
            <WaitingLine waiting={waiting} />
          </span>
        </span>
      </td>
      <td className="px-5 py-2.5">
        <Chips chips={[{ divisionId: division.id, label: division.code ?? divisionLabel(division.name), code: division.code !== null }]} />
      </td>
      <td className="px-5 py-2.5">{editable ? <ConfirmNdaButton onClick={onConfirm} /> : <span className="text-[14px] text-prt-muted">Waiting</span>}</td>
      <td className="hidden px-5 py-2.5 text-[14px] lg:table-cell">{DASH}</td>
      <td className="hidden px-5 py-2.5 text-[14px] xl:table-cell">{DASH}</td>
      <td className="pr-4 text-right">
        {editable && (
          <RowMenu label={`Actions for ${waiting.email}`}>
            <MenuItem onSelect={onFill} icon={<Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />}>
              Fill details
            </MenuItem>
          </RowMenu>
        )}
      </td>
    </tr>
  );
}

function PersonRow({
  person,
  short,
  selected,
  editable,
  onOpen,
  onRemove,
  onLeave,
}: {
  person: DivisionPerson;
  short: string;
  selected: boolean;
  editable: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onLeave: () => void;
}) {
  const lead = person.role === "lead";
  const { removal, leave } = person;
  const offersRemove = removal.kind === "offered" || removal.kind === "locked";
  return (
    <tr
      onClick={onOpen}
      className={`cursor-pointer transition-colors duration-300 ease-out ${selected ? "bg-accent/[0.08]" : "hover:bg-white-5"}`}
    >
      <td className="px-5 py-2.5">
        <span className="flex min-w-0 items-center gap-3.5">
          <Avatar name={person.name} photoUrl={person.photoUrl} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] text-prt-text">{person.name}</span>
            <span className="block truncate text-[13px] text-prt-muted">{person.details.prtEmail || person.signInEmail}</span>
          </span>
        </span>
      </td>
      <td className="px-5 py-2.5">
        <Chips chips={person.chips} />
      </td>
      <td className={`truncate px-5 py-2.5 text-[14px] ${lead ? "text-accent" : "text-prt-text"}`}>{roleText(person)}</td>
      <td className="hidden px-5 py-2.5 text-[14px] text-text-2 lg:table-cell" onClick={(e) => e.stopPropagation()}>
        {person.details.phone === "" ? DASH : <Private label={`Phone of ${person.name}, hover to show`}>{person.details.phone}</Private>}
      </td>
      <td className="hidden truncate px-5 py-2.5 text-[14px] text-text-2 xl:table-cell">{person.details.discord || DASH}</td>
      <td className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
        {editable && !person.self ? (
          <RowMenu label={`Actions for ${person.name}`}>
            {offersRemove && (
              <MenuItem
                onSelect={onRemove}
                icon={<UserMinus className="h-3.5 w-3.5" strokeWidth={1.75} />}
                locked={removal.kind === "locked" ? removal.reason : null}
              >
                Remove from {short}
              </MenuItem>
            )}
            <MenuItem onSelect={onLeave} danger locked={leave.allowed ? null : leave.reason}>
              Leaves the team
            </MenuItem>
          </RowMenu>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${person.name}`}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text ${FOCUS}`}
          >
            <MoreHorizontal aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </td>
    </tr>
  );
}

function RowMenu({ label, children }: { label: string; children: ReactNode }) {
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
function MenuItem({
  onSelect,
  icon,
  danger = false,
  locked = null,
  children,
}: {
  onSelect: () => void;
  icon?: ReactNode;
  danger?: boolean;
  locked?: string | null;
  children: ReactNode;
}) {
  const disabled = locked !== null;
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
        {locked !== null && <span className="mt-0.5 block text-[12px] leading-snug text-dim">{locked}</span>}
      </span>
    </DropdownMenuPrimitive.Item>
  );
}

/**
 * The amber note under the table (board 61e): the site sends no emails, so
 * the lead tells the person themselves, with Fill details, Copy email and
 * Open email.
 */
function NoEmailNote({ waiting, editable, onFill }: { waiting: WaitingPerson; editable: boolean; onFill: () => void }) {
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
function ConfirmNdaDialog({ asking, division, onClose }: { asking: WaitingPerson | null; division: string; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useState(asking);
  if (asking !== null && asking !== shown) setShown(asking);
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

/** "Remove from <division>": an "are you sure" first; the person keeps their other divisions. */
function RemoveDialog({ person, divisionId, short, onClose }: { person: DivisionPerson | null; divisionId: number; short: string; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useState(person);
  if (person !== null && person !== shown) setShown(person);
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
    });
  return (
    <ConfirmDialog
      open={person !== null}
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

/**
 * "Giulia Rossi is joining" (boards 59 and 59m): Confirm join, once "The signed
 * NDA arrived" is ticked on the application (58g). It is the Applications
 * page's own Confirm join, so the button waits for that tick here too.
 */
function JoiningBanner({ joining, division, editable }: { joining: Joining; division: string; editable: boolean }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const firstName = joining.name.split(" ")[0];

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
          <Avatar name={joining.name} />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">{joining.name} is joining</span>
          <span className="block text-[13px] text-prt-muted">
            Accepted for {joining.position} · {joining.ndaArrived ? "signed NDA arrived" : "waiting for the signed NDA"}
          </span>
        </span>
      </span>
      {editable && (
        <button
          type="button"
          onClick={() => setAsking(true)}
          disabled={!joining.ndaArrived}
          className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-success/60 px-4 text-[14px] font-semibold text-success transition-colors duration-300 ease-out hover:border-success hover:bg-success/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-success/60 disabled:hover:bg-transparent md:h-8 md:px-3.5 md:text-[13px]"
        >
          Confirm join
        </button>
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
