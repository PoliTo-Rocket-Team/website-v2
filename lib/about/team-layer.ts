import { textLength } from "@/lib/content/text";
import { BOARD_SEATS, type BoardSeat, type DepartmentKind } from "@/lib/dashboard/team";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import { personOf, type TeamPerson } from "./team-person";
import type { DepartmentHead, DivisionLead, HeaderStats, Leader, Member, Person, PersonPhoto } from "./types";

// The Team page's visual layer (issue #283, ADR 0015): what an editor changes
// on the page, laid over the page the team's roles build (./team-roles.ts).
// It changes only what the page shows, never anyone's role, division,
// department or access. Edits are keyed to spots, the places on the page a
// person fills (the team leader, a place on the arc, a head block, a division
// lead row), never to a person or a role, so they outlive changes to the real
// team: an edit whose spot is gone from the roles build is kept and skipped,
// and it shows again if the spot comes back. Only the editor or Reset to team
// removes an edit. Pure: the database, the dummy data and the editor all lay
// it on the same way.

/** The arc holds up to eight leaders. */
export const ARC_LEADERS = 8;

/** A place on the arc the roles fill: a board seat, and which of its holders by name (0 is the first). */
export type ArcSpot = `arc:${BoardSeat}:${number}`;
/** A head block: a department by id, and which of its heads by name. */
export type HeadSpot = `head:${number}:${number}`;
/** A division lead row: a division by id, and which of its leads by name. */
export type LeadSpot = `lead:${number}:${number}`;
export type Spot = ArcSpot | HeadSpot | LeadSpot;

/** Something the editor added to the page, by its id in the layer. */
export type AddedRef = `added:${number}`;
/** Anything on the arc: a spot the roles fill, or a leader the editor added. */
export type ArcRef = ArcSpot | AddedRef;
/** Any division lead row: one the roles fill, or one the editor added. */
export type LeadRef = LeadSpot | AddedRef;

/** A department by its id in the roles, or one the editor added. */
export type DepartmentRef = number | AddedRef;

/**
 * What the page shows in one spot instead of what the roles say. `person`
 * shows another team member there (their name, photo, LinkedIn and team
 * email); the other fields replace one thing each. The team email is never
 * edited: it is the shown person's own. On a division lead row `role` is the
 * division shown under the name.
 */
export type PersonEdit = {
  readonly person?: number;
  readonly name?: string;
  readonly role?: string;
  readonly photo?: PersonPhoto;
  /** A LinkedIn handle, the part after linkedin.com/in/. */
  readonly linkedin?: string;
};

/** A spot's edit; a hidden spot is left off the page. The team leader cannot be hidden. */
export type SpotEdit = PersonEdit & { readonly hidden?: true };

/** A team member the editor put on the page, with what the page shows for them. */
export type AddedPerson = {
  readonly person: number;
  readonly name?: string;
  readonly photo?: PersonPhoto;
  readonly linkedin?: string;
};

/** Where an added leader sits in `OrgChart.leaders` reading order: at either end, or right after a neighbour. */
export type ArcPlace = { readonly at: "start" } | { readonly at: "end" } | { readonly after: ArcRef };

export type AddedLeader = AddedPerson & { readonly id: number; readonly place: ArcPlace; readonly role: string };
export type AddedLead = AddedPerson & { readonly id: number; readonly division: string };

/** A department the editor added: its name, its head and their division leads. It creates no department. */
export type AddedDepartment = {
  readonly id: number;
  readonly name: string;
  readonly head: AddedPerson & { readonly role?: string };
  readonly leads: readonly AddedLead[];
};

/**
 * One department's edit: the name the page shows (the head's role reads
 * "Head of" it unless the head spot sets a role), hidden, division leads
 * added, and the order of its division lead rows. A lead row is removed by
 * hiding its spot. A row the order does not name (a lead the roles gained
 * later) follows the named ones.
 */
export type DepartmentEdit = {
  readonly name?: string;
  readonly hidden?: true;
  readonly leadOrder?: readonly LeadRef[];
  readonly addedLeads?: readonly AddedLead[];
};

