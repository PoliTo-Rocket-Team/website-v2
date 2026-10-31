import { textLength } from "@/lib/content/text";
import { arcVisualOrder, gapOfReadingIndex, readingIndexOfGap } from "./arc-order";
import { ARC_FULL, ARC_LEADERS, isLinkedinHandle, TEAM_PAGE_TEXT_MAX, type Shown } from "./team-layer";
import {
  departmentLeadBindings,
  holdingOf,
  nextSeatId,
  resolveLayout,
  sameBinding,
  type DepartmentBlock,
  type PageSeat,
  type PersonBinding,
  type TeamLayout,
} from "./team-layout";
import { linkedinHandle, overridesOf, rebound } from "./team-page-edit";
import { byName, personOf, type TeamPerson } from "./team-person";
import type { TeamRoles } from "./team-roles";
import type { Leader, PersonPhoto } from "./types";

// What the Team page editor adds on the page (boards 80e, 80f and 80g, issues
// #285 and #851): a leader at a place on the arc, a department, and division
// leads on a head block, with the Edit a head block panel's fields and the
// page seats they make. Every step returns a new layout (./team-layout.ts)
// and nothing else: an added leader, department or lead is a page seat bound
// to the person picked (Owner decision, #846 R4.1), never a role, department
// or division. Changing the person on a place the team record fills binds it
// to the seat they hold instead (`rebound`). A page seat whose seat has no
// holder is not drawn, so no panel lists it, and every step keeps it in its
// place. Pure: the editor draws the result as the editor types and sends the
// layout whole to the save, which checks it again.

// The arc's places (./arc-order.ts numbers them as gaps).

/** One place on the arc a leader may be added: the drawn page seat it goes after (null: the start), and how the Place field reads it. */
export type ArcGap = { readonly after: number | null; readonly label: string };

/** Every place a leader may be added on the arc as `leaders` draws it: both ends and between each pair of neighbours. */
export function arcGaps(leaders: readonly Shown<number, Leader>[]): ArcGap[] {
  const count = leaders.length;
  if (count === 0) return [{ after: null, label: "On the arc" }];
  const visual = arcVisualOrder(count).map((i) => leaders[i].shown.name);
  return Array.from({ length: count + 1 }, (_, gap): ArcGap => {
    const k = readingIndexOfGap(gap, count);
    const after = k === 0 ? null : leaders[k - 1].at;
    const label =
      gap === 0
        ? `Left end, before ${visual[0]}`
        : gap === count
          ? `Right end, after ${visual[count - 1]}`
          : `Between ${visual[gap - 1]} and ${visual[gap]}`;
    return { after, label };
  });
}

/** Whether another page seat fits on the arc: the add affordances go at eight, a seat with no holder counted, since it keeps its place. */
export function arcHasRoom(layout: TeamLayout): boolean {
  return layout.arc.length < ARC_LEADERS;
}

// Add leader (board 80f).

/** The Add leader panel as the editor fills it. */
export type LeaderFields = {
  /** "Person from the team", by member id; null until the editor picks someone (issue #618). */
  readonly person: number | null;
  readonly role: string;
  /** The place on the arc, as an index into `arcGaps` of the arc without this leader. */
  readonly gap: number;
  /** Another photo; null shows their own. */
  readonly photo: PersonPhoto | null;
  readonly linkedin: string;
};

/** The Add leader panel once someone is picked: the only fields the layout takes. */
export type PickedLeaderFields = LeaderFields & { readonly person: number };

/** The panel's fields as the layout can take them; null while nobody is picked, so nothing reaches the page. */
export function pickedLeader(fields: LeaderFields): PickedLeaderFields | null {
  return fields.person === null ? null : { ...fields, person: fields.person };
}

/** What the person fields say while nobody is picked, as Give access on the Access page says it. */
export const CHOOSE_A_PERSON = "Choose a person.";

