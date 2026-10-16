import { textLength } from "@/lib/content/text";
import { arcVisualOrder, gapOfReadingIndex, readingIndexOfGap } from "./arc-order";
import {
  applyLayer,
  ARC_FULL,
  ARC_LEADERS,
  isLinkedinHandle,
  leadersOnArc,
  nextAddedId,
  TEAM_PAGE_TEXT_MAX,
  type AddedDepartment,
  type AddedLead,
  type AddedLeader,
  type AddedRef,
  type ArcPlace,
  type ArcRef,
  type BuiltDepartment,
  type DepartmentEdit,
  type HeadSpot,
  type LeadRef,
  type LeadSpot,
  type Shown,
  type SpotEdit,
  type TeamBuild,
  type TeamPageLayer,
} from "./team-layer";
import { linkedinHandle } from "./team-page-edit";
import { byName, personOf, type TeamPerson } from "./team-person";
import type { Leader, PersonPhoto } from "./types";

// What the Team page editor adds on the page (boards 80e, 80f and 80g, issue
// #285): a leader at a place on the arc, a department, and division leads on
// a head block, with the Edit a head block panel's fields and the edit they
// make. Every step returns a new visual layer (./team-layer.ts) and nothing
// else: an added leader, department or lead is a thing the page shows, never
// a role, department or division. Pure: the editor lays the result on the
// roles build as the editor types and sends the layer whole to the layer
// actions, which check it again.

// The arc's places (./arc-order.ts numbers them as gaps).

/** One place on the arc a leader may be added: where it goes in the layer, and how the Place field reads it. */
export type ArcGap = { readonly place: ArcPlace; readonly label: string };

/** Every place a leader may be added on the arc as `leaders` draws it: both ends and between each pair of neighbours. */
export function arcGaps(leaders: readonly Shown<ArcRef, Leader>[]): ArcGap[] {
  const count = leaders.length;
  if (count === 0) return [{ place: { at: "start" }, label: "On the arc" }];
  const visual = arcVisualOrder(count).map((i) => leaders[i].shown.name);
  return Array.from({ length: count + 1 }, (_, gap): ArcGap => {
    const k = readingIndexOfGap(gap, count);
    const place: ArcPlace = k === 0 ? { at: "start" } : { after: leaders[k - 1].at };
    const label =
      gap === 0
        ? `Left end, before ${visual[0]}`
        : gap === count
          ? `Right end, after ${visual[count - 1]}`
          : `Between ${visual[gap - 1]} and ${visual[gap]}`;
    return { place, label };
  });
}

/** Whether another leader fits on the arc: the add affordances go at eight. */
export function arcHasRoom(build: TeamBuild, layer: TeamPageLayer): boolean {
  return leadersOnArc(build, layer) < ARC_LEADERS;
}

// Add leader (board 80f).

/** The Add leader panel as the editor fills it. */
export type LeaderFields = {
  /** "Person from the team", by member id. */
  readonly person: number;
  readonly role: string;
  /** The place on the arc, as an index into `arcGaps` of the arc without this leader. */
  readonly gap: number;
  /** Another photo; null shows their own. */
  readonly photo: PersonPhoto | null;
  readonly linkedin: string;
};

const memberOf = (build: TeamBuild, id: number): TeamPerson | undefined => build.people.find((p) => p.id === id);
const ownLinkedin = (person: TeamPerson | undefined) => (person === undefined ? "" : (personOf(person).linkedin ?? ""));

/** Everyone on the team by name: who a spot may show. */
export function teamByName(build: TeamBuild): TeamPerson[] {
  return [...build.people].sort(byName);
}

/** The layer with added leader `id` gone; a leader placed after them takes their place, so nobody else moves. */
export function withoutAddedLeader(layer: TeamPageLayer, id: number): TeamPageLayer {
  const gone = layer.addedLeaders.find((l) => l.id === id);
  if (gone === undefined) return layer;
  const ref: AddedRef = `added:${id}`;
  return {
    ...layer,
    addedLeaders: layer.addedLeaders.flatMap((l) =>
      l.id === id ? [] : ["after" in l.place && l.place.after === ref ? { ...l, place: gone.place } : l],
    ),
  };
}

/** The arc's places with added leader `id` (null: a new one) off it, the way the Add leader panel offers them. */
export function leaderGaps(build: TeamBuild, layer: TeamPageLayer, id: number | null): ArcGap[] {
  const without = id === null ? layer : withoutAddedLeader(layer, id);
  return arcGaps(applyLayer(build, without).leaders);
}