/** The group photo over the core members: a photo of the site's own in public/team/, or one uploaded in the editor (issue #510). */
export type GroupPhoto = { readonly src: PersonPhoto; readonly alt: string };

/** The whole visual layer. Every part is optional in effect: an empty part changes nothing. */
export type TeamPageLayer = {
  readonly leader: PersonEdit;
  readonly spots: Readonly<Partial<Record<Spot, SpotEdit>>>;
  readonly addedLeaders: readonly AddedLeader[];
  readonly departments: Readonly<Partial<Record<`${number}`, DepartmentEdit>>>;
  readonly addedDepartments: readonly AddedDepartment[];
  /** The header's intro; null keeps the hand-typed one. */
  readonly intro: string | null;
  /**
   * The header's four figures under the intro (issue #510); absent keeps the
   * hand-typed ones. Absent rather than null, so a layer saved before the
   * figures were editable reads as one that left them alone.
   */
  readonly figures?: HeaderStats;
  /** The group photo over the core members; null keeps the hand-typed one. */
  readonly groupPhoto: GroupPhoto | null;
};

export const NO_TEAM_LAYER: TeamPageLayer = {
  leader: {},
  spots: {},
  addedLeaders: [],
  departments: {},
  addedDepartments: [],
  intro: null,
  groupPhoto: null,
};

// The page the roles build, with the spot each person fills, before any edit.

export type BuiltLeader = { readonly spot: ArcSpot; readonly person: TeamPerson; readonly role: string };
/** `title` is the title their role carries; without one the page reads "Head of" the department. */
export type BuiltHead = { readonly spot: HeadSpot; readonly person: TeamPerson; readonly title: string | undefined };
export type BuiltLead = { readonly spot: LeadSpot; readonly person: TeamPerson; readonly division: string };
/** An open department with a head: its heads by name, and the leads of its divisions in division order. */
export type BuiltDepartment = {
  readonly id: number;
  readonly name: string;
  /** The carousel slide its heads sit on (issue #325). */
  readonly kind: DepartmentKind;
  readonly heads: readonly BuiltHead[];
  readonly leads: readonly BuiltLead[];
};

export type TeamBuild = {
  /** Everyone with an active role: who an edit may show in a spot. */
  readonly people: readonly TeamPerson[];
  readonly leader: { readonly person: TeamPerson; readonly role: string } | null;
  /** The board seats in reading order, every holder, before the cap of eight. */
  readonly arc: readonly BuiltLeader[];
  readonly departments: readonly BuiltDepartment[];
  /** Not editable: always from the roles. */
  readonly core: readonly Member[];
};

// The page with the layer laid on.

/** Something on the page and where it came from, so the editor can find its edit. */
export type Shown<R, T> = { readonly at: R; readonly shown: T };

export type ShownDepartment = {
  readonly at: DepartmentRef;
  readonly name: string;
  /** The carousel slide its heads sit on (issue #325); a department the editor added is technical. */
  readonly kind: DepartmentKind;
  readonly heads: readonly Shown<HeadSpot | AddedRef, DepartmentHead>[];
  readonly leads: readonly Shown<LeadRef, DivisionLead>[];
};

export type ShownTeam = {
  readonly leader: Leader | null;
  /** In `OrgChart.leaders` reading order, at most eight. */
  readonly leaders: readonly Shown<ArcRef, Leader>[];
  readonly departments: readonly ShownDepartment[];
  readonly intro: string | null;
  readonly figures?: HeaderStats;
  readonly groupPhoto: GroupPhoto | null;
};

const addedRef = (id: number): AddedRef => `added:${id}`;

function memberOf(build: TeamBuild, id: number | undefined): TeamPerson | undefined {
  return id === undefined ? undefined : build.people.find((p) => p.id === id);
}