/** What the Group field says while a department the editor adds has none (issue #856). */
export const CHOOSE_A_GROUP = "Choose a group.";

const memberOf = (roles: TeamRoles, id: number): TeamPerson | undefined => roles.people.find((p) => p.id === id);
const ownLinkedin = (person: TeamPerson | undefined) => (person === undefined ? "" : (personOf(person).linkedin ?? ""));
const personBinding = (person: TeamPerson): PersonBinding => ({ kind: "person", memberId: person.id });

/** Everyone on the team by name: who a place may show. */
export function teamByName(roles: TeamRoles): TeamPerson[] {
  return [...roles.people].sort(byName);
}

/** Whether page seat `id` on the arc is one the editor added: bound to a person, not to a seat (board 80f's Edit leader). */
export function isAddedLeader(layout: TeamLayout, id: number): boolean {
  return layout.arc.some((seat) => seat.id === id && seat.binding.kind === "person");
}

/** The layout with arc page seat `id` gone; nobody else moves. */
export function withoutArcSeat(layout: TeamLayout, id: number): TeamLayout {
  return { ...layout, arc: layout.arc.filter((seat) => seat.id !== id) };
}

/** The arc's places with page seat `id` (null: a new one) off it, the way the Add leader panel offers them. */
export function leaderGaps(roles: TeamRoles, layout: TeamLayout, id: number | null): ArcGap[] {
  const without = id === null ? layout : withoutArcSeat(layout, id);
  return arcGaps(resolveLayout(without, roles).leaders);
}

/** The panel as "+" at `gap` opens it: nobody picked yet (issue #618), so nothing is added until the editor picks someone. */
export function newLeaderFields(gap: number): LeaderFields {
  return { person: null, role: "", gap, photo: null, linkedin: "" };
}

/** The panel's fields for added leader `id` as the layout draws them; null when it draws none. */
export function leaderFieldsOf(roles: TeamRoles, layout: TeamLayout, id: number): PickedLeaderFields | null {
  const seat = layout.arc.find((s) => s.id === id);
  const holding = seat === undefined ? null : holdingOf(seat.binding, roles);
  if (seat === undefined || holding === null) return null;
  const leaders = resolveLayout(layout, roles).leaders;
  const index = leaders.findIndex((l) => l.at === id);
  const gap = index === -1 ? leaders.length : gapOfReadingIndex(index, leaders.length);
  return {
    person: holding.person.id,
    role: seat.overrides.role ?? holding.title,
    gap,
    photo: seat.overrides.photo ?? null,
    linkedin: seat.overrides.linkedin ?? ownLinkedin(holding.person),
  };
}

/** Another person in the panel: their own photo and LinkedIn, and their own title while the role is blank. */
export function withLeaderPerson(roles: TeamRoles, fields: LeaderFields, id: number): LeaderFields {
  const person = memberOf(roles, id);
  if (person === undefined) return fields;
  const role = fields.role.trim() === "" ? (person.pageTitle?.trim() ?? "") : fields.role;
  return { ...fields, person: id, role, photo: null, linkedin: ownLinkedin(person) };
}

/**
 * `layout` with the panel's leader on the arc at their place: page seat `id`,
 * or a new one when `id` is null (it takes the next seat id), bound to the
 * person picked. A name set before stays while the person does; their
 * LinkedIn is kept only where it differs from their own.
 */
