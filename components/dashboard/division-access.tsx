"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  GraduationCap,
  Inbox,
  Info,
  Layers,
  Lock,
  Plus,
  ShieldCheck,
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
  departmentOfPlace,
  heldLevel,
  holdsApproveOrders,
  holdsEveryArea,
  homePlace,
  PERSON_STANDING_LABELS,
  placeKey,
  placeLine,
  placesHeldBy,
  placesOf,
  samePlace,
  SEAT_LABELS,
  shortUnitName,
  targetsAt,
  unitLine,
  WHOLE_TEAM_PLACE,
  type AccessDepartmentUnit,
  type AccessGrant,
  type AccessLevel,
  type AccessPage,
  type AccessPerson,
  type AccessPlace,
  type AccessTarget,
  type AccessUnit,
  type AreaLevels,
  type ApproveOrdersHolder,
  type PersonAccess,
  type RoleAccess,
  type SaveAccess,
} from "@/lib/dashboard/division-access";
import { ALL_DEPARTMENTS_LABEL, divisionTabs, inDivisionTab, type DivisionTab } from "@/lib/dashboard/division-tabs";
import { shortDate, type WriteResult } from "@/lib/dashboard/write";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { FilterMenu, Segmented } from "./controls";
import { DivisionTabs } from "./division-tabs";
import { Drawer, DrawerPage, PANEL_DANGER_BUTTON } from "./drawer";
import { Field, GroupLabel, LOCKED_INPUT } from "./field";
import { PANEL } from "./panel";
import { EYEBROW, PageHeader, PRIMARY_PILL } from "./page-header";

const TARGET_ICONS: Readonly<Record<AccessTarget, LucideIcon>> = {
  positions: BriefcaseBusiness,
  applications: Inbox,
  members: Users,
  alumni: GraduationCap,
  orders: ShoppingCart,
};

/** The tabs over a team page's table (board 71): everyone, the full-access seats, and the holders of "Approve orders". */
const ACCESS_TABS = ["everyone", "full-access", "approve-orders"] as const;
type AccessTab = (typeof ACCESS_TABS)[number];