/** What a spot shows: the person the edit names when they are still on the team, else the roles' one, with each field the edit sets. */
function shownPerson(build: TeamBuild, fromRoles: TeamPerson, edit: PersonEdit | undefined): Person {
  const drawn = personOf(memberOf(build, edit?.person) ?? fromRoles);
  return {
    ...drawn,
    ...(edit?.name !== undefined && { name: edit.name }),
    ...(edit?.photo !== undefined && { photo: edit.photo }),
    ...(edit?.linkedin !== undefined && { linkedin: edit.linkedin }),
  };
}

/** An added person as the page draws them; null once they have left the team. */
function shownAdded(build: TeamBuild, added: AddedPerson): Person | null {
  const member = memberOf(build, added.person);
  if (member === undefined) return null;
  return shownPerson(build, member, { name: added.name, photo: added.photo, linkedin: added.linkedin });
}

/** Where an added leader goes in `slots`; null while its neighbour is not placed yet. */
function insertAt(slots: readonly { readonly ref: ArcRef }[], place: ArcPlace): number | null {
  if ("after" in place) {
    const index = slots.findIndex((slot) => slot.ref === place.after);
    return index === -1 ? null : index + 1;
  }
  return place.at === "start" ? 0 : slots.length;
}

/**
 * The arc in reading order, before the cap: the roles' leaders, then each
 * added leader at its place. A hidden leader keeps their place while the
 * added ones are placed, so "after" a hidden neighbour still means where they
 * stood. An added leader whose neighbour is gone from the page goes at the
 * end; one who has left the team is skipped.
 */
function arcOf(build: TeamBuild, layer: TeamPageLayer): Shown<ArcRef, Leader>[] {
  const slots: { ref: ArcRef; leader: Leader | null }[] = build.arc.map((built) => {
    const edit = layer.spots[built.spot];
    return {
      ref: built.spot,
      leader: edit?.hidden ? null : { ...shownPerson(build, built.person, edit), role: edit?.role ?? built.role },
    };
  });
  let pending = layer.addedLeaders.flatMap((added) => {
    const person = shownAdded(build, added);
    return person === null ? [] : [{ added, leader: { ...person, role: added.role } }];
  });
  for (let placed = true; placed && pending.length > 0; ) {
    placed = false;
    pending = pending.filter(({ added, leader }) => {
      const index = insertAt(slots, added.place);
      if (index === null) return true;
      slots.splice(index, 0, { ref: addedRef(added.id), leader });
      placed = true;
      return false;
    });
  }
  for (const { added, leader } of pending) slots.push({ ref: addedRef(added.id), leader });
  return slots.flatMap((slot) => (slot.leader === null ? [] : [{ at: slot.ref, shown: slot.leader }]));
}

/** `items` with those `order` names first, in its order, then the rest as they were. */
function inOrder<T extends { readonly at: LeadRef }>(items: readonly T[], order: readonly LeadRef[] | undefined): T[] {
  if (order === undefined) return [...items];
  const rank = (item: T) => {
    const i = order.indexOf(item.at);
    return i === -1 ? order.length : i;
  };
  return items.map((item, i) => ({ item, i })).sort((a, b) => rank(a.item) - rank(b.item) || a.i - b.i).map(({ item }) => item);
}

function addedLeadsOf(build: TeamBuild, leads: readonly AddedLead[]): Shown<LeadRef, DivisionLead>[] {
  return leads.flatMap((lead) => {
    const person = shownAdded(build, lead);
    return person === null ? [] : [{ at: addedRef(lead.id), shown: { ...person, division: lead.division } }];
  });
}

function departmentOf(build: TeamBuild, layer: TeamPageLayer, department: BuiltDepartment): ShownDepartment | null {
  const edit = layer.departments[`${department.id}`];
  if (edit?.hidden) return null;
  const name = edit?.name ?? department.name;
  const fromRoles = department.leads.flatMap((built): Shown<LeadRef, DivisionLead>[] => {
    const spot = layer.spots[built.spot];
    if (spot?.hidden) return [];
    return [{ at: built.spot, shown: { ...shownPerson(build, built.person, spot), division: spot?.role ?? built.division } }];
  });
  const leads = inOrder([...fromRoles, ...addedLeadsOf(build, edit?.addedLeads ?? [])], edit?.leadOrder);
  const heads = department.heads.flatMap((built): Shown<HeadSpot, DepartmentHead>[] => {
    const spot = layer.spots[built.spot];
    if (spot?.hidden) return [];
    const role = spot?.role ?? built.title ?? `Head of ${name}`;
    return [{ at: built.spot, shown: { kind: "head", ...shownPerson(build, built.person, spot), role, leads: leads.map((l) => l.shown) } }];
  });
  return { at: department.id, name, kind: department.kind, heads, leads };
}