export function layoutWithLeader(roles: TeamRoles, layout: TeamLayout, id: number | null, fields: PickedLeaderFields): TeamLayout {
  const person = memberOf(roles, fields.person);
  if (person === undefined) return layout;
  const without = id === null ? layout : withoutArcSeat(layout, id);
  const gap = leaderGaps(roles, layout, id)[fields.gap];
  const old = id === null ? undefined : layout.arc.find((s) => s.id === id);
  const binding = personBinding(person);
  const name = old !== undefined && sameBinding(old.binding, binding) ? old.overrides.name : undefined;
  const seat: PageSeat = {
    id: id ?? nextSeatId(layout),
    binding,
    overrides: overridesOf(roles, binding, person, { ...fields, name: name ?? "" }),
  };
  const neighbour = gap === undefined || gap.after === null ? -1 : without.arc.findIndex((s) => s.id === gap.after);
  const at = gap?.after === null ? 0 : neighbour === -1 ? without.arc.length : neighbour + 1;
  return { ...without, arc: [...without.arc.slice(0, at), seat, ...without.arc.slice(at)] };
}

export type LeaderFieldErrors = { readonly person?: string; readonly role?: string; readonly linkedin?: string; readonly arc?: string };

const TOO_LONG = `Up to ${TEAM_PAGE_TEXT_MAX} characters.`;

function linkedinError(text: string): string | undefined {
  const handle = linkedinHandle(text);
  return handle !== "" && !isLinkedinHandle(handle) ? "Enter the part after linkedin.com/in/." : undefined;
}

function textError(text: string, required: string | null): string | undefined {
  const value = text.trim();
  if (value === "") return required ?? undefined;
  return textLength(value) > TEAM_PAGE_TEXT_MAX ? TOO_LONG : undefined;
}

const withDefined = <T extends Record<string, string | undefined>>(errors: T): Partial<T> =>
  Object.fromEntries(Object.entries(errors).filter(([, v]) => v !== undefined)) as Partial<T>;

/** What Add to page refuses: nobody picked, no role, a LinkedIn that is no handle, or a new leader on a full arc. */
export function leaderFieldErrors(layout: TeamLayout, id: number | null, fields: LeaderFields): LeaderFieldErrors {
  return withDefined({
    person: fields.person === null ? CHOOSE_A_PERSON : undefined,
    role: textError(fields.role, "Enter the role the page shows."),
    linkedin: linkedinError(fields.linkedin),
    arc: id === null && !arcHasRoom(layout) ? ARC_FULL : undefined,
  });
}

// Departments and head blocks (boards 80e and 80g).

/** A head block, by its department block's id in the layout. */
export type HeadRef = number;

/**
 * One division lead row in the Edit a head block panel; `at` is the row's
 * page seat, or null for a row added in the panel, whose person is null
 * until the editor picks one (issue #618). `added` is a row the editor added,
 * bound to its person: the team record gives it no division, so it needs one.
 */
export type LeadRow = {
  readonly key: number;
  readonly at: number | null;
  readonly person: number | null;
  readonly division: string;
  readonly added: boolean;
};

/** A lead row with someone picked: the only rows the layout takes. */
export type PickedLeadRow = LeadRow & { readonly person: number };

/** The Edit a head block panel as the editor fills it (board 80g). */
export type HeadFields = {
  /** The head; null until the editor picks one for a department they add (issue #618). */
  readonly person: number | null;
  readonly role: string;
  readonly department: string;
  /** The department group the block sits in, by id; null until the editor picks one for a department they add (issue #856). */
  readonly group: number | null;
  readonly photo: PersonPhoto | null;
  readonly linkedin: string;
  /** The division leads the block shows, in order. */
  readonly leads: readonly LeadRow[];
};

/** The panel with its head, its group and every lead row picked: the only fields the layout takes. */
export type PickedHeadFields = Omit<HeadFields, "person" | "group" | "leads"> & {
  readonly person: number;
  readonly group: number;
  readonly leads: readonly PickedLeadRow[];
};

const isPickedRow = (row: LeadRow): row is PickedLeadRow => row.person !== null;

/**
 * What the page can show of the panel as the editor fills it: nothing while
 * no head or no group is picked, and only the lead rows with someone picked.
 * Done keeps it only once `headFieldErrors` refuses nothing, so a row with
 * nobody picked never reaches the layout.
 */