/** The first person on the team the page does not show yet on the arc or as team leader; else the first by name. */
function someoneNotOnArc(build: TeamBuild, layer: TeamPageLayer): TeamPerson | undefined {
  const shown = applyLayer(build, layer);
  const names = new Set([shown.leader?.name, ...shown.leaders.map((l) => l.shown.name)]);
  const people = teamByName(build);
  return people.find((p) => !names.has(p.name)) ?? people[0];
}

/** The panel as "+" at `gap` opens it: someone not on the arc yet, with their own title as the role. */
export function newLeaderFields(build: TeamBuild, layer: TeamPageLayer, gap: number): LeaderFields | null {
  const person = someoneNotOnArc(build, layer);
  if (person === undefined) return null;
  return { person: person.id, role: person.pageTitle?.trim() ?? "", gap, photo: null, linkedin: ownLinkedin(person) };
}

/** The panel's fields for added leader `id` as the layer holds them; null when it holds none. */
export function leaderFieldsOf(build: TeamBuild, layer: TeamPageLayer, id: number): LeaderFields | null {
  const added = layer.addedLeaders.find((l) => l.id === id);
  if (added === undefined) return null;
  const leaders = applyLayer(build, layer).leaders;
  const index = leaders.findIndex((l) => l.at === `added:${id}`);
  const gap = index === -1 ? leaders.length : gapOfReadingIndex(index, leaders.length);
  return {
    person: added.person,
    role: added.role,
    gap,
    photo: added.photo ?? null,
    linkedin: added.linkedin ?? ownLinkedin(memberOf(build, added.person)),
  };
}

/** Another person in the panel: their own photo and LinkedIn. */
export function withLeaderPerson(build: TeamBuild, fields: LeaderFields, id: number): LeaderFields {
  const person = memberOf(build, id);
  return person === undefined ? fields : { ...fields, person: id, photo: null, linkedin: ownLinkedin(person) };
}

/**
 * `layer` with the panel's leader on the arc at their place: added leader
 * `id`, or a new one when `id` is null (it takes the next added id). Their
 * LinkedIn is kept only where it differs from their own.
 */
export function layerWithLeader(build: TeamBuild, layer: TeamPageLayer, id: number | null, fields: LeaderFields): TeamPageLayer {
  const without = id === null ? layer : withoutAddedLeader(layer, id);
  const gaps = leaderGaps(build, layer, id);
  const old = id === null ? undefined : layer.addedLeaders.find((l) => l.id === id);
  const linkedin = linkedinHandle(fields.linkedin);
  const leader: AddedLeader = {
    id: id ?? nextAddedId(layer),
    person: fields.person,
    place: gaps[fields.gap]?.place ?? { at: "end" },
    role: fields.role.trim(),
    ...(old?.name !== undefined && old.person === fields.person && { name: old.name }),
    ...(fields.photo !== null && { photo: fields.photo }),
    ...(linkedin !== "" && linkedin !== ownLinkedin(memberOf(build, fields.person)) && { linkedin }),
  };
  return { ...without, addedLeaders: [...without.addedLeaders, leader] };
}

export type LeaderFieldErrors = { readonly role?: string; readonly linkedin?: string; readonly arc?: string };

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

/** What Add to page refuses: no role, a LinkedIn that is no handle, or a new leader on a full arc. */
export function leaderFieldErrors(build: TeamBuild, layer: TeamPageLayer, id: number | null, fields: LeaderFields): LeaderFieldErrors {
  return withDefined({
    role: textError(fields.role, "Enter the role the page shows."),
    linkedin: linkedinError(fields.linkedin),
    arc: id === null && !arcHasRoom(build, layer) ? ARC_FULL : undefined,
  });
}

// Departments and head blocks (boards 80e and 80g).

/** A head block: a head the roles fill, or the head of a department the editor added (the department's ref). */
export type HeadRef = HeadSpot | AddedRef;

/** One division lead row in the Edit a head block panel; `at` is null for a row added in the panel. */
export type LeadRow = { readonly key: number; readonly at: LeadRef | null; readonly person: number; readonly division: string };

/** The Edit a head block panel as the editor fills it (board 80g). */
export type HeadFields = {
  readonly person: number;
  readonly role: string;
  readonly department: string;
  readonly photo: PersonPhoto | null;
  readonly linkedin: string;
  /** The division leads the block shows, in order. */
  readonly leads: readonly LeadRow[];
};