function addedDepartmentOf(build: TeamBuild, added: AddedDepartment): ShownDepartment | null {
  const head = shownAdded(build, added.head);
  if (head === null) return null;
  const leads = addedLeadsOf(build, added.leads);
  const role = added.head.role ?? `Head of ${added.name}`;
  return {
    at: addedRef(added.id),
    name: added.name,
    kind: "technical",
    heads: [{ at: addedRef(added.id), shown: { kind: "head", ...head, role, leads: leads.map((l) => l.shown) } }],
    leads,
  };
}

/**
 * The page the roles build with the layer laid on: each edit at its spot,
 * added leaders at their places on the arc (at most eight in all), added
 * departments after the roles' ones. An edit whose spot the roles no longer
 * fill, or that shows someone who has left the team, is skipped and kept.
 */
export function applyLayer(build: TeamBuild, layer: TeamPageLayer): ShownTeam {
  const leader =
    build.leader === null
      ? null
      : { ...shownPerson(build, build.leader.person, layer.leader), role: layer.leader.role ?? build.leader.role };
  const departments = [
    ...build.departments.map((d) => departmentOf(build, layer, d)),
    ...layer.addedDepartments.map((d) => addedDepartmentOf(build, d)),
  ].filter((d): d is ShownDepartment => d !== null);
  return {
    leader,
    leaders: arcOf(build, layer).slice(0, ARC_LEADERS),
    departments,
    intro: layer.intro,
    ...(layer.figures !== undefined && { figures: layer.figures }),
    groupPhoto: layer.groupPhoto,
  };
}

/** How many leaders the arc would hold under the layer, before the cap of eight. */
export function leadersOnArc(build: TeamBuild, layer: TeamPageLayer): number {
  return arcOf(build, layer).length;
}

/** Reset to team (board 80h): every edit goes, except the intro text and its figures and the group photo. */
export function resetLayer(layer: TeamPageLayer): TeamPageLayer {
  return {
    ...NO_TEAM_LAYER,
    intro: layer.intro,
    ...(layer.figures !== undefined && { figures: layer.figures }),
    groupPhoto: layer.groupPhoto,
  };
}

/**
 * Every photo the layer sets: on the team leader, on a spot, on each person
 * it added, and the group photo, which may be an upload too (issue #510).
 */
export function layerPhotos(layer: TeamPageLayer): PersonPhoto[] {
  const people: readonly { readonly photo?: PersonPhoto }[] = [
    layer.leader,
    ...Object.values(layer.spots).flatMap((edit) => edit ?? []),
    ...layer.addedLeaders,
    ...Object.values(layer.departments).flatMap((edit) => edit?.addedLeads ?? []),
    ...layer.addedDepartments.flatMap((d) => [d.head, ...d.leads]),
  ];
  return [...people.flatMap((person) => person.photo ?? []), ...(layer.groupPhoto === null ? [] : [layer.groupPhoto.src])];
}

/** Every id the things the editor added hold, in one list: one id names one thing. */
function addedIds(layer: TeamPageLayer): number[] {
  return [
    ...layer.addedLeaders.map((l) => l.id),
    ...layer.addedDepartments.flatMap((d) => [d.id, ...d.leads.map((l) => l.id)]),
    ...Object.values(layer.departments).flatMap((d) => (d?.addedLeads ?? []).map((l) => l.id)),
  ];
}

/** The id the next thing the editor adds takes: after every id the layer holds. */
export function nextAddedId(layer: TeamPageLayer): number {
  return addedIds(layer).reduce((last, id) => Math.max(last, id), 0) + 1;
}