const ACCESS_TAB_LABELS: Readonly<Record<AccessTab, string>> = {
  everyone: "Everyone",
  "full-access": "Full access",
  "approve-orders": "Approve orders",
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

/** "Lead · Mission Analysis", "Member" on a lead's page, "Member · Mission Analysis" on a head's or a team page (boards 60 and 65). */
function standingLine(person: AccessPerson, unit: AccessUnit): string {
  const label = PERSON_STANDING_LABELS[person.standing];
  const showDivision = person.division !== null && (person.standing === "lead" || unit.kind !== "division");
  return showDivision ? `${label} · ${shortUnitName(person.division!.name)}` : label;
}

/** The line under a name: a role row names its seat or the department it heads (board 71), anyone else their standing. */
function personLine(row: Row, unit: AccessUnit): string {
  if (row.kind === "role") {
    const role = row.role;
    if (role.place.kind === "team" && "seat" in role) return SEAT_LABELS[role.seat];
    if (role.place.kind === "department") return `Head of ${role.place.department.name}`;
  }
  return standingLine(personOfRow(row), unit);
}

/** "your division", "your department", "the whole team": who the page gives access to. */
function unitWords(unit: AccessUnit): string {
  return unit.kind === "team" ? "the whole team" : `your ${unit.kind}`;
}

/** Whether a row shows under a team page's tab (board 71). */
function inAccessTab(row: Row, tab: AccessTab): boolean {
  switch (tab) {
    case "everyone":
      return true;
    case "full-access":
      return row.kind === "role" && row.role.place.kind === "team";
    case "approve-orders":
      return row.kind === "grants" && row.access.approveOrders;
  }
}

/** The line under the title: what the viewer may give (boards 60, 65 and 71). */
function introOf(access: AccessPage): string {
  if (access.unit.kind !== "team") return `Share what you can do with people in ${unitWords(access.unit)}. You can only give access you have.`;
  return access.approveOrders.canGive
    ? "Share access with anyone on the team. You can give every kind of access."
    : "Share access with anyone on the team. You can give every kind of access but Approve orders, which is the team leader's.";
}

/** The department a row belongs to on a team page (issue #238): its division's, else the department its access is in. */
function rowDepartment(row: Row, unit: AccessUnit): string | null {
  const person = personOfRow(row);
  const place: AccessPlace | undefined =
    person.division !== null ? { kind: "division", division: person.division } : row.kind === "role" ? row.role.place : row.access.grants[0]?.place;
  return place === undefined ? null : (departmentOfPlace(unit, place)?.name ?? null);
}

/** Whether the viewer may change anything of this person's access, in any place they hold it. */
function changeableIn(access: AccessPage, grants: readonly AccessGrant[], person: AccessPerson): boolean {
  return placesHeldBy(access.unit, grants, person.id).some((place) =>
    canChangePerson(access.held, person, areaLevelsOf(grants, person.id, place)),
  );
}

// Boards 60, 60b, 60c and 60m (a division lead, issues #213 and #230) and 65,
// 65b, 65c and 65m (a department head, issue #230): what the viewer holds, the
// other leads with the access their role gives (locked), one row per person
// the unit shared access with, and the Give access and Edit access drawers.
// A head's page has division tabs, starting on All divisions, and a Where
// field in the drawers. A full-access page (issue #238) is the same across
// the whole team: department tabs, starting on All departments, and a Where
// field over every department and division. This is the only dashboard page
// that gives, changes or removes access. Props in, nothing fetched; the
// grants live in this page's state, so a save shows at once. Remove all
// access asks first.
export function DivisionAccessView({ access: initial, ...actions }: { access: AccessPage } & Actions) {
  const [grants, setGrants] = useState(initial.grants);
  const [holders, setHolders] = useState(initial.approveOrders.holders);
  const [open, setOpen] = useState<Open>(CLOSED);
  const [divisionTab, setDivisionTab] = useState<DivisionTab>(null);
  const [accessTab, setAccessTab] = useState<AccessTab>("everyone");
  // The page as this session left it: the holders of "Approve orders" change with each save.
  const access: AccessPage = { ...initial, approveOrders: { ...initial.approveOrders, holders } };
  const unit = access.unit;
  // A grant across a whole department carries the "Whole department" tag on a head's and a team page.
  const department = unit.kind !== "division";
  const allRows: Row[] = [
    ...access.roleAccess.map((role): Row => ({ kind: "role", role })),
    ...accessByPerson(grants, holders).map((row): Row => ({ kind: "grants", access: row })),
  ];
  // Each row's tab: its division on a head's page, its department on a team page.
  const tabOf = (row: Row): string | null => (unit.kind === "team" ? rowDepartment(row, unit) : (personOfRow(row).division?.name ?? null));
  const divisionOptions =
    unit.kind === "department"
      ? divisionTabs(
          unit.divisions.map((d) => d.name),
          allRows.map(tabOf),
        )
      : unit.kind === "team"
        ? divisionTabs(
            unit.departments.map((d) => d.department.name),
            allRows.map(tabOf),
            ALL_DEPARTMENTS_LABEL,
          )
        : null;
  const tabsOver = unit.kind === "team" ? "department" : "division";
  const inDepartment = allRows.filter((row) => inDivisionTab(tabOf(row), divisionTab));
  const rows = inDepartment.filter((row) => inAccessTab(row, accessTab));
  const editing = open.kind === "edit" ? (access.people.find((p) => p.id === open.personId) ?? null) : null;
  const openRow = (person: AccessPerson) => setOpen({ kind: "edit", personId: person.id });
  // A holder of "Approve orders" opens for the team leader, who alone changes it.
  const changeable = (row: Row) =>
    row.kind === "grants" && (changeableIn(access, grants, row.access.person) || (row.access.approveOrders && access.approveOrders.canGive));

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
        intro={introOf(access)}
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
      {divisionOptions && unit.kind !== "team" && (
        <div className="md:hidden">
          <DivisionTabs options={divisionOptions} value={divisionTab} onChange={setDivisionTab} over={tabsOver} />
        </div>
      )}

      {access.held.length > 0 && <YourAccess access={access} drawerOpen={open.kind !== "none"} />}

      {divisionOptions && unit.kind !== "team" && (
        <div className="mt-5 hidden md:block">
          <DivisionTabs options={divisionOptions} value={divisionTab} onChange={setDivisionTab} over={tabsOver} />
        </div>
      )}

      {/* A team page: who to show, and in which department (board 71). */}
      {unit.kind === "team" && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Segmented
            label="Show people"
            value={accessTab}
            onChange={setAccessTab}
            options={ACCESS_TABS.map((tab) => ({ value: tab, label: ACCESS_TAB_LABELS[tab], count: inDepartment.filter((row) => inAccessTab(row, tab)).length }))}
          />
          {divisionOptions && (
            <FilterMenu
              label="Department"
              allLabel={ALL_DEPARTMENTS_LABEL}
              value={divisionTab}
              onChange={setDivisionTab}
              options={divisionOptions.flatMap((o) => (o.division === null ? [] : [{ value: o.division, label: o.label }]))}
            />
          )}
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
          <AccessTable
            rows={rows}
            unit={unit}
            changeable={changeable}
            onOpen={openRow}
            department={department}
            drawerOpen={open.kind !== "none"}
          />
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
        onSaved={(personId, fresh, approves) => {
          replacePerson(personId, fresh);
          if (approves !== null) {
            const person = access.people.find((p) => p.id === personId);
            setHolders((all) => {
              const rest = all.filter((h) => h.person.id !== personId);
              const given: ApproveOrdersHolder | null =
                approves && person ? { person, givenBy: "You", givenOn: new Date().toISOString().slice(0, 10) } : null;
              return given === null ? rest : [given, ...rest];
            });
          }
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
  // Full access holds every area at Can edit: one "Every area" chip, and "Approve orders" for whoever decides orders (board 71).
  const every = access.unit.kind === "team" && holdsEveryArea(access.held);
  const approves = access.approveOrders.yours;
  const cards = [
    ...(every
      ? [{ key: "every", name: "Every area", level: ACCESS_LEVEL_SHORT_LABELS.edit }]
      : access.held.map((h) => ({ key: h.target, name: ACCESS_TARGET_LABELS[h.target], level: ACCESS_LEVEL_SHORT_LABELS[h.level] }))),
    ...(approves ? [{ key: "approve-orders", name: "Approve orders", level: "Decide" }] : []),
  ];
  return (
    <section aria-label="Your access" className="mt-6 max-md:mt-4">
      <h2 className={`${EYEBROW} md:hidden`}>Your access</h2>
      {/* One line of cards, each as wide as its name needs, so "Applications" stays whole at 390. */}
      <ul className="mt-2.5 flex gap-2 md:hidden">
        {cards.map((c) => (
          <li key={c.key} className={`${PANEL} min-w-0 flex-auto rounded-[10px] px-2 py-2`}>
            <span className="block truncate text-[12px] font-semibold">{c.name}</span>
            <span className="block truncate text-[11px] text-prt-muted">{c.level}</span>
          </li>
        ))}
      </ul>
      <div className={`${PANEL} hidden px-4 py-3 md:block`}>
        <h2 className="flex items-baseline gap-2">
          <span className={EYEBROW}>Your access</span>
          <span className="text-[13px] text-prt-text">· {access.unit.kind === "team" ? "Full access, whole team" : unitLine(access.unit)}</span>
        </h2>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {every ? (
            <li>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[12px] bg-white-5 px-2 py-0.5 text-[12px]">
                <ShieldCheck aria-hidden className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.75} />
                <span className="text-prt-text">Every area</span>
                <LevelLabel level="edit" short={false} />
              </span>
            </li>
          ) : (
            access.held.map((h) => (
              <li key={h.target}>
                <AreaChip target={h.target} level={h.level} iconTone="text-accent" shortLevel={drawerOpen} />
              </li>
            ))
          )}
          {approves && (
            <li>
              <ApproveOrdersChip iconTone="text-accent" />
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

/** "Approve orders": a team-wide right with no level (boards 71 and 71b). */
function ApproveOrdersChip({ iconTone = "text-text-2" }: { iconTone?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[12px] bg-white-5 px-2 py-0.5 text-[12px]">
      <CircleCheck aria-hidden className={`h-3.5 w-3.5 shrink-0 ${iconTone}`} strokeWidth={1.75} />
      <span className="text-prt-text">Approve orders</span>
    </span>
  );
}

/** The accent tag on a chip that names where it applies beyond one division: "Whole department", "Whole team". */
function PlaceTag({ children }: { children: string }) {
  return <span className="whitespace-nowrap rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-medium text-accent">{children}</span>;
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
  tag = null,
}: {
  target: AccessTarget;
  level: AccessLevel;
  iconTone?: string;
  shortLevel?: boolean;
  /** "Whole department" or "Whole team" where the grant is wider than one division (boards 65 and 71). */
  tag?: string | null;
}) {
  const Icon = TARGET_ICONS[target];
  // The area and its level never break apart. The tag stays on the same line
  // where the column has room (board 65c) and drops to a second line inside
  // the chip where it has not, so it never runs into the Given by column.
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-[12px] bg-white-5 px-2 py-0.5 text-[12px]">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Icon aria-hidden className={`h-3.5 w-3.5 shrink-0 ${iconTone}`} strokeWidth={1.75} />
        <span className="text-prt-text">{ACCESS_TARGET_LABELS[target]}</span>
        <LevelLabel level={level} short={shortLevel} />
      </span>
      {tag !== null && <PlaceTag>{tag}</PlaceTag>}
    </span>
  );
}

/** "Can edit" in accent, "Can view" muted; with `short`, "Edit" or "View" where an open drawer leaves the page short (issue #227). */
function LevelLabel({ level, short }: { level: AccessLevel; short: boolean }) {
  return (
    <span className={level === "edit" ? "text-accent" : "text-prt-muted"}>
      <span className={short ? "xl:max-[1375px]:hidden" : undefined}>{ACCESS_LEVEL_LABELS[level]}</span>
      {short && <span className="hidden xl:max-[1375px]:inline">{ACCESS_LEVEL_SHORT_LABELS[level]}</span>}
    </span>
  );
}

/** "Whole division Can edit": the access a lead's role gives, in their whole division (boards 60 and 65); "Full access · Whole team" for a full-access seat (board 71). */
function RoleChip({ place }: { place: AccessPlace }) {
  if (place.kind === "team") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white-5 px-2 py-0.5 text-[12px]">
        <ShieldCheck aria-hidden className="h-3.5 w-3.5 shrink-0 text-text-2" strokeWidth={1.75} />
        <span className="text-prt-text">Full access</span>
        <PlaceTag>Whole team</PlaceTag>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white-5 px-2 py-0.5 text-[12px]">
      <Layers aria-hidden className="h-3.5 w-3.5 shrink-0 text-text-2" strokeWidth={1.75} />
      <span className="text-prt-text">{place.kind === "division" ? "Whole division" : "Whole department"}</span>
      <LevelLabel level="edit" short={false} />
    </span>
  );
}

/** The tag a grant's chip carries: where it applies, when that is wider than one division. */
function placeTag(place: AccessPlace, department: boolean): string | null {
  if (place.kind === "team") return "Whole team";
  return department && place.kind === "department" ? "Whole department" : null;
}

function GrantChips({ access, department }: { access: PersonAccess; department: boolean }) {
  return (
    <>
      {access.approveOrders && <ApproveOrdersChip />}
      {access.grants.map((g) => (
        <AreaChip key={g.id} target={g.target} level={g.level} tag={placeTag(g.place, department)} />
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

/** The words a screen reader hears for a row: "Sara Conti, Approve orders, Applications Can view, Positions Can edit". */
function rowLabel(row: PersonAccess): string {
  return [
    row.person.name,
    ...(row.approveOrders ? ["Approve orders"] : []),
    ...row.grants.map((g) => `${ACCESS_TARGET_LABELS[g.target]} ${ACCESS_LEVEL_LABELS[g.level]}`),
  ].join(", ");
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
      ? `${personLine(row, unit)} · with the role`
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
        {row.kind === "role" ? <RoleChip place={row.role.place} /> : <GrantChips access={row.access} department={department} />}
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
// table, so the header still lines up with the rows. Given by keeps its
// content on one line, and Access is never narrower than its widest chip, so
// neither runs into the other however narrow the page gets (the drawer takes
// 440px from xl): the person column gives way and its lines truncate. While a
// side panel is open from xl, Given by goes and Person and Access share the
// row evenly, as Orders hides its Department column (board 61b, issue #244):
// names stay readable and the chips keep their full "Can edit" level. Below
// md the page shows cards instead.
function tableColumns(drawerOpen: boolean): string {
  const open = drawerOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(min-content,1fr)_16px]" : "";
  return `grid grid-cols-[minmax(0,1fr)_minmax(min-content,2.4fr)_minmax(max-content,0.75fr)_16px] ${open} gap-x-4`;
}
const ROW = "col-span-full grid grid-cols-subgrid items-center px-6";

function AccessTable({
  rows,
  unit,
  changeable,
  onOpen,
  department,
  drawerOpen,
}: {
  rows: readonly Row[];
  unit: AccessUnit;
  changeable: (row: Row) => boolean;
  onOpen: (person: AccessPerson) => void;
  department: boolean;
  drawerOpen: boolean;
}) {
  const givenBy = drawerOpen ? "xl:hidden" : "";
  return (
    <section aria-label="People with access" className={`${PANEL} ${tableColumns(drawerOpen)} mt-5 hidden overflow-hidden md:grid`}>
      <div aria-hidden className={`${ROW} h-9 border-b border-hairline`}>
        <span className={EYEBROW}>Person</span>
        <span className={EYEBROW}>Access</span>
        <span className={`${EYEBROW} whitespace-nowrap ${givenBy}`}>Given by</span>
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
                  <span className="block truncate text-[12px] text-prt-muted">{personLine(row, unit)}</span>
                </span>
              </span>
              <span className="flex flex-col items-start gap-1">
                {row.kind === "role" ? (
                  <RoleChip place={row.role.place} />
                ) : (
                  <GrantChips access={row.access} department={department} />
                )}
              </span>
              <span className={`whitespace-nowrap text-[13px] text-prt-muted ${givenBy}`}>
                {row.kind === "role" ? "With the role" : givenLine(row.access)}
              </span>
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
function wholeDepartmentLine(unit: AccessDepartmentUnit): string {
  const n = unit.divisions.length;
  const which = n === 2 ? "both divisions" : n === 1 ? "its division" : `all ${n} divisions`;
  return `${unit.department.name} · ${which}, and any added later`;
}

/**
 * Give access (boards 60b, 65b and 71b) or Edit access (60c and 65c): one
 * person, on a head's or a team page the place (Where), a tick per area the
 * place offers, and a level per ticked area, up to the viewer's own; for the
 * team leader, "Approve orders" too. Save makes the person's areas in that
 * place exactly what is ticked. On Edit the person is locked, and Remove all
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
  /** `approves` is whether the person now holds "Approve orders", or null when the save did not change it. */
  onSaved: (personId: number, grants: readonly AccessGrant[], approves: boolean | null) => void;
}) {
  const unit = access.unit;
  const canGiveApprove = access.approveOrders.canGive;
  const grantable = access.people.filter((p) => p.standing === "member");
  // Give access opens on the first person who has no access yet; Edit access on the first place the person holds any.
  const firstFree = grantable.find((p) => !grants.some((g) => g.person.id === p.id) && !holdsApproveOrders(access, p.id)) ?? grantable[0];
  const [personId, setPersonId] = useState<number | undefined>(editing?.id ?? firstFree?.id);
  const [place, setPlace] = useState<AccessPlace>(() =>
    editing ? (placesHeldBy(unit, grants, editing.id)[0] ?? homePlace(unit)) : homePlace(unit),
  );
  const [areas, setAreas] = useState<AreaLevels>(() => (personId === undefined ? {} : areaLevelsOf(grants, personId, place)));
  const [approves, setApproves] = useState(() => personId !== undefined && holdsApproveOrders(access, personId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [removing, startRemoving] = useTransition();
  const areasLabel = useId();
  const whereLabel = useId();

  const person = access.people.find((p) => p.id === personId);
  const current = personId === undefined ? {} : areaLevelsOf(grants, personId, place);
  // The areas the place offers that the viewer holds, and any other the person holds there, which shows locked.
  const shown = targetsAt(place).filter((t) => heldLevel(access.held, t) !== null || current[t] !== undefined);

  const choosePerson = (id: number) => {
    setPersonId(id);
    setAreas(areaLevelsOf(grants, id, place));
    setApproves(holdsApproveOrders(access, id));
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
    if (Object.keys(areas).length === 0 && !(canGiveApprove && approves)) {
      return setError(editing ? "Choose at least one area, or remove all access." : "Choose at least one area.");
    }
    setError(undefined);
    setSubmitting(true);
    try {
      // A lead's division is their only place, so their page sends none; only the team leader sends "Approve orders".
      const where = unit.kind === "division" ? {} : { where: placeKey(place) };
      const approve = canGiveApprove ? { approveOrders: approves } : {};
      const result = await actions.saveAccess({ personId, ...where, areas, ...approve });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved(personId, result.value, canGiveApprove && approves !== holdsApproveOrders(access, personId) ? approves : null);
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
      onSaved(editing.id, [], holdsApproveOrders(access, editing.id) ? false : null);
      toast.success(`Removed ${editing.name}'s access`);
    });

  const removable =
    editing !== null &&
    (canGiveApprove || !holdsApproveOrders(access, editing.id)) &&
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
          <Field label="Person" hint={`from ${unitWords(unit)}`}>
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
                  className={`${SELECT} pl-12`}
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
              {placesOf(unit).map((option) => (
                <WhereOption
                  key={String(placeKey(option))}
                  group={whereLabel}
                  chosen={samePlace(option, place)}
                  onChoose={() => choosePlace(option)}
                  title={option.kind === "division" ? option.division.name : "Whole department"}
                  line={option.kind === "department" ? wholeDepartmentLine(unit) : "Only this division"}
                />
              ))}
            </div>
          </div>
        )}

        {unit.kind === "team" && <TeamWhere unit={unit} place={place} onChoose={choosePlace} />}

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
            {canGiveApprove && (
              <li>
                <ApproveOrdersOption on={approves} disabled={person === undefined} onChange={setApproves} />
              </li>
            )}
          </ul>
        </div>

        {unit.kind !== "team" && (
          <p className="mt-6 flex items-start gap-3 rounded-[10px] border border-hairline px-4 py-3.5 text-[13px] leading-relaxed text-text-2">
            <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
            {ACCESS_LEVELS_EXPLAINED}
          </p>
        )}

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

const SELECT =
  "h-11 w-full cursor-pointer appearance-none rounded-[10px] border border-white-10 bg-white-5 pr-10 text-[15px] text-prt-text transition-colors duration-300 ease-out focus:border-accent focus:outline-none";

/** One choice of Where: a round tick, its name and the line under it (boards 65b and 71b). */
function WhereOption({
  group,
  chosen,
  onChoose,
  title,
  line,
}: {
  group: string;
  chosen: boolean;
  onChoose: () => void;
  title: string;
  line: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2 transition-colors duration-300 ease-out has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
        chosen ? "bg-white-10" : "hover:bg-white-5"
      }`}
    >
      <input type="radio" name={group} checked={chosen} onChange={onChoose} className="sr-only" />
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${chosen ? "border-accent" : "border-border-strong"}`}
      >
        {chosen && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium">{title}</span>
        <span className="block truncate text-[12px] text-prt-muted">{line}</span>
      </span>
    </label>
  );
}

/** How wide a team page's grant is: the whole team, one department, or one division (board 71b). */
type Reach = AccessPlace["kind"];

/**
 * Where on a team page (board 71b): the whole team, one department or one
 * division, and for the last two a list to pick which.
 */
function TeamWhere({
  unit,
  place,
  onChoose,
}: {
  unit: Extract<AccessUnit, { kind: "team" }>;
  place: AccessPlace;
  onChoose: (place: AccessPlace) => void;
}) {
  const group = useId();
  const listId = useId();
  const firstDepartment = unit.departments[0];
  const firstDivision = unit.departments.flatMap((d) => d.divisions)[0];
  const reaches: readonly { readonly reach: Reach; readonly title: string; readonly line: string; readonly start: AccessPlace | undefined }[] = [
    { reach: "team", title: "Whole team", line: "Every department and division, and any added later", start: WHOLE_TEAM_PLACE },
    { reach: "department", title: "One department", line: "Pick the department", start: firstDepartment && { kind: "department", department: firstDepartment.department } },
    { reach: "division", title: "One division", line: "Pick the division", start: firstDivision && { kind: "division", division: firstDivision } },
  ];
  const places = placesOf(unit).filter((p) => p.kind === place.kind && p.kind !== "team");
  return (
    <div className="mt-6" role="radiogroup" aria-labelledby={group}>
      <GroupLabel id={group} label="Where" hint="the whole team, one department or one division" />
      <div className="flex flex-col gap-1 rounded-[10px] border border-white-10 p-1">
        {reaches.flatMap(({ reach, title, line, start }) =>
          start === undefined
            ? []
            : [<WhereOption key={reach} group={group} chosen={place.kind === reach} onChoose={() => place.kind !== reach && onChoose(start)} title={title} line={line} />],
        )}
      </div>
      {places.length > 0 && (
        <div className="relative mt-2">
          <label htmlFor={listId} className="sr-only">
            {place.kind === "department" ? "Department" : "Division"}
          </label>
          <select
            id={listId}
            value={String(placeKey(place))}
            onChange={(e) => {
              const next = places.find((p) => String(placeKey(p)) === e.target.value);
              if (next) onChoose(next);
            }}
            className={`${SELECT} pl-3`}
          >
            {places.map((p) => (
              <option key={String(placeKey(p))} value={String(placeKey(p))}>
                {p.kind === "department" ? p.department.name : p.kind === "division" ? p.division.name : ""}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-2" />
        </div>
      )}
    </div>
  );
}

/** "Approve orders" in Give access (board 71b): a tick with no level, shown to the team leader alone. */
function ApproveOrdersOption({ on, disabled, onChange }: { on: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <label
      className={`flex items-center gap-3 rounded-[10px] border px-3 py-2.5 transition-colors duration-300 ease-out has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-accent ${
        on ? "border-accent/60 bg-accent/[0.06]" : "border-white-10 hover:border-border-strong"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <input type="checkbox" checked={on} disabled={disabled} onChange={() => onChange(!on)} className="sr-only" />
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border ${
          on ? "border-accent bg-accent text-accent-on-accent" : "border-border-strong"
        }`}
      >
        {on && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
      </span>
      <CircleCheck aria-hidden className={`h-[18px] w-[18px] shrink-0 ${on ? "text-accent" : "text-text-2"}`} strokeWidth={1.75} />
      <span className="min-w-0">
        <span className="block text-[14px] font-medium">Approve orders</span>
        <span className="block truncate text-[12px] text-prt-muted">Approve, reject or ask for changes on any order</span>
      </span>
    </label>
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