export function pickedHead(fields: HeadFields): PickedHeadFields | null {
  const { person, group } = fields;
  return person === null || group === null ? null : { ...fields, person, group, leads: fields.leads.filter(isPickedRow) };
}

const blockOf = (layout: TeamLayout, at: HeadRef) => layout.departments.find((b) => b.id === at);

/** Whether a block is one the editor added: its head bound to a person, not to a seat. */
export function isAddedBlock(layout: TeamLayout, at: HeadRef): boolean {
  return blockOf(layout, at)?.head.binding.kind === "person";
}

/** Who the head seat of a block the team record fills holds, for the "Team record" line; null for an added department. */
export function headRecord(roles: TeamRoles, layout: TeamLayout, at: HeadRef): TeamPerson | null {
  const block = blockOf(layout, at);
  if (block === undefined || block.head.binding.kind === "person") return null;
  return holdingOf(block.head.binding, roles, block.name)?.person ?? null;
}

/** The panel's fields for a head block as the layout draws it; null when the block is not drawn. */
export function headFieldsOf(roles: TeamRoles, layout: TeamLayout, at: HeadRef): PickedHeadFields | null {
  const block = blockOf(layout, at);
  const holding = block === undefined ? null : holdingOf(block.head.binding, roles, block.name);
  if (block === undefined || holding === null) return null;
  const { overrides } = block.head;
  const added = block.head.binding.kind === "person";
  const leads = resolveLayout(layout, roles).departments.find((d) => d.at === at)?.leads ?? [];
  return {
    person: holding.person.id,
    role: overrides.role ?? (added ? "" : holding.title),
    department: block.name,
    group: block.group,
    photo: overrides.photo ?? null,
    linkedin: overrides.linkedin ?? ownLinkedin(holding.person),
    leads: leads.map((l, key) => {
      const seat = block.leads.find((s) => s.id === l.at);
      const person = seat === undefined ? undefined : holdingOf(seat.binding, roles)?.person;
      return { key, at: l.at, person: person?.id ?? 0, division: l.shown.division, added: seat?.binding.kind === "person" };
    }),
  };
}

/** The panel as "+ Add department" opens it: no head picked yet (issue #618), no name, no group (issue #856), no leads. */
export function newDepartmentFields(): HeadFields {
  return { person: null, role: "", department: "", group: null, photo: null, linkedin: "", leads: [] };
}

/** Another head in the block: their own photo and LinkedIn. */
export function withHeadPerson(roles: TeamRoles, fields: HeadFields, id: number): HeadFields {
  const person = memberOf(roles, id);
  return person === undefined ? fields : { ...fields, person: id, photo: null, linkedin: ownLinkedin(person) };
}

/** A new row at the end of the leads: nobody picked (issue #618) and no division until the editor gives them. */
export function withNewLead(fields: HeadFields): HeadFields {
  const key = fields.leads.reduce((last, l) => Math.max(last, l.key), -1) + 1;
  return { ...fields, leads: [...fields.leads, { key, at: null, person: null, division: "", added: true }] };
}

/** A row's page seat: the seat it had, rebound as the person picked asks, or a new one bound to that person; only the division differs by an override, plus what was set for the same person before. */
function leadSeatOf(roles: TeamRoles, row: PickedLeadRow, old: PageSeat | undefined, nextId: () => number): PageSeat | null {
  const person = memberOf(roles, row.person);
  if (person === undefined) return null;
  const holder = old === undefined ? undefined : holdingOf(old.binding, roles)?.person;
  const binding = old === undefined || old.binding.kind === "person" ? personBinding(person) : rebound(roles, old.binding, holder, person);
  const same = old !== undefined && sameBinding(old.binding, binding) && holder?.id === person.id;
  const kept = same ? old.overrides : {};
  const division = row.division.trim();
  const title = holdingOf(binding, roles)?.title ?? "";
  const { role: _role, ...rest } = kept;
  return { id: old?.id ?? nextId(), binding, overrides: { ...rest, ...(division !== "" && division !== title && { role: division }) } };
}