const isAddedRef = (ref: string): ref is AddedRef => ref.startsWith("added:");
const idOf = (ref: AddedRef) => Number(ref.slice("added:".length));

function builtHead(build: TeamBuild, spot: HeadSpot) {
  for (const department of build.departments) {
    const head = department.heads.find((h) => h.spot === spot);
    if (head !== undefined) return { department, head };
  }
  return null;
}

const addedDepartment = (layer: TeamPageLayer, ref: AddedRef) => layer.addedDepartments.find((d) => d.id === idOf(ref));

/** What the roles put in a head block, for the "Team record" line; null for an added department. */
export function headRecord(build: TeamBuild, at: HeadRef): { readonly person: TeamPerson; readonly department: string } | null {
  if (isAddedRef(at)) return null;
  const found = builtHead(build, at);
  return found === null ? null : { person: found.head.person, department: found.department.name };
}

/** The role a head reads when the panel leaves it blank: their title, else "Head of" the department. */
export function defaultHeadRole(title: string | undefined, department: string): string {
  return title ?? `Head of ${department}`;
}

/** The panel's fields for a head block as the layer shows it; null when the block is not on the page. */
export function headFieldsOf(build: TeamBuild, layer: TeamPageLayer, at: HeadRef): HeadFields | null {
  if (isAddedRef(at)) {
    const d = addedDepartment(layer, at);
    if (d === undefined) return null;
    return {
      person: d.head.person,
      role: d.head.role ?? "",
      department: d.name,
      photo: d.head.photo ?? null,
      linkedin: d.head.linkedin ?? ownLinkedin(memberOf(build, d.head.person)),
      leads: d.leads.map((l, key) => ({ key, at: `added:${l.id}`, person: l.person, division: l.division })),
    };
  }
  const found = builtHead(build, at);
  if (found === null) return null;
  const { department, head } = found;
  const edit = layer.spots[at] ?? {};
  const name = layer.departments[`${department.id}`]?.name ?? department.name;
  const person = (edit.person === undefined ? undefined : memberOf(build, edit.person)) ?? head.person;
  const shown = applyLayer(build, layer).departments.find((d) => d.at === department.id);
  return {
    person: person.id,
    role: edit.role ?? defaultHeadRole(head.title, name),
    department: name,
    photo: edit.photo ?? null,
    linkedin: edit.linkedin ?? ownLinkedin(person),
    leads: (shown?.leads ?? []).map((l, key) => ({ key, at: l.at, person: leadPerson(build, layer, department, l.at), division: l.shown.division })),
  };
}

function leadPerson(build: TeamBuild, layer: TeamPageLayer, department: BuiltDepartment, at: LeadRef): number {
  if (isAddedRef(at)) return layer.departments[`${department.id}`]?.addedLeads?.find((l) => l.id === idOf(at))?.person ?? 0;
  const edit = layer.spots[at];
  return edit?.person ?? department.leads.find((l) => l.spot === at)?.person.id ?? 0;
}

/** The panel as "+ Add department" opens it: a head from the team, no name yet, no leads. */
export function newDepartmentFields(build: TeamBuild): HeadFields | null {
  const person = teamByName(build)[0];
  if (person === undefined) return null;
  return { person: person.id, role: "", department: "", photo: null, linkedin: ownLinkedin(person), leads: [] };
}

/** Another head in the block: their own photo and LinkedIn. */
export function withHeadPerson(build: TeamBuild, fields: HeadFields, id: number): HeadFields {
  const person = memberOf(build, id);
  return person === undefined ? fields : { ...fields, person: id, photo: null, linkedin: ownLinkedin(person) };
}

/** A new row at the end of the leads: someone not leading a row yet, with no division until the editor types one. */
export function withNewLead(build: TeamBuild, fields: HeadFields): HeadFields {
  const taken = new Set([fields.person, ...fields.leads.map((l) => l.person)]);
  const people = teamByName(build);
  const person = people.find((p) => !taken.has(p.id)) ?? people[0];
  if (person === undefined) return fields;
  const key = fields.leads.reduce((last, l) => Math.max(last, l.key), -1) + 1;
  return { ...fields, leads: [...fields.leads, { key, at: null, person: person.id, division: "" }] };
}

/** The id each added thing in `rows` takes: its own, or the next free one from `from` for a row added in the panel. */
function idsOf(rows: readonly LeadRow[], from: number): Map<number, number> {
  let next = from;
  return new Map(rows.map((row) => [row.key, row.at !== null && isAddedRef(row.at) ? idOf(row.at) : next++]));
}

