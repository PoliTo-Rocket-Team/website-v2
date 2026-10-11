"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  Inbox,
  Info,
  Layers,
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
  homePlace,
  PERSON_STANDING_LABELS,
  placeKey,
  placeLine,
  placesHeldBy,
  placesOf,
  samePlace,
  shortUnitName,
  unitLine,
  type AccessGrant,
  type AccessLevel,
  type AccessPage,
  type AccessPerson,
  type AccessPlace,
  type AccessTarget,
  type AccessUnit,
  type AreaLevels,
  type PersonAccess,
  type RoleAccess,
  type SaveAccess,
} from "@/lib/dashboard/division-access";
import { divisionTabs, inDivisionTab, type DivisionTab } from "@/lib/dashboard/division-tabs";
import { shortDate, type WriteResult } from "@/lib/dashboard/write";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { DivisionTabs } from "./division-tabs";
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

/** A row of the table: a lead whose access comes with the role, or someone the viewer's unit shared access with. */
type Row = { readonly kind: "role"; readonly role: RoleAccess } | { readonly kind: "grants"; readonly access: PersonAccess };

function personOfRow(row: Row): AccessPerson {
  return row.kind === "role" ? row.role.person : row.access.person;
}

function rowKey(row: Row): string {
  return `${row.kind}-${personOfRow(row).id}`;
}

/** "Lead · Mission Analysis", "Member" on a lead's page, "Member · Mission Analysis" on a head's (boards 60 and 65). */
function standingLine(person: AccessPerson, unit: AccessUnit): string {
  const label = PERSON_STANDING_LABELS[person.standing];
  const showDivision = person.division !== null && (person.standing === "lead" || unit.kind === "department");
  return showDivision ? `${label} · ${shortUnitName(person.division!.name)}` : label;
}

/** Whether the viewer may change anything of this person's access, in any place they hold it. */
function changeableIn(access: AccessPage, grants: readonly AccessGrant[], person: AccessPerson): boolean {
  return placesHeldBy(access.unit, grants, person.id).some((place) =>
    canChangePerson(access.held, person, areaLevelsOf(grants, person.id, place)),
  );
}