/**
 * `seats`, the block's new leads, with every lead of `old` whose seat has no
 * holder put back after the seat it followed, or first when none of those
 * stays (ADR 0019 Decision 4): no panel lists such a seat, so no step removes it.
 */
function withHolderlessLeads(roles: TeamRoles, old: readonly PageSeat[], seats: readonly PageSeat[]): PageSeat[] {
  const kept = [...seats];
  old.forEach((seat, i) => {
    if (holdingOf(seat.binding, roles) !== null) return;
    const before = old.slice(0, i).reverse().find((s) => kept.some((k) => k.id === s.id));
    kept.splice(before === undefined ? 0 : kept.findIndex((k) => k.id === before.id) + 1, 0, seat);
  });
  return kept;
}

/**
 * The block's lead page seats in the panel's order. A lead the panel removed
 * leaves the layout; a seat the panel never listed, because its seat has no
 * holder, keeps its place after the seat it followed.
 */
function leadSeatsOf(roles: TeamRoles, block: DepartmentBlock | undefined, rows: readonly PickedLeadRow[], nextId: () => number): PageSeat[] {
  const old = block?.leads ?? [];
  const seats = rows.flatMap((row) => leadSeatOf(roles, row, row.at === null ? undefined : old.find((s) => s.id === row.at), nextId) ?? []);
  return withHolderlessLeads(roles, old, seats);
}

/**
 * `layout` with the Edit a head block panel's fields: the head, rebound as the
 * person picked asks, the name on the page, the leads in the panel's order (a
 * lead the panel removed leaves, a row added there is a page seat bound to
 * its person), the group it sits in, the role, photo and LinkedIn where they
 * differ from the record. `at` null adds a new department after the others,
 * drawing its leads under its head. None of it creates a role, department or
 * division. A group the layout does not hold changes nothing.
 */
export function layoutWithHead(roles: TeamRoles, layout: TeamLayout, at: HeadRef | null, fields: PickedHeadFields): TeamLayout {
  const person = memberOf(roles, fields.person);
  if (person === undefined || !layout.groups.some((g) => g.id === fields.group)) return layout;
  const block = at === null ? undefined : blockOf(layout, at);
  if (at !== null && block === undefined) return layout;
  let last = nextSeatId(layout) - 1;
  const nextId = () => ++last;
  const id = block?.id ?? nextId();
  const headId = block?.head.id ?? nextId();

  const old = block?.head;
  const holder = old === undefined ? undefined : holdingOf(old.binding, roles, block!.name)?.person;
  const binding = old === undefined || old.binding.kind === "person" ? personBinding(person) : rebound(roles, old.binding, holder, person);
  const typed = fields.department.trim();
  const own = old?.binding;
  const ownName = own?.kind === "department-head" ? roles.org.departments.find((d) => d.id === own.departmentId)?.name : undefined;
  const name = typed !== "" ? typed : (ownName ?? block?.name ?? "");
  const samePerson = old !== undefined && holder?.id === person.id;
  const keptName = samePerson ? old.overrides.name : undefined;
  const head: PageSeat = { id: headId, binding, overrides: overridesOf(roles, binding, person, { ...fields, name: keptName ?? "" }, name) };

  const leads = leadSeatsOf(roles, block, fields.leads, nextId);
  const next: DepartmentBlock = { id, name, group: fields.group, leadsDrawn: block?.leadsDrawn ?? "under", head, leads };
  if (block === undefined) return { ...layout, departments: [...layout.departments, next] };
  return { ...layout, departments: layout.departments.map((b) => (b.id === id ? next : b)) };
}

/** What a lead row refuses: nobody picked, or the division it needs. */
export type LeadRowErrors = { readonly person?: string; readonly division?: string };

