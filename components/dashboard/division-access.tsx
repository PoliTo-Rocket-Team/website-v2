"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  Inbox,
  Info,
  Lock,
  Plus,
  ShoppingCart,
  UserMinus,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  ACCESS_LEVEL_LABELS,
  ACCESS_LEVEL_SHORT_LABELS,
  ACCESS_LEVELS,
  ACCESS_LEVELS_EXPLAINED,
  ACCESS_TARGET_LABELS,
  ACCESS_TARGETS,
  accessByPerson,
  areaLevelsOf,
  areaRule,
  canChangePerson,
  heldLevel,
  PERSON_STANDING_LABELS,
  type AccessGrant,
  type AccessLevel,
  type AccessPerson,
  type AccessTarget,
  type AreaLevels,
  type DivisionAccess,
  type PersonAccess,
  type SaveAccess,
} from "@/lib/dashboard/division-access";
import { shortDate, type WriteResult } from "@/lib/dashboard/write";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { Drawer, DrawerPage, PANEL_DANGER_BUTTON } from "./drawer";
import { Field, GroupLabel, LOCKED_INPUT } from "./field";
import { PANEL } from "./panel";
import { EYEBROW, PageHeader, PRIMARY_PILL } from "./page-header";

const TARGET_ICONS: Readonly<Record<AccessTarget, LucideIcon>> = {
  positions: BriefcaseBusiness,
  applications: Inbox,
  members: Users,
  orders: ShoppingCart,
};

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

type Actions = {
  saveAccess: (input: SaveAccess) => Promise<WriteResult<readonly AccessGrant[]>>;
  removeAllAccess: (personId: number) => Promise<WriteResult<null>>;
};

type Open = { readonly kind: "none" } | { readonly kind: "give" } | { readonly kind: "edit"; readonly personId: number };
const CLOSED: Open = { kind: "none" };

// Boards 60, 60b, 60c and 60m (issue #213): what the lead holds, one row per
// person they shared it with, and the Give access and Edit access drawers.
// This is the only dashboard page that gives, changes or removes access.
// Props in, nothing fetched; the grants live in this page's state, so a save
// shows at once. Remove all access asks first.
export function DivisionAccessView({ access, ...actions }: { access: DivisionAccess } & Actions) {
  const [grants, setGrants] = useState(access.grants);
  const [open, setOpen] = useState<Open>(CLOSED);
  const rows = accessByPerson(grants);
  const editing = open.kind === "edit" ? (access.people.find((p) => p.id === open.personId) ?? null) : null;
  const openRow = (row: PersonAccess) => setOpen({ kind: "edit", personId: row.person.id });
  const changeable = (row: PersonAccess) => canChangePerson(access.held, row.person, areaLevelsOf(grants, row.person.id));

  // The person's grants after a save take their place in the table: their row
  // stays where it was, and a new row goes on top.
  const replacePerson = (personId: number, fresh: readonly AccessGrant[]) =>
    setGrants((all) => {
      const at = all.findIndex((g) => g.person.id === personId);
      const rest = all.filter((g) => g.person.id !== personId);
      return at === -1 ? [...fresh, ...rest] : [...rest.slice(0, at), ...fresh, ...rest.slice(at)];
    });

  return (
    <DrawerPage drawerOpen={open.kind !== "none"}>
      <PageHeader
        title="Access"
        intro="Share what you can do with people in your division. You can only give access you have."
        phone="bar"
        action={
          access.held.length > 0 && access.people.length > 0 ? (
            <button type="button" onClick={() => setOpen({ kind: "give" })} className={PRIMARY_PILL}>
              <UserPlus aria-hidden className="hidden h-4 w-4 md:block" strokeWidth={2} />
              <Plus aria-hidden className="h-4 w-4 md:hidden" strokeWidth={2} />
              <span className="md:hidden">Give</span>
              <span className="hidden md:inline">Give access</span>
            </button>
          ) : undefined
        }
      />

      {access.held.length > 0 && <YourAccess access={access} />}

      {rows.length > 0 && (
        <>
          <section aria-label="People with access" className="mt-6 md:hidden">
            <h2 className={EYEBROW}>People with access</h2>
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {rows.map((row) => (
                <li key={row.person.id}>
                  <PersonCard row={row} onOpen={changeable(row) ? () => openRow(row) : null} />
                </li>
              ))}
            </ul>
          </section>
          <AccessTable rows={rows} changeable={changeable} onOpen={openRow} />
        </>
      )}

      <AccessDrawer
        key={open.kind === "edit" ? `edit-${open.personId}` : open.kind}
        open={open.kind === "give" || editing !== null}
        onClose={() => setOpen(CLOSED)}
        access={access}
        grants={grants}
        editing={editing}
        actions={actions}
        onSaved={(personId, fresh) => {
          replacePerson(personId, fresh);
          setOpen(CLOSED);
        }}
      />
    </DrawerPage>
  );
}

