"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { BriefcaseBusiness, Check, ChevronDown, Inbox, Info, Plus, Trash2, UserMinus, UserPlus, Users, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  ACCESS_TARGETS,
  ACCESS_TARGET_LABELS,
  canGive,
  canRemove,
  editLabelFor,
  grantSummary,
  levelLabel,
  PERSON_STANDING_LABELS,
  shortUnitName,
  type HeldAccess,
  type AccessGrant,
  type AccessLevel,
  type AccessTarget,
  type DivisionAccess,
  type GiveAccess,
} from "@/lib/dashboard/division-access";
import { shortDate, type WriteResult } from "@/lib/dashboard/write";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { Drawer, DrawerPage } from "./drawer";
import { Field, GroupLabel } from "./field";
import { PANEL } from "./panel";
import { EYEBROW, PageHeader, PRIMARY_PILL } from "./page-header";

const TARGET_ICONS: Readonly<Record<AccessTarget, LucideIcon>> = {
  positions: BriefcaseBusiness,
  applications: Inbox,
  members: Users,
};

type Actions = {
  giveAccess: (input: GiveAccess) => Promise<WriteResult<readonly AccessGrant[]>>;
  removeAccess: (grantId: number) => Promise<WriteResult<null>>;
};

// Boards 60, 60b and 60m: what the lead holds, the access they shared, and
// the Give access panel. This is the only dashboard page that gives or
// removes access. Props in, nothing fetched; the table lives in this page's
// state, so a grant given or removed shows at once. Removing asks first.
export function DivisionAccessView({ access, ...actions }: { access: DivisionAccess } & Actions) {
  const [grants, setGrants] = useState(access.grants);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<AccessGrant | null>(null);
  const [pending, startTransition] = useTransition();
  const unit = shortUnitName(access.division.name);

  const remove = (grant: AccessGrant) =>
    startTransition(async () => {
      const result = await actions.removeAccess(grant.id);
      if (!result.ok) {
        toast.error("Could not remove access", { description: result.error });
        return;
      }
      setGrants((all) => all.filter((g) => g.id !== grant.id));
      setRemoving(null);
      toast.success(`Removed ${grant.person.name}'s ${ACCESS_TARGET_LABELS[grant.target]} access`);
    });

  const added = (fresh: readonly AccessGrant[]) => {
    // A new level for a target the person already had replaces the old row.
    setGrants((all) => [
      ...fresh,
      ...all.filter((g) => !fresh.some((f) => f.person.id === g.person.id && f.target === g.target)),
    ]);
  };

  return (
    <DrawerPage drawerOpen={open}>
      <PageHeader
        title="Access"
        intro="Share what you can do with people in your division. You can only give access you have."
        introOnPhone={false}
        action={
          access.held.length > 0 && access.people.length > 0 ? (
            <button type="button" onClick={() => setOpen(true)} className={PRIMARY_PILL}>
              <UserPlus aria-hidden className="hidden h-4 w-4 md:block" strokeWidth={2} />
              <Plus aria-hidden className="h-4 w-4 md:hidden" strokeWidth={2} />
              <span className="md:hidden">Give</span>
              <span className="hidden md:inline">Give access</span>
            </button>
          ) : undefined
        }
      />

      {access.held.length > 0 && (
        <section className="mt-6">
          <h2 className={EYEBROW}>Your access</h2>
          <ul className="mt-2.5 grid grid-cols-3 gap-2 md:hidden">
            {access.held.map((h) => (
              <li key={h.target} className={`${PANEL} min-w-0 rounded-[10px] px-3 py-2.5`}>
                <span className="block truncate text-[13px] font-semibold">{ACCESS_TARGET_LABELS[h.target]}</span>
                <span className="block truncate text-[12px] text-prt-muted">{shortLevel(h.target, h.level)}</span>
              </li>
            ))}
          </ul>
          {/* As many cards per row as fit at 200px, so a card's line stays whole
              when the Give access panel narrows the page. */}
          <ul className="mt-2.5 hidden grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5 md:grid">
            {access.held.map((h) => {
              const Icon = TARGET_ICONS[h.target];
              return (
                <li key={h.target} className={`${PANEL} flex items-center gap-3 rounded-[10px] px-4 py-2.5`}>
                  <Icon aria-hidden className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">{ACCESS_TARGET_LABELS[h.target]}</span>
                    <span className="block text-[12px] text-prt-muted">
                      {unit} · <span className="whitespace-nowrap">{levelLabel(h.target, h.level)}</span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {grants.length > 0 && (
        <>
          <section aria-label="People with access" className="mt-6 md:hidden">
            <h2 className={EYEBROW}>People with access</h2>
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {grants.map((g) => {
                const removable = canRemove(access.held, g);
                const inner = (
                  <>
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-semibold">{g.person.name}</span>
                      <span className="block truncate text-[13px] text-prt-muted">
                        {ACCESS_TARGET_LABELS[g.target]} · {unit}
                      </span>
                    </span>
                    <LevelPill grant={g} />
                  </>
                );
                const card = `${PANEL} flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left`;
                return (
                  <li key={g.id}>
                    {removable ? (
                      <button
                        type="button"
                        onClick={() => setRemoving(g)}
                        aria-label={`${g.person.name}, ${ACCESS_TARGET_LABELS[g.target]} ${levelLabel(g.target, g.level)}. Remove access`}
                        className={`${card} transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div className={card}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          <GrantsTable grants={grants} held={access.held} unit={unit} onRemove={setRemoving} />
        </>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        icon={UserMinus}
        tone="danger"
        title={removing ? `Remove ${removing.person.name}'s access?` : "Remove access?"}
        confirmLabel="Remove access"
        danger
        pending={pending}
        onConfirm={() => removing && remove(removing)}
      >
        {removing &&
          `${removing.person.name.split(" ")[0]} can no longer ${levelVerb(removing)} ${ACCESS_TARGET_LABELS[removing.target]} for ${unit}.`}
      </ConfirmDialog>

      <GiveAccessDrawer
        key={open ? "open" : "closed"}
        open={open}
        onOpenChange={setOpen}
        access={access}
        grants={grants}
        giveAccess={actions.giveAccess}
        onGiven={(fresh) => {
          added(fresh);
          setOpen(false);
        }}
      />
    </DrawerPage>
  );
}

/** "Edit", "Decide", "View": a held level on a phone card (board 60m). */
function shortLevel(target: AccessTarget, level: AccessLevel): string {
  return levelLabel(target, level).replace(/^Can /, "").replace(/^./, (c) => c.toUpperCase());
}

/** "view", "decide on", "edit": what a removal takes away. */
function levelVerb(grant: AccessGrant): string {
  const label = levelLabel(grant.target, grant.level).replace(/^Can /, "");
  return label === "decide" ? "decide on" : label;
}

function LevelPill({ grant }: { grant: AccessGrant }) {
  return (
    <span className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-white-10 px-2.5 py-0.5 text-[12px] text-prt-text">
      {levelLabel(grant.target, grant.level)}
    </span>
  );
}

// From md the header and every row are subgrids of one set of columns on the
// table, so Level and Given by keep their content on one line however narrow
// the page gets (the Give access panel takes 440px from xl) and the header
// still lines up with the rows. Below md the page shows cards instead.
const TABLE_COLUMNS = "grid grid-cols-[minmax(150px,1.5fr)_minmax(0,1.6fr)_minmax(max-content,0.7fr)_minmax(max-content,0.9fr)_32px] gap-x-4";
const ROW = "col-span-full grid grid-cols-subgrid items-center px-[18px]";

/** "You · 2 Oct" */
function givenLine(g: AccessGrant): string {
  return [g.givenBy, g.givenOn && shortDate(g.givenOn)].filter(Boolean).join(" · ");
}

function GrantsTable({
  grants,
  held,
  unit,
  onRemove,
}: {
  grants: readonly AccessGrant[];
  held: readonly HeldAccess[];
  unit: string;
  onRemove: (grant: AccessGrant) => void;
}) {
  return (
    <section aria-label="People you gave access" className={`${PANEL} ${TABLE_COLUMNS} mt-5 hidden overflow-hidden md:grid`}>
      <div aria-hidden className={`${ROW} h-9 border-b border-hairline`}>
        <span className={EYEBROW}>Person</span>
        <span className={EYEBROW}>Access</span>
        <span className={`${EYEBROW} whitespace-nowrap`}>Level</span>
        <span className={`${EYEBROW} whitespace-nowrap`}>Given by</span>
      </div>
      <ul className="col-span-full grid grid-cols-subgrid divide-y divide-hairline">
        {grants.map((g) => (
          <li key={g.id} className={`${ROW} py-3`}>
            <span className="flex min-w-0 items-center gap-3">
              <Avatar name={g.person.name} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium">{g.person.name}</span>
                <span className="block text-[12px] text-prt-muted">{PERSON_STANDING_LABELS[g.person.standing]}</span>
              </span>
            </span>
            <span className="text-[13px] text-text-2">
              {ACCESS_TARGET_LABELS[g.target]} · {unit}
            </span>
            <span>
              <LevelPill grant={g} />
            </span>
            <span className="whitespace-nowrap text-[13px] text-prt-muted">{givenLine(g)}</span>
            {canRemove(held, g) ? (
              <button
                type="button"
                onClick={() => onRemove(g)}
                aria-label={`Remove ${g.person.name}'s ${ACCESS_TARGET_LABELS[g.target]} access`}
                className="flex h-8 w-8 items-center justify-center justify-self-end rounded-full text-prt-muted transition-colors duration-300 ease-out hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function GiveAccessDrawer({
  open,
  onOpenChange,
  access,
  grants,
  giveAccess,
  onGiven,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  access: DivisionAccess;
  grants: readonly AccessGrant[];
  giveAccess: Actions["giveAccess"];
  onGiven: (grants: readonly AccessGrant[]) => void;
}) {
  // Open on the first person who has no access yet, and the first thing the lead holds.
  const firstFree = access.people.find((p) => !grants.some((g) => g.person.id === p.id)) ?? access.people[0];
  const [personId, setPersonId] = useState<number | undefined>(firstFree?.id);
  const [targets, setTargets] = useState<AccessTarget[]>(access.held.slice(0, 1).map((h) => h.target));
  const [level, setLevel] = useState<AccessLevel>("view");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const accessLabel = useId();
  const levelLabelId = useId();

  const person = access.people.find((p) => p.id === personId);
  const editAllowed = targets.length > 0 && canGive(access.held, targets, "edit");
  const chosenLevel: AccessLevel = editAllowed ? level : "view";
  const summary = person ? grantSummary(person.name, targets, chosenLevel, access.division.name) : null;

  const toggle = (target: AccessTarget) =>
    setTargets((all) => (all.includes(target) ? all.filter((t) => t !== target) : ACCESS_TARGETS.filter((t) => t === target || all.includes(t))));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (personId === undefined) return setError("Choose a person.");
    if (targets.length === 0) return setError("Choose at least one kind of access.");
    setError(undefined);
    setSubmitting(true);
    try {
      const result = await giveAccess({ personId, targets, level: chosenLevel });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onGiven(result.value);
      toast.success(`Gave ${person?.name ?? "them"} access`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Give access" submitLabel="Give access" submitting={submitting} onSubmit={submit}>
      <Field label="Person" hint="from your division">
        {(id) => (
          <div className="relative">
            {person && (
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <Avatar name={person.name} size="sm" />
              </span>
            )}
            <select
              id={id}
              value={personId ?? ""}
              onChange={(e) => setPersonId(Number(e.target.value))}
              className="h-12 w-full cursor-pointer appearance-none rounded-[10px] border border-white-10 bg-white-5 pl-12 pr-10 text-[15px] text-prt-text transition-colors duration-300 ease-out focus:border-accent focus:outline-none"
            >
              {access.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-2" />
          </div>
        )}
      </Field>

      <div className="mt-6" role="group" aria-labelledby={accessLabel}>
        <GroupLabel id={accessLabel} label="Access" hint="only what you have" />
        <ul className="flex flex-col gap-2">
          {access.held.map((h) => {
            const Icon = TARGET_ICONS[h.target];
            const on = targets.includes(h.target);
            return (
              <li key={h.target}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 py-2.5 transition-colors duration-300 ease-out has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                    on ? "border-accent bg-accent/[0.08]" : "border-white-10 hover:border-border-strong"
                  }`}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(h.target)} className="sr-only" />
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border ${
                      on ? "border-accent bg-accent text-accent-on-accent" : "border-border-strong"
                    }`}
                  >
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  </span>
                  <Icon aria-hidden className={`h-4 w-4 shrink-0 ${on ? "text-accent" : "text-text-2"}`} strokeWidth={1.75} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{ACCESS_TARGET_LABELS[h.target]}</span>
                    <span className="block text-[12px] text-prt-muted">{access.division.name}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6" role="radiogroup" aria-labelledby={levelLabelId}>
        <GroupLabel id={levelLabelId} label="Level" />
        <div className="grid h-10 grid-cols-2 gap-1 rounded-[10px] border border-white-10 p-1">
          {(["view", "edit"] as const).map((l) => {
            const disabled = l === "edit" && !editAllowed;
            return (
              <label
                key={l}
                className={`flex items-center justify-center rounded-[7px] text-[14px] transition-colors duration-300 ease-out has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                  chosenLevel === l ? "bg-white-10 font-semibold text-prt-text" : "text-text-2"
                } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:text-prt-text"}`}
              >
                <input
                  type="radio"
                  name="level"
                  value={l}
                  checked={chosenLevel === l}
                  disabled={disabled}
                  onChange={() => setLevel(l)}
                  className="sr-only"
                />
                {l === "view" ? "Can view" : editLabelFor(targets)}
              </label>
            );
          })}
        </div>
      </div>

      {summary && (
        <p className="mt-6 flex items-start gap-2.5 rounded-[10px] border border-hairline px-4 py-3.5 text-[13px] leading-relaxed text-text-2">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
          {summary}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-[13px] text-danger">
          {error}
        </p>
      )}
    </Drawer>
  );
}