export type HeadFieldErrors = {
  readonly person?: string;
  readonly department?: string;
  readonly group?: string;
  readonly role?: string;
  readonly linkedin?: string;
  /** By row key: what the row refuses. */
  readonly leads?: Readonly<Record<number, LeadRowErrors>>;
};

/**
 * What Done refuses: no head or lead picked, an added department with no
 * name, no group (issue #856), text the layout would not take, a LinkedIn
 * that is no handle, or an added lead with no division. `added` is a
 * department the editor adds or added, whose name the team record does not
 * give.
 */
export function headFieldErrors(added: boolean, fields: HeadFields): HeadFieldErrors {
  const leads = Object.fromEntries(
    fields.leads.flatMap((row) => {
      const errors = withDefined({
        person: row.person === null ? CHOOSE_A_PERSON : undefined,
        division: textError(row.division, row.added ? "Enter the division." : null),
      });
      return Object.keys(errors).length === 0 ? [] : [[row.key, errors]];
    }),
  );
  return {
    ...withDefined({
      person: fields.person === null ? CHOOSE_A_PERSON : undefined,
      department: textError(fields.department, added ? "Enter the department's name." : null),
      group: fields.group === null ? CHOOSE_A_GROUP : undefined,
      role: textError(fields.role, null),
      linkedin: linkedinError(fields.linkedin),
    }),
    ...(Object.keys(leads).length > 0 && { leads }),
  };
}

export function hasHeadErrors(errors: HeadFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Hide from page, or Remove from page for an added department (board 80g): the block leaves the layout. */
export function hideHead(layout: TeamLayout, at: HeadRef): TeamLayout {
  return { ...layout, departments: layout.departments.filter((b) => b.id !== at) };
}

/**
 * Back to the team record (board 80g): the head with no override; for a
 * department's own head, the department's name and its leads as the team
 * record has them, each lead seat the block already held keeping its id. A
 * lead seat with no holder keeps its place, as the panel's own Done keeps it.
 */
export function headBackToRecord(roles: TeamRoles, layout: TeamLayout, at: HeadRef): TeamLayout {
  const block = blockOf(layout, at);
  if (block === undefined || block.head.binding.kind === "person") return layout;
  const head = { ...block.head, overrides: {} };
  const { binding } = block.head;
  if (binding.kind !== "department-head") return { ...layout, departments: layout.departments.map((b) => (b.id === at ? { ...b, head } : b)) };
  let last = nextSeatId(layout) - 1;
  const record = departmentLeadBindings(binding.departmentId, roles).map(
    (lead): PageSeat => ({ id: block.leads.find((s) => sameBinding(s.binding, lead))?.id ?? ++last, binding: lead, overrides: {} }),
  );
  const leads = withHolderlessLeads(roles, block.leads, record);
  const name = roles.org.departments.find((d) => d.id === binding.departmentId)?.name ?? block.name;
  return { ...layout, departments: layout.departments.map((b) => (b.id === at ? { ...b, name, head, leads } : b)) };
}

/** Whether a head block shows anything but the team record: an override on its head, or, for a department's own head, another name or other leads. */
export function isHeadEdited(roles: TeamRoles, layout: TeamLayout, at: HeadRef): boolean {
  const block = blockOf(layout, at);
  if (block === undefined || block.head.binding.kind === "person") return false;
  if (Object.keys(block.head.overrides).length > 0) return true;
  const { binding } = block.head;
  if (binding.kind !== "department-head") return false;
  const department = roles.org.departments.find((d) => d.id === binding.departmentId);
  const drawn = block.leads.filter((s) => holdingOf(s.binding, roles) !== null);
  const record = departmentLeadBindings(binding.departmentId, roles);
  return (
    block.name !== (department?.name ?? block.name) ||
    drawn.length !== record.length ||
    drawn.some((seat, i) => !sameBinding(seat.binding, record[i]) || Object.keys(seat.overrides).length > 0)
  );
}