/** A row's added lead, keeping what the layer already shows for them when they are the same person. */
function addedLeadOf(row: LeadRow, id: number, old: AddedLead | undefined): AddedLead {
  const same = old !== undefined && old.person === row.person;
  return {
    id,
    person: row.person,
    division: row.division.trim(),
    ...(same && old.name !== undefined && { name: old.name }),
    ...(same && old.photo !== undefined && { photo: old.photo }),
    ...(same && old.linkedin !== undefined && { linkedin: old.linkedin }),
  };
}

/** A lead spot's edit from its row: only what differs from the roles; an edit for another person drops the old person's name, photo and LinkedIn. */
function leadSpotEdit(old: SpotEdit | undefined, built: { person: TeamPerson; division: string }, row: LeadRow): SpotEdit {
  const { hidden: _hidden, person: oldPerson, role: _role, ...rest } = old ?? {};
  const samePerson = (oldPerson ?? built.person.id) === row.person;
  const division = row.division.trim();
  return {
    ...(samePerson ? rest : {}),
    ...(row.person !== built.person.id && { person: row.person }),
    ...(division !== "" && division !== built.division && { role: division }),
  };
}

const withSpot = (spots: TeamPageLayer["spots"], spot: HeadSpot | LeadSpot, edit: SpotEdit): TeamPageLayer["spots"] => {
  const { [spot]: _old, ...rest } = spots;
  return Object.keys(edit).length === 0 ? rest : { ...rest, [spot]: edit };
};

/** A head's edit from the panel: only what differs from the roles; a name edited before stays while the person does. */
function headSpotEdit(build: TeamBuild, old: SpotEdit | undefined, head: { person: TeamPerson; title: string | undefined }, department: string, fields: HeadFields): SpotEdit {
  const own = ownLinkedin(memberOf(build, fields.person));
  const role = fields.role.trim();
  const linkedin = linkedinHandle(fields.linkedin);
  const samePerson = (old?.person ?? head.person.id) === fields.person;
  return {
    ...(samePerson && old?.name !== undefined && { name: old.name }),
    ...(fields.person !== head.person.id && { person: fields.person }),
    ...(role !== "" && role !== defaultHeadRole(head.title, department) && { role }),
    ...(fields.photo !== null && { photo: fields.photo }),
    ...(linkedin !== "" && linkedin !== own && { linkedin }),
  };
}

/**
 * `layer` with the Edit a head block panel's fields: the head's edit at their
 * spot, the department's name on the page, its leads in the panel's order
 * (a role lead the panel removed is hidden, a row added there is an added
 * lead), or, for a department the editor added, that department replaced
 * whole. `at` null adds a new department after the others. None of it
 * creates a role, department or division.
 */
export function layerWithHead(build: TeamBuild, layer: TeamPageLayer, at: HeadRef | null, fields: HeadFields): TeamPageLayer {
  if (at === null || isAddedRef(at)) return layerWithAddedDepartment(build, layer, at, fields);
  const found = builtHead(build, at);
  if (found === null) return layer;
  const { department, head } = found;
  const key = `${department.id}` as const;
  const old: DepartmentEdit = layer.departments[key] ?? {};
  const typed = fields.department.trim();
  const name = typed === "" ? department.name : typed;

  let spots = withSpot(layer.spots, at, headSpotEdit(build, layer.spots[at], head, name, fields));
  for (const built of department.leads) {
    const row = fields.leads.find((r) => r.at === built.spot);
    const edit = row === undefined ? { ...layer.spots[built.spot], hidden: true as const } : leadSpotEdit(layer.spots[built.spot], built, row);
    spots = withSpot(spots, built.spot, edit);
  }

  const ids = idsOf(fields.leads, nextAddedId(layer));
  const addedLeads = fields.leads.flatMap((row) => {
    if (row.at !== null && !isAddedRef(row.at)) return [];
    const id = ids.get(row.key)!;
    return [addedLeadOf(row, id, old.addedLeads?.find((l) => l.id === id))];
  });
  const order = fields.leads.map((row): LeadRef => row.at ?? `added:${ids.get(row.key)!}`);
  const byDefault: LeadRef[] = [
    ...department.leads.filter((b) => fields.leads.some((r) => r.at === b.spot)).map((b) => b.spot),
    ...addedLeads.map((l): AddedRef => `added:${l.id}`),
  ];
  const edit: DepartmentEdit = {
    ...(name !== department.name && { name }),
    ...(old.hidden && { hidden: true as const }),
    ...(order.join() !== byDefault.join() && { leadOrder: order }),
    ...(addedLeads.length > 0 && { addedLeads }),
  };
  const { [key]: _old, ...departments } = layer.departments;
  return { ...layer, spots, departments: Object.keys(edit).length === 0 ? departments : { ...departments, [key]: edit } };
}

