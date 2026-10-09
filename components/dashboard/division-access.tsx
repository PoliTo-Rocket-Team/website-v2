"use client";

import { useId, useState, type FormEvent } from "react";
import { BriefcaseBusiness, Check, ChevronDown, Inbox, Info, Trash2, UserPlus, Users, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  ACCESS_TARGETS,
  ACCESS_TARGET_LABELS,
  canGive,
  editLabelFor,
  grantSummary,
  levelLabel,
  shortUnitName,
  type AccessGrant,
  type AccessLevel,
  type AccessTarget,
  type DivisionAccess,
  type GiveAccess,
} from "@/lib/dashboard/division-access";
import { shortDate, type WriteResult } from "@/lib/dashboard/write";
import { Avatar } from "./avatar";
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

// Board 43: what the lead holds, the access they shared, and the Give access
// drawer. Props in, nothing fetched; the table lives in this page's state, so
// a grant given or removed shows at once.
export function DivisionAccessView({ access, ...actions }: { access: DivisionAccess } & Actions) {
  const [grants, setGrants] = useState(access.grants);
  const [open, setOpen] = useState(false);
  const unit = shortUnitName(access.division.name);

  const remove = async (grant: AccessGrant) => {
    const result = await actions.removeAccess(grant.id);
    if (!result.ok) {
      toast.error("Could not remove access", { description: result.error });
      return;
    }
    setGrants((all) => all.filter((g) => g.id !== grant.id));
    toast.success(`Removed ${grant.person.name}'s ${ACCESS_TARGET_LABELS[grant.target]} access`);
  };

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
        action={
          access.held.length > 0 && access.people.length > 0 ? (
            <button type="button" onClick={() => setOpen(true)} className={PRIMARY_PILL}>
              <UserPlus aria-hidden className="h-4 w-4" strokeWidth={2} />
              Give access
            </button>
          ) : undefined
        }
      />

      {access.held.length > 0 && (
        <section className="mt-6">
          <h2 className={EYEBROW}>Your access</h2>
          <ul className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {access.held.map((h) => {
              const Icon = TARGET_ICONS[h.target];
              return (
                <li key={h.target} className={`${PANEL} flex items-center gap-3 rounded-[10px] px-4 py-2.5`}>
                  <Icon aria-hidden className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">{ACCESS_TARGET_LABELS[h.target]}</span>
                    <span className="block truncate text-[12px] text-prt-muted">
                      {unit} · {levelLabel(h.target, h.level)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {grants.length > 0 && <GrantsTable grants={grants} unit={unit} onRemove={remove} />}

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

const ROW = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 md:grid-cols-[150px_minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_32px] md:px-[18px]";

/** "You · 2 Oct" */
function givenLine(g: AccessGrant): string {
  return [g.givenBy, g.givenOn && shortDate(g.givenOn)].filter(Boolean).join(" · ");
}

function GrantsTable({
  grants,
  unit,
  onRemove,
}: {
  grants: readonly AccessGrant[];
  unit: string;
  onRemove: (grant: AccessGrant) => void;
}) {
  return (
    <section aria-label="People you gave access" className={`${PANEL} mt-5 overflow-hidden`}>
      <div aria-hidden className={`${ROW} hidden h-9 border-b border-hairline md:grid`}>
        <span className={EYEBROW}>Person</span>
        <span className={EYEBROW}>Access</span>
        <span className={EYEBROW}>Level</span>
        <span className={EYEBROW}>Given by</span>
      </div>
      <ul className="divide-y divide-hairline">
        {grants.map((g) => (
          <li key={g.id} className={`${ROW} py-3`}>
            <span className="flex min-w-0 items-center gap-3">
              <Avatar name={g.person.name} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium">{g.person.name}</span>
                <span className="block text-[12px] text-prt-muted">{g.person.role}</span>
              </span>
            </span>
            <span className="col-start-1 row-start-2 text-[13px] text-text-2 md:col-start-auto md:row-start-auto">
              {ACCESS_TARGET_LABELS[g.target]} · {unit}
            </span>
            <span className="col-start-1 row-start-3 md:col-start-auto md:row-start-auto">
              <span className="inline-flex rounded-full bg-white-10 px-2.5 py-0.5 text-[12px] text-prt-text">
                {levelLabel(g.target, g.level)}
              </span>
              {g.givenBy && <span className="ml-2 text-[12px] text-prt-muted md:hidden">{givenLine(g)}</span>}
            </span>
            <span className="hidden text-[13px] text-prt-muted md:block">{givenLine(g)}</span>
            <button
              type="button"
              onClick={() => onRemove(g)}
              aria-label={`Remove ${g.person.name}'s ${ACCESS_TARGET_LABELS[g.target]} access`}
              className="col-start-2 row-span-3 row-start-1 flex h-8 w-8 items-center justify-center justify-self-end rounded-full text-prt-muted transition-colors duration-300 ease-out hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:col-start-auto md:row-span-1 md:row-start-auto"
            >
              <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </button>
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