export const ARC_FULL = `The arc holds up to ${ARC_LEADERS} leaders.`;

/**
 * Add leader (board 80f): a team member on the arc at `place`, between two
 * neighbours or at either end. Refused when the arc already shows eight, or
 * when they are not on the team.
 */
export function addLeader(build: TeamBuild, layer: TeamPageLayer, leader: Omit<AddedLeader, "id">): WriteResult<TeamPageLayer> {
  if (memberOf(build, leader.person) === undefined) return refused("Pick someone on the team.");
  if (leadersOnArc(build, layer) >= ARC_LEADERS) return refused(ARC_FULL);
  return written({ ...layer, addedLeaders: [...layer.addedLeaders, { ...leader, id: nextAddedId(layer) }] });
}

// A layer read back from storage or sent by the browser: anything this code
// could not have written reads as not a layer.

/** The longest name, role, division or department name the page takes. */
export const TEAM_PAGE_TEXT_MAX = 120;
/** The longest intro the page takes. */
export const TEAM_PAGE_INTRO_MAX = 1000;
/** The longest figure value the header's row of four takes ("150+"). */
export const TEAM_PAGE_FIGURE_VALUE_MAX = 12;
/** The longest figure label, desktop or phone ("INTERNATIONAL"). */
export const TEAM_PAGE_FIGURE_LABEL_MAX = 24;

/**
 * Whether a remote photo URL is a photo the Team page editor uploaded to this
 * site's own public store, on that store's host (./team-page-photos.ts). Each
 * side that reads or writes a layer passes its own: a side with no store owns
 * none.
 */
export type OwnsUpload = (src: string) => boolean;

/** A side with no public store of its own (the seed, a preview's stand-in): it owns no upload. */
export const NO_UPLOADS: OwnsUpload = () => false;

type Check = (value: unknown) => boolean;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const isIndex = (value: string) => /^(0|[1-9]\d{0,5})$/.test(value);
const isIdText = (value: string) => /^[1-9]\d{0,9}$/.test(value);
const isText =
  (max: number): Check =>
  (value) =>
    typeof value === "string" && value.trim() !== "" && textLength(value) <= max;