// Boards 60, 60b, 60c and 60m (a division lead, issues #213 and #230) and 65,
// 65b and 65m (a department head, issue #230): what the viewer holds, the
// other leads with the access their role gives (locked), one row per person
// the unit shared access with, and the Give access and Edit access drawers.
// A head's page has division tabs, starting on All divisions, and a Where
// field in the drawers. This is the only dashboard page that gives, changes
// or removes access. Props in, nothing fetched; the grants live in this
// page's state, so a save shows at once. Remove all access asks first.
export function DivisionAccessView({ access, ...actions }: { access: AccessPage } & Actions) {
  const [grants, setGrants] = useState(access.grants);
  const [open, setOpen] = useState<Open>(CLOSED);
  const [divisionTab, setDivisionTab] = useState<DivisionTab>(null);
  const unit = access.unit;
  const department = unit.kind === "department";
  const allRows: Row[] = [
    ...access.roleAccess.map((role): Row => ({ kind: "role", role })),
    ...accessByPerson(grants).map((row): Row => ({ kind: "grants", access: row })),
  ];
  const divisionOptions =
    unit.kind === "department"
      ? divisionTabs(
          unit.divisions.map((d) => d.name),
          allRows.map((row) => personOfRow(row).division?.name ?? null),
        )
      : null;
  const rows = allRows.filter((row) => inDivisionTab(personOfRow(row).division?.name ?? null, divisionTab));
  const editing = open.kind === "edit" ? (access.people.find((p) => p.id === open.personId) ?? null) : null;
  const openRow = (person: AccessPerson) => setOpen({ kind: "edit", personId: person.id });
  const changeable = (row: Row) => row.kind === "grants" && changeableIn(access, grants, row.access.person);

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
        intro={`Share what you can do with people in your ${unit.kind}. You can only give access you have.`}
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

      {/* On phones the division pill comes first (board 65m); from md the tabs sit under Your access (board 65). */}
      {divisionOptions && (
        <div className="md:hidden">
          <DivisionTabs options={divisionOptions} value={divisionTab} onChange={setDivisionTab} />
        </div>
      )}

      {access.held.length > 0 && <YourAccess access={access} drawerOpen={open.kind !== "none"} />}

      {divisionOptions && (
        <div className="mt-5 hidden md:block">
          <DivisionTabs options={divisionOptions} value={divisionTab} onChange={setDivisionTab} />
        </div>
      )}

      {rows.length > 0 && (
        <>
          <section aria-label="People with access" className="mt-6 md:hidden">
            <h2 className={EYEBROW}>People with access</h2>
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {rows.map((row) => (
                <li key={rowKey(row)}>
                  <PersonCard
                    row={row}
                    unit={unit}
                    onOpen={changeable(row) ? () => openRow(personOfRow(row)) : null}
                    department={department}
                  />
                </li>
              ))}
            </ul>
          </section>
          <AccessTable rows={rows} unit={unit} changeable={changeable} onOpen={openRow} department={department} />
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

/**
 * "Your access · Mission Analysis Division" and a chip per area (boards 60 and 65); cards on a phone (60m, 65m).
 * The chips keep one line, as boards 60 and 60c do: an open drawer leaves the
 * page too narrow for four "Can edit" chips below 1376px, so there they read
 * "Edit", the short level the phone cards use (issue #227).
 */
function YourAccess({ access, drawerOpen }: { access: AccessPage; drawerOpen: boolean }) {
  return (
    <section aria-label="Your access" className="mt-6 max-md:mt-4">
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
          <span className="text-[13px] text-prt-text">· {unitLine(access.unit)}</span>
        </h2>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {access.held.map((h) => (
            <li key={h.target}>
              <AreaChip target={h.target} level={h.level} iconTone="text-accent" shortLevel={drawerOpen} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * An area and its level: "Positions Can edit", the level orange at Can edit (boards 60 and 60m).
 * With `shortLevel`, the level reads "Edit" where an open drawer leaves the row short (YourAccess).
 * A grant across a whole department carries a "Whole department" tag on a head's page (board 65).
 */
function AreaChip({
  target,
  level,
  iconTone = "text-text-2",
  shortLevel = false,
  wholeDepartment = false,
}: {
  target: AccessTarget;
  level: AccessLevel;
  iconTone?: string;
  shortLevel?: boolean;
  wholeDepartment?: boolean;
}) {
  const Icon = TARGET_ICONS[target];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white-5 px-2 py-0.5 text-[12px]">
      <Icon aria-hidden className={`h-3.5 w-3.5 shrink-0 ${iconTone}`} strokeWidth={1.75} />
      <span className="text-prt-text">{ACCESS_TARGET_LABELS[target]}</span>
      <span className={level === "edit" ? "text-accent" : "text-prt-muted"}>
        <span className={shortLevel ? "xl:max-[1375px]:hidden" : undefined}>{ACCESS_LEVEL_LABELS[level]}</span>
        {shortLevel && <span className="hidden xl:max-[1375px]:inline">{ACCESS_LEVEL_SHORT_LABELS[level]}</span>}
      </span>
      {wholeDepartment && (
        <span className="rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-medium text-accent">Whole department</span>
      )}
    </span>
  );
}

/** "Whole division Can edit": the access a lead's role gives, in their whole division (boards 60 and 65). */
function RoleChip({ place }: { place: AccessPlace }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white-5 px-2 py-0.5 text-[12px]">
      <Layers aria-hidden className="h-3.5 w-3.5 shrink-0 text-text-2" strokeWidth={1.75} />
      <span className="text-prt-text">{place.kind === "division" ? "Whole division" : "Whole department"}</span>
      <span className="text-accent">{ACCESS_LEVEL_LABELS.edit}</span>
    </span>
  );
}

function GrantChips({ grants, department }: { grants: readonly AccessGrant[]; department: boolean }) {
  return (
    <>
      {grants.map((g) => (
        <AreaChip key={g.id} target={g.target} level={g.level} wholeDepartment={department && g.place.kind === "department"} />
      ))}
    </>
  );
}

/** "You · 2 Oct" */
function givenLine(row: Pick<PersonAccess, "givenBy" | "givenOn">): string {
  return [row.givenBy, row.givenOn && shortDate(row.givenOn)].filter(Boolean).join(" · ");
}

/** "Given by you · 2 Oct" on a head's phone card (board 65m). */
function givenByLine(row: Pick<PersonAccess, "givenBy" | "givenOn">): string {
  if (row.givenBy === null) return givenLine(row);
  return givenLine({ ...row, givenBy: `Given by ${row.givenBy === "You" ? "you" : row.givenBy}` });
}

/** The words a screen reader hears for a row: "Sara Conti, Applications Can view, Positions Can edit". */
function rowLabel(row: PersonAccess): string {
  return [row.person.name, ...row.grants.map((g) => `${ACCESS_TARGET_LABELS[g.target]} ${ACCESS_LEVEL_LABELS[g.level]}`)].join(", ");
}

/** A person's card on a phone (boards 60m and 65m): name, the line under it, the chips; a tap opens Edit access. */
function PersonCard({
  row,
  unit,
  onOpen,
  department,
}: {
  row: Row;
  unit: AccessUnit;
  onOpen: (() => void) | null;
  department: boolean;
}) {
  const person = personOfRow(row);
  const line =
    row.kind === "role"
      ? `${standingLine(person, unit)} · with the role`
      : (department ? givenByLine(row.access) : givenLine(row.access)) || PERSON_STANDING_LABELS[person.standing];
  const inner = (
    <>
      <span className="flex items-center gap-3">
        <Avatar name={person.name} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{person.name}</span>
          <span className="block truncate text-[13px] text-prt-muted">{line}</span>
        </span>
        {onOpen && <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />}
        {row.kind === "role" && <Lock aria-label="Comes with the role" className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />}
      </span>
      <span className="mt-2.5 flex flex-wrap gap-1.5">
        {row.kind === "role" ? <RoleChip place={row.role.place} /> : <GrantChips grants={row.access.grants} department={department} />}
      </span>
    </>
  );
  const card = `${PANEL} block w-full px-4 py-3 text-left`;
  return onOpen && row.kind === "grants" ? (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${rowLabel(row.access)}. Edit access`}
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
  unit,
  changeable,
  onOpen,
  department,
}: {
  rows: readonly Row[];
  unit: AccessUnit;
  changeable: (row: Row) => boolean;
  onOpen: (person: AccessPerson) => void;
  department: boolean;
}) {
  return (
    <section aria-label="People with access" className={`${PANEL} ${TABLE_COLUMNS} mt-5 hidden overflow-hidden md:grid`}>
      <div aria-hidden className={`${ROW} h-9 border-b border-hairline`}>
        <span className={EYEBROW}>Person</span>
        <span className={EYEBROW}>Access</span>
        <span className={`${EYEBROW} whitespace-nowrap`}>Given by</span>
      </div>
      <ul className="col-span-full grid grid-cols-subgrid divide-y divide-hairline">
        {rows.map((row) => {
          const person = personOfRow(row);
          const cells = (
            <>
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={person.name} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{person.name}</span>
                  <span className="block truncate text-[12px] text-prt-muted">{standingLine(person, unit)}</span>
                </span>
              </span>
              <span className="flex flex-col items-start gap-1">
                {row.kind === "role" ? <RoleChip place={row.role.place} /> : <GrantChips grants={row.access.grants} department={department} />}
              </span>
              <span className="whitespace-nowrap text-[13px] text-prt-muted">{row.kind === "role" ? "With the role" : givenLine(row.access)}</span>
            </>
          );
          return (
            <li key={rowKey(row)} className="col-span-full grid grid-cols-subgrid">
              {row.kind === "grants" && changeable(row) ? (
                <button
                  type="button"
                  onClick={() => onOpen(person)}
                  aria-label={`${rowLabel(row.access)}. Edit access`}
                  className={`${ROW} py-3 text-left transition-colors duration-300 ease-out hover:bg-white-5 ${FOCUS} focus-visible:-outline-offset-2`}
                >
                  {cells}
                  <ChevronRight aria-hidden className="h-4 w-4 text-prt-muted" strokeWidth={1.75} />
                </button>
              ) : (
                <div className={`${ROW} py-3`}>
                  {cells}
                  {row.kind === "role" ? (
                    <Lock aria-label="Comes with the role" className="h-4 w-4 text-prt-muted" strokeWidth={1.75} />
                  ) : (
                    <span />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Aerodynamics · both divisions, and any added later" under Whole department (board 65b). */
function wholeDepartmentLine(unit: Extract<AccessUnit, { kind: "department" }>): string {
  const n = unit.divisions.length;
  const which = n === 2 ? "both divisions" : n === 1 ? "its division" : `all ${n} divisions`;
  return `${unit.department.name} · ${which}, and any added later`;
}

/**
 * Give access (boards 60b and 65b) or Edit access (60c): one person, on a
 * head's page the place (Where), a tick per area, and a level per ticked
 * area, up to the viewer's own. Save makes the person's areas in that place
 * exactly what is ticked. On Edit the person is locked, and Remove all
 * access, after a confirm, takes every area away in every place.
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
  access: AccessPage;
  grants: readonly AccessGrant[];
  editing: AccessPerson | null;
  actions: Actions;
  onSaved: (personId: number, grants: readonly AccessGrant[]) => void;
}) {
  const unit = access.unit;
  const grantable = access.people.filter((p) => p.standing === "member");
  // Give access opens on the first person who has no access yet; Edit access on the first place the person holds any.
  const firstFree = grantable.find((p) => !grants.some((g) => g.person.id === p.id)) ?? grantable[0];
  const [personId, setPersonId] = useState<number | undefined>(editing?.id ?? firstFree?.id);
  const [place, setPlace] = useState<AccessPlace>(() =>
    editing ? (placesHeldBy(unit, grants, editing.id)[0] ?? homePlace(unit)) : homePlace(unit),
  );
  const [areas, setAreas] = useState<AreaLevels>(() => (personId === undefined ? {} : areaLevelsOf(grants, personId, place)));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [removing, startRemoving] = useTransition();
  const areasLabel = useId();
  const whereLabel = useId();

  const person = access.people.find((p) => p.id === personId);
  const current = personId === undefined ? {} : areaLevelsOf(grants, personId, place);
  // The areas the viewer holds, and any other the person holds, which shows locked.
  const shown = ACCESS_TARGETS.filter((t) => heldLevel(access.held, t) !== null || current[t] !== undefined);

  const choosePerson = (id: number) => {
    setPersonId(id);
    setAreas(areaLevelsOf(grants, id, place));
    setError(undefined);
  };
  const choosePlace = (next: AccessPlace) => {
    setPlace(next);
    if (personId !== undefined) setAreas(areaLevelsOf(grants, personId, next));
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
      // A lead's division is their only place, so their page sends none.
      const where = unit.kind === "department" ? { where: placeKey(place) } : {};
      const result = await actions.saveAccess({ personId, ...where, areas });
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

  const removable =
    editing !== null &&
    placesHeldBy(unit, grants, editing.id).every((held) => {
      const levels = areaLevelsOf(grants, editing.id, held);
      return ACCESS_TARGETS.every((t) => levels[t] === undefined || areaRule(access.held, editing, t, levels[t]).changeable);
    });

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
          <Field label="Person" hint={`from your ${unit.kind}`}>
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
                  {grantable.map((p) => (
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

        {unit.kind === "department" && (
          <div className="mt-6" role="radiogroup" aria-labelledby={whereLabel}>
            <GroupLabel id={whereLabel} label="Where" hint="the whole department or one division" />
            <div className="flex flex-col gap-1 rounded-[10px] border border-white-10 p-1">
              {placesOf(unit).map((option) => {
                const chosen = samePlace(option, place);
                return (
                  <label
                    key={String(placeKey(option))}
                    className={`flex cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2 transition-colors duration-300 ease-out has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                      chosen ? "bg-white-10" : "hover:bg-white-5"
                    }`}
                  >
                    <input
                      type="radio"
                      name={whereLabel}
                      checked={chosen}
                      onChange={() => choosePlace(option)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        chosen ? "border-accent" : "border-border-strong"
                      }`}
                    >
                      {chosen && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium">
                        {option.kind === "department" ? "Whole department" : option.division.name}
                      </span>
                      <span className="block truncate text-[12px] text-prt-muted">
                        {option.kind === "department" ? wholeDepartmentLine(unit) : "Only this division"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6" role="group" aria-labelledby={areasLabel}>
          <GroupLabel id={areasLabel} label="Access" hint="per area, up to your own level" />
          <ul className="flex flex-col gap-2">
            {shown.map((target) => (
              <li key={target}>
                <AreaOption
                  target={target}
                  placeName={placeLine(place)}
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
        description={editing && `${editing.name.split(" ")[0]} can no longer see or change any area of ${unitLine(unit)}.`}
        cancelLabel="Cancel"
        confirmLabel="Remove all access"
        danger
        pending={removing}
        onConfirm={removeAll}
      />
    </>
  );
}

/** One area in a drawer: a tick, and when ticked, Can view or Can edit beneath it (boards 60b, 60c and 65b). */
function AreaOption({
  target,
  placeName,
  level,
  rule,
  onChange,
}: {
  target: AccessTarget;
  placeName: string;
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
          <span className="block truncate text-[12px] text-prt-muted">{placeName}</span>
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