function layerWithAddedDepartment(build: TeamBuild, layer: TeamPageLayer, at: AddedRef | null, fields: HeadFields): TeamPageLayer {
  const old = at === null ? undefined : addedDepartment(layer, at);
  if (at !== null && old === undefined) return layer;
  const id = old?.id ?? nextAddedId(layer);
  const ids = idsOf(fields.leads, Math.max(nextAddedId(layer), id + 1));
  const role = fields.role.trim();
  const linkedin = linkedinHandle(fields.linkedin);
  const sameHead = old !== undefined && old.head.person === fields.person;
  const department: AddedDepartment = {
    id,
    name: fields.department.trim(),
    head: {
      person: fields.person,
      ...(sameHead && old.head.name !== undefined && { name: old.head.name }),
      ...(role !== "" && { role }),
      ...(fields.photo !== null && { photo: fields.photo }),
      ...(linkedin !== "" && linkedin !== ownLinkedin(memberOf(build, fields.person)) && { linkedin }),
    },
    leads: fields.leads.map((row) => {
      const leadId = ids.get(row.key)!;
      return addedLeadOf(row, leadId, old?.leads.find((l) => l.id === leadId));
    }),
  };
  const others = layer.addedDepartments.filter((d) => d.id !== id);
  const index = old === undefined ? others.length : layer.addedDepartments.findIndex((d) => d.id === id);
  return { ...layer, addedDepartments: [...others.slice(0, index), department, ...others.slice(index)] };
}

export type HeadFieldErrors = {
  readonly department?: string;
  readonly role?: string;
  readonly linkedin?: string;
  /** By row key: a division the row needs. */
  readonly leads?: Readonly<Record<number, string>>;
};

/** What Done refuses: an added department with no name, text the layer would not take, a LinkedIn that is no handle, or an added lead with no division. */
export function headFieldErrors(at: HeadRef | null, fields: HeadFields): HeadFieldErrors {
  const added = at === null || isAddedRef(at);
  const leads = Object.fromEntries(
    fields.leads.flatMap((row) => {
      const needsDivision = row.at === null || isAddedRef(row.at);
      const error = textError(row.division, needsDivision ? "Enter the division." : null);
      return error === undefined ? [] : [[row.key, error]];
    }),
  );
  return {
    ...withDefined({
      department: textError(fields.department, added ? "Enter the department's name." : null),
      role: textError(fields.role, null),
      linkedin: linkedinError(fields.linkedin),
    }),
    ...(Object.keys(leads).length > 0 && { leads }),
  };
}

export function hasHeadErrors(errors: HeadFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Hide from page (board 80g): a head the roles fill is hidden at their spot; a department the editor added goes. */
export function hideHead(layer: TeamPageLayer, at: HeadRef): TeamPageLayer {
  if (isAddedRef(at)) return { ...layer, addedDepartments: layer.addedDepartments.filter((d) => d.id !== idOf(at)) };
  return { ...layer, spots: { ...layer.spots, [at]: { ...layer.spots[at], hidden: true } } };
}

/** Back to the team record (board 80g): the head, the department's name and its leads as the roles have them. */
export function headBackToRecord(build: TeamBuild, layer: TeamPageLayer, at: HeadSpot): TeamPageLayer {
  const found = builtHead(build, at);
  if (found === null) return layer;
  const { department } = found;
  let spots = withSpot(layer.spots, at, {});
  for (const built of department.leads) spots = withSpot(spots, built.spot, {});
  const { [`${department.id}` as const]: _old, ...departments } = layer.departments;
  return { ...layer, spots, departments };
}

/** Whether a head block shows anything but the team record. */
export function isHeadEdited(build: TeamBuild, layer: TeamPageLayer, at: HeadSpot): boolean {
  const found = builtHead(build, at);
  if (found === null) return false;
  return (
    layer.spots[at] !== undefined ||
    layer.departments[`${found.department.id}`] !== undefined ||
    found.department.leads.some((l) => layer.spots[l.spot] !== undefined)
  );
}