const isShortText = isText(TEAM_PAGE_TEXT_MAX);
const isPhoto: Check = (value) => typeof value === "string" && textLength(value) <= 2048 && (value.startsWith("/team/") || value.startsWith("https://"));
/** A LinkedIn handle the layer takes: the part after linkedin.com/in/, with no slash, query or space. */
export const isLinkedinHandle = (value: unknown): value is string => typeof value === "string" && /^[^/?#\s]{1,100}$/.test(value);
const isHandle: Check = isLinkedinHandle;
const isTrue: Check = (value) => value === true;

/** Every key is one of `checks` and passes it; a key `required` names must be there. */
function hasShape(value: unknown, checks: Readonly<Record<string, Check>>, required: readonly string[] = []): boolean {
  if (!isRecord(value)) return false;
  return (
    required.every((key) => value[key] !== undefined) &&
    Object.entries(value).every(([key, field]) => Object.hasOwn(checks, key) && (field === undefined || checks[key](field)))
  );
}

const PERSON_EDIT: Readonly<Record<string, Check>> = { person: isId, name: isShortText, role: isShortText, photo: isPhoto, linkedin: isHandle };
const ADDED_PERSON: Readonly<Record<string, Check>> = { person: isId, name: isShortText, photo: isPhoto, linkedin: isHandle };

export function isSpot(value: unknown): value is Spot {
  if (typeof value !== "string") return false;
  const [kind, a, b, ...rest] = value.split(":");
  if (rest.length > 0 || b === undefined || !isIndex(b)) return false;
  if (kind === "arc") return (BOARD_SEATS as readonly string[]).includes(a);
  return (kind === "head" || kind === "lead") && isIdText(a);
}

const isAddedRef = (value: unknown): value is AddedRef => typeof value === "string" && /^added:[1-9]\d{0,9}$/.test(value);
const isArcRef = (value: unknown): value is ArcRef => isAddedRef(value) || (isSpot(value) && value.startsWith("arc:"));
const isLeadRef = (value: unknown): value is LeadRef => isAddedRef(value) || (isSpot(value) && value.startsWith("lead:"));

const isPlace: Check = (value) =>
  isRecord(value) && (Object.keys(value).length === 1 ? value.at === "start" || value.at === "end" || isArcRef(value.after) : false);

const isAddedLead: Check = (value) => hasShape(value, { ...ADDED_PERSON, id: isId, division: isShortText }, ["person", "id", "division"]);
const isAddedLeader: Check = (value) =>
  hasShape(value, { ...ADDED_PERSON, id: isId, place: isPlace, role: isShortText }, ["person", "id", "place", "role"]);
const isListOf =
  (check: Check, max: number): Check =>
  (value) =>
    Array.isArray(value) && value.length <= max && value.every(check);

const isDepartmentEdit: Check = (value) =>
  hasShape(value, { name: isShortText, hidden: isTrue, leadOrder: isListOf(isLeadRef, 200), addedLeads: isListOf(isAddedLead, 50) });

const isAddedDepartment: Check = (value) =>
  hasShape(
    value,
    {
      id: isId,
      name: isShortText,
      head: (head) => hasShape(head, { ...ADDED_PERSON, role: isShortText }, ["person"]),
      leads: isListOf(isAddedLead, 50),
    },
    ["id", "name", "head", "leads"],
  );

/** A group photo: a photo of the site's own, or a Team page upload `ownsUpload` names; never any other remote URL. */
const isGroupPhoto =
  (ownsUpload: OwnsUpload): Check =>
  (value) =>
    // The description is optional (Owner decision, issue #430): an empty one draws the photo with alt="".
    hasShape(
      value,
      {
        src: (src) => typeof src === "string" && isPhoto(src) && (src.startsWith("/team/") || ownsUpload(src)),
        alt: (alt) => typeof alt === "string" && textLength(alt) <= 300,
      },
      ["src", "alt"],
    );

const isFigureLabel: Check = (value) =>
  hasShape(value, { text: isText(TEAM_PAGE_FIGURE_LABEL_MAX), phone: isText(TEAM_PAGE_FIGURE_LABEL_MAX) }, ["text"]);
const isFigure: Check = (value) => hasShape(value, { value: isText(TEAM_PAGE_FIGURE_VALUE_MAX), label: isFigureLabel }, ["value", "label"]);
/** Always four figures: the header's row has no room to add one and none to leave empty. */
const isFigures: Check = (value) => Array.isArray(value) && value.length === 4 && value.every(isFigure);

/**
 * A layer this code could have written: every part present, each edit well
 * formed, every added id used once. `figures` alone may be absent, as layers
 * saved before it existed leave it. A group photo off the site's own photos
 * must be an upload `ownsUpload` names.
 */
export function isTeamPageLayer(value: unknown, ownsUpload: OwnsUpload): value is TeamPageLayer {
  if (
    !hasShape(
      value,
      {
        leader: (v) => hasShape(v, PERSON_EDIT),
        spots: (v) => isRecord(v) && Object.entries(v).every(([key, edit]) => isSpot(key) && hasShape(edit, { ...PERSON_EDIT, hidden: isTrue })),
        addedLeaders: isListOf(isAddedLeader, 50),
        departments: (v) => isRecord(v) && Object.entries(v).every(([key, edit]) => isIdText(key) && isDepartmentEdit(edit)),
        addedDepartments: isListOf(isAddedDepartment, 50),
        intro: (v) => v === null || isText(TEAM_PAGE_INTRO_MAX)(v),
        figures: isFigures,
        groupPhoto: (v) => v === null || isGroupPhoto(ownsUpload)(v),
      },
      ["leader", "spots", "addedLeaders", "departments", "addedDepartments", "intro", "groupPhoto"],
    )
  ) {
    return false;
  }
  const ids = addedIds(value as TeamPageLayer);
  return new Set(ids).size === ids.length;
}