/** "Your access · Mission Analysis Division" and a chip per area (board 60); cards on a phone (60m). */
function YourAccess({ access }: { access: DivisionAccess }) {
  return (
    <section aria-label="Your access" className="mt-6 max-md:mt-0">
      <h2 className={`${EYEBROW} md:hidden`}>Your access</h2>
      {/* One line of cards, each as wide as its name needs, so "Applications" stays whole at 390. */}
      <ul className="mt-2.5 flex gap-2 md:hidden">
        {access.held.map((h) => (
          <li key={h.target} className={`${PANEL} min-w-0 flex-auto rounded-[10px] px-2 py-2`}>
            <span className="block truncate text-[12px] font-semibold">{ACCESS_TARGET_LABELS[h.target]}</span>
            <span className="block truncate text-[11px] text-prt-muted">{ACCESS_LEVEL_SHORT_LABELS[h.level]}</span>
          </li>
        ))}
      </ul>
      <div className={`${PANEL} hidden px-4 py-3 md:block`}>
        <h2 className="flex items-baseline gap-2">
          <span className={EYEBROW}>Your access</span>
          <span className="text-[13px] text-prt-text">· {access.division.name}</span>
        </h2>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {access.held.map((h) => (
            <li key={h.target}>
              <AreaChip target={h.target} level={h.level} iconTone="text-accent" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** An area and its level: "Positions Can edit", the level orange at Can edit (boards 60 and 60m). */
function AreaChip({ target, level, iconTone = "text-text-2" }: { target: AccessTarget; level: AccessLevel; iconTone?: string }) {
  const Icon = TARGET_ICONS[target];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white-5 px-2 py-0.5 text-[12px]">
      <Icon aria-hidden className={`h-3.5 w-3.5 shrink-0 ${iconTone}`} strokeWidth={1.75} />
      <span className="text-prt-text">{ACCESS_TARGET_LABELS[target]}</span>
      <span className={level === "edit" ? "text-accent" : "text-prt-muted"}>{ACCESS_LEVEL_LABELS[level]}</span>
    </span>
  );
}

/** "You · 2 Oct" */
function givenLine(row: Pick<PersonAccess, "givenBy" | "givenOn">): string {
  return [row.givenBy, row.givenOn && shortDate(row.givenOn)].filter(Boolean).join(" · ");
}

/** The words a screen reader hears for a row: "Sara Conti, Applications Can view, Positions Can edit". */
function rowLabel(row: PersonAccess): string {
  return [row.person.name, ...row.grants.map((g) => `${ACCESS_TARGET_LABELS[g.target]} ${ACCESS_LEVEL_LABELS[g.level]}`)].join(", ");
}

/** A person's card on a phone (board 60m): name, who gave it, the chips; a tap opens Edit access. */
function PersonCard({ row, onOpen }: { row: PersonAccess; onOpen: (() => void) | null }) {
  const inner = (
    <>
      <span className="flex items-center gap-3">
        <Avatar name={row.person.name} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{row.person.name}</span>
          <span className="block truncate text-[13px] text-prt-muted">{givenLine(row) || PERSON_STANDING_LABELS[row.person.standing]}</span>
        </span>
        {onOpen && <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />}
      </span>
      <span className="mt-2.5 flex flex-wrap gap-1.5">
        {row.grants.map((g) => (
          <AreaChip key={g.id} target={g.target} level={g.level} />
        ))}
      </span>
    </>
  );
  const card = `${PANEL} block w-full px-4 py-3 text-left`;
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${rowLabel(row)}. Edit access`}
      className={`${card} transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`}
    >
      {inner}
    </button>
  ) : (
    <div className={card}>{inner}</div>
  );
}

// From md the header and every row are subgrids of one set of columns on the
// table, so Given by keeps its content on one line however narrow the page
// gets (the drawer takes 440px from xl) and the header still lines up with
// the rows. Below md the page shows cards instead.
const TABLE_COLUMNS = "grid grid-cols-[minmax(170px,1fr)_minmax(0,2.4fr)_minmax(max-content,0.75fr)_16px] gap-x-4";
const ROW = "col-span-full grid grid-cols-subgrid items-center px-6";

function AccessTable({
  rows,
  changeable,
  onOpen,
}: {
  rows: readonly PersonAccess[];
  changeable: (row: PersonAccess) => boolean;
  onOpen: (row: PersonAccess) => void;
}) {
  return (
    <section aria-label="People you gave access" className={`${PANEL} ${TABLE_COLUMNS} mt-5 hidden overflow-hidden md:grid`}>
      <div aria-hidden className={`${ROW} h-9 border-b border-hairline`}>
        <span className={EYEBROW}>Person</span>
        <span className={EYEBROW}>Access</span>
        <span className={`${EYEBROW} whitespace-nowrap`}>Given by</span>
      </div>
      <ul className="col-span-full grid grid-cols-subgrid divide-y divide-hairline">
        {rows.map((row) => {
          const cells = (
            <>
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={row.person.name} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{row.person.name}</span>
                  <span className="block text-[12px] text-prt-muted">{PERSON_STANDING_LABELS[row.person.standing]}</span>
                </span>
              </span>
              <span className="flex flex-col items-start gap-1">
                {row.grants.map((g) => (
                  <AreaChip key={g.id} target={g.target} level={g.level} />
                ))}
              </span>
              <span className="whitespace-nowrap text-[13px] text-prt-muted">{givenLine(row)}</span>
            </>
          );
          return (
            <li key={row.person.id} className="col-span-full grid grid-cols-subgrid">
              {changeable(row) ? (
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  aria-label={`${rowLabel(row)}. Edit access`}
                  className={`${ROW} py-3 text-left transition-colors duration-300 ease-out hover:bg-white-5 ${FOCUS} focus-visible:-outline-offset-2`}
                >
                  {cells}
                  <ChevronRight aria-hidden className="h-4 w-4 text-prt-muted" strokeWidth={1.75} />
                </button>
              ) : (
                <div className={`${ROW} py-3`}>
                  {cells}
                  <span />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Give access (board 60b) or Edit access (60c): one person, a tick per area,
 * and a level per ticked area, up to the lead's own. Save makes the person's
 * areas exactly what is ticked. On Edit the person is locked, and Remove all
 * access, after a confirm, takes every area away.
 */
function AccessDrawer({
  open,
  onClose,
  access,
  grants,
  editing,
  actions,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  access: DivisionAccess;
  grants: readonly AccessGrant[];
  editing: AccessPerson | null;
  actions: Actions;
  onSaved: (personId: number, grants: readonly AccessGrant[]) => void;
}) {
  // Give access opens on the first person who has no access yet.
  const firstFree = access.people.find((p) => !grants.some((g) => g.person.id === p.id)) ?? access.people[0];
  const [personId, setPersonId] = useState<number | undefined>(editing?.id ?? firstFree?.id);
  const [areas, setAreas] = useState<AreaLevels>(() => (personId === undefined ? {} : areaLevelsOf(grants, personId)));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [removing, startRemoving] = useTransition();
  const areasLabel = useId();

  const person = access.people.find((p) => p.id === personId);
  const current = personId === undefined ? {} : areaLevelsOf(grants, personId);
  // The areas the lead holds, and any other the person holds, which shows locked.
  const shown = ACCESS_TARGETS.filter((t) => heldLevel(access.held, t) !== null || current[t] !== undefined);

  const choosePerson = (id: number) => {
    setPersonId(id);
    setAreas(areaLevelsOf(grants, id));
    setError(undefined);
  };
  const setArea = (target: AccessTarget, level: AccessLevel | null) =>
    setAreas((all) => {
      const next = { ...all };
      if (level === null) delete next[target];
      else next[target] = level;
      return next;
    });

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (personId === undefined) return setError("Choose a person.");
    if (Object.keys(areas).length === 0) {
      return setError(editing ? "Choose at least one area, or remove all access." : "Choose at least one area.");
    }
    setError(undefined);
    setSubmitting(true);
    try {
      const result = await actions.saveAccess({ personId, areas });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved(personId, result.value);
      toast.success(editing ? `Saved ${person?.name ?? "their"}'s access` : `Gave ${person?.name ?? "them"} access`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const removeAll = () =>
    startRemoving(async () => {
      if (editing === null) return;
      const result = await actions.removeAllAccess(editing.id);
      if (!result.ok) {
        toast.error("Could not remove access", { description: result.error });
        return;
      }
      setConfirming(false);
      onSaved(editing.id, []);
      toast.success(`Removed ${editing.name}'s access`);
    });

  const removable = editing !== null && ACCESS_TARGETS.every((t) => current[t] === undefined || areaRule(access.held, editing, t, current[t]).changeable);

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => !next && onClose()}
        title={editing ? "Edit access" : "Give access"}
        submitLabel={editing ? "Save" : "Give access"}
        submitting={submitting}
        onSubmit={submit}
        secondary={
          editing && removable ? (
            <button type="button" onClick={() => setConfirming(true)} className={PANEL_DANGER_BUTTON}>
              Remove all access
            </button>
          ) : undefined
        }
      >
        {editing ? (
          <Field label="Person" hint="can't be changed">
            {(id) => (
              <div id={id} className={`${LOCKED_INPUT} gap-3 bg-white-5 pl-3 text-prt-text`}>
                <Avatar name={editing.name} size="sm" />
                <span className="truncate text-[15px]">{editing.name}</span>
                <Lock aria-label="Locked" className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
              </div>
            )}
          </Field>
        ) : (
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
                  onChange={(e) => choosePerson(Number(e.target.value))}
                  className="h-11 w-full cursor-pointer appearance-none rounded-[10px] border border-white-10 bg-white-5 pl-12 pr-10 text-[15px] text-prt-text transition-colors duration-300 ease-out focus:border-accent focus:outline-none"
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
        )}

        <div className="mt-6" role="group" aria-labelledby={areasLabel}>
          <GroupLabel id={areasLabel} label="Access" hint="per area, up to your own level" />
          <ul className="flex flex-col gap-2">
            {shown.map((target) => (
              <li key={target}>
                <AreaOption
                  target={target}
                  divisionName={access.division.name}
                  level={areas[target] ?? null}
                  rule={person ? areaRule(access.held, person, target, current[target] ?? null) : { changeable: false }}
                  onChange={(level) => setArea(target, level)}
                />
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 flex items-start gap-3 rounded-[10px] border border-hairline px-4 py-3.5 text-[13px] leading-relaxed text-text-2">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
          {ACCESS_LEVELS_EXPLAINED}
        </p>

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-danger">
            {error}
          </p>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(next) => !next && setConfirming(false)}
        icon={<UserMinus className="h-5 w-5" strokeWidth={1.75} />}
        title={editing ? `Remove ${editing.name}'s access?` : "Remove access?"}
        description={editing && `${editing.name.split(" ")[0]} can no longer see or change any area of ${access.division.name}.`}
        cancelLabel="Cancel"
        confirmLabel="Remove all access"
        danger
        pending={removing}
        onConfirm={removeAll}
      />
    </>
  );
}

/** One area in a drawer: a tick, and when ticked, Can view or Can edit beneath it (boards 60b and 60c). */
function AreaOption({
  target,
  divisionName,
  level,
  rule,
  onChange,
}: {
  target: AccessTarget;
  divisionName: string;
  level: AccessLevel | null;
  rule: ReturnType<typeof areaRule>;
  onChange: (level: AccessLevel | null) => void;
}) {
  const Icon = TARGET_ICONS[target];
  const on = level !== null;
  const locked = !rule.changeable;
  const levelGroup = useId();
  return (
    <div
      className={`rounded-[10px] border px-3 py-2.5 transition-colors duration-300 ease-out ${
        on ? "border-accent/60 bg-accent/[0.06]" : "border-white-10"
      } ${locked ? "opacity-50" : on ? "" : "hover:border-border-strong"}`}
    >
      <label className={`flex items-center gap-3 ${locked ? "cursor-not-allowed" : "cursor-pointer"} has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-accent`}>
        <input
          type="checkbox"
          checked={on}
          disabled={locked}
          onChange={() => onChange(on ? null : "view")}
          className="sr-only"
        />
        <span
          aria-hidden
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border ${
            on ? "border-accent bg-accent text-accent-on-accent" : "border-border-strong"
          }`}
        >
          {on && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
        </span>
        <Icon aria-hidden className={`h-[18px] w-[18px] shrink-0 ${on ? "text-accent" : "text-text-2"}`} strokeWidth={1.75} />
        <span className="min-w-0">
          <span className="block text-[14px] font-medium">{ACCESS_TARGET_LABELS[target]}</span>
          <span className="block truncate text-[12px] text-prt-muted">{divisionName}</span>
        </span>
      </label>
      {on && (
        <div
          role="radiogroup"
          aria-label={`${ACCESS_TARGET_LABELS[target]} level`}
          className="mt-2.5 grid h-9 grid-cols-2 gap-1 rounded-[8px] border border-white-10 p-1"
        >
          {ACCESS_LEVELS.map((l) => {
            const disabled = locked || (l === "edit" && rule.changeable && rule.highest !== "edit");
            return (
              <label
                key={l}
                className={`flex items-center justify-center rounded-[6px] text-[13px] transition-colors duration-300 ease-out has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                  level === l ? "bg-white-10 font-semibold text-prt-text" : "text-text-2"
                } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:text-prt-text"}`}
              >
                <input
                  type="radio"
                  name={levelGroup}
                  value={l}
                  checked={level === l}
                  disabled={disabled}
                  onChange={() => onChange(l)}
                  className="sr-only"
                />
                {ACCESS_LEVEL_LABELS[l]}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
