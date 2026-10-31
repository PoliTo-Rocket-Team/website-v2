import { textLength } from "@/lib/content/text";
import {
  isLinkedinHandle,
  TEAM_PAGE_FIGURE_LABEL_MAX,
  TEAM_PAGE_FIGURE_VALUE_MAX,
  TEAM_PAGE_INTRO_MAX,
  TEAM_PAGE_TEXT_MAX,
  type GroupPhoto,
  type TeamPageText,
} from "./team-layer";
import {
  bindingFor,
  holdingOf,
  layoutPageOf,
  resolveLayout,
  sameBinding,
  type DepartmentBlock,
  type PageSeat,
  type PlaceBinding,
  type ResolvedTeam,
  type SeatOverrides,
  type TeamLayout,
} from "./team-layout";
import type { TeamPageContent } from "./team-page-stored";
import { linkedinHandleOf, personOf, type TeamPerson } from "./team-person";
import type { TeamRoles } from "./team-roles";
import type { HeaderStat, HeaderStats, PersonPhoto, Photo, TeamPage } from "./types";

// The Team page editor's own steps (boards 80, 80b and 80h, issues #284 and
// #851): the page as the working layout draws it, the Edit person panel's
// fields for a page seat and the seat they make, Back to the team record, the
// intro text and the group photo, and how many edits Reset to team removes.
// The panel picks a person; the page seat is bound to the seat they hold, or
// to them when they hold none (`bindingFor`). Pure: the editor holds the
// layout and the text and sends them whole to the save
// (./team-page-editor.ts), which checks them again.

/** The page the working content draws, as the public page draws it (`layoutPageOf`), and what each page seat shows on it. */
export type EditedTeamPage = { readonly page: TeamPage; readonly resolved: ResolvedTeam };

/** The page `content` draws on the team record `roles`, onto `base`: the public page as it would draw the same version. */
export function editedTeamPage(roles: TeamRoles, base: TeamPage, content: TeamPageContent): EditedTeamPage {
  return { page: layoutPageOf(roles, content.layout, content.text, base), resolved: resolveLayout(content.layout, roles) };
}

/** Who the seat a page seat is bound to puts there, and the text it reads: the "Team record" lines of board 80b. */
export type SpotRecord = { readonly person: TeamPerson; readonly role: string };

/** The page seat the Edit person panel opens (board 80b): the team leader's, or one on the arc. */
function personSeat(layout: TeamLayout, id: number): PageSeat | undefined {
  return layout.leader?.id === id ? layout.leader : layout.arc.find((seat) => seat.id === id);
}

/** Whether page seat `id` is the team leader's, which is always on the page. */
export function isLeaderSeat(layout: TeamLayout, id: number): boolean {
  return layout.leader?.id === id;
}

export function spotRecord(roles: TeamRoles, layout: TeamLayout, id: number): SpotRecord | null {
  const seat = personSeat(layout, id);
  const holding = seat === undefined ? null : holdingOf(seat.binding, roles);
  return holding === null ? null : { person: holding.person, role: holding.title };
}

/** The team leader's binding: what their page seat goes back to. */
const TEAM_LEADER: PlaceBinding = { kind: "team-leader" };

/** Whether a page seat shows anything but its seat's record: an override, or the team leader's place bound to another seat. */
export function isEdited(layout: TeamLayout, id: number): boolean {
  const seat = personSeat(layout, id);
  if (seat === undefined) return false;
  return Object.keys(seat.overrides).length > 0 || (isLeaderSeat(layout, id) && !sameBinding(seat.binding, TEAM_LEADER));
}

/** `layout` with page seat `id` replaced by `seat`, or taken off the arc when `seat` is null. */
function withPersonSeat(layout: TeamLayout, id: number, seat: PageSeat | null): TeamLayout {
  if (isLeaderSeat(layout, id)) return seat === null ? layout : { ...layout, leader: seat };
  return { ...layout, arc: layout.arc.flatMap((s) => (s.id !== id ? [s] : seat === null ? [] : [seat])) };
}

/**
 * Back to the team record (board 80b): the page seat shows its seat's holder
 * with no override, and the team leader's place is bound to the team leader
 * again. A place on the arc keeps the seat it is bound to: the layout keeps
 * no earlier binding to go back to.
 */
export function backToTeamRecord(layout: TeamLayout, id: number): TeamLayout {
  const seat = personSeat(layout, id);
  if (seat === undefined) return layout;
  return withPersonSeat(layout, id, { ...seat, binding: isLeaderSeat(layout, id) ? TEAM_LEADER : seat.binding, overrides: {} });
}

/** The Edit person panel as the editor fills it (board 80b). */
export type PersonFields = {
  /** "On the Team page"; always on for the team leader. */
  readonly shown: boolean;
  /** "Person in this spot": anyone on the team, by member id. */
  readonly person: number;
  readonly name: string;
  readonly role: string;
  /** A photo replaced here; null shows the person's own. */
  readonly photo: PersonPhoto | null;
  /** The LinkedIn handle, or a profile address it is read from. */
  readonly linkedin: string;
};

function memberOf(roles: TeamRoles, id: number): TeamPerson | undefined {
  return roles.people.find((p) => p.id === id);
}

/** The panel's fields for a page seat as the layout shows it now; null when its seat has no holder, so the page does not draw it. */
export function personFieldsOf(roles: TeamRoles, layout: TeamLayout, id: number): PersonFields | null {
  const seat = personSeat(layout, id);
  const record = spotRecord(roles, layout, id);
  if (seat === undefined || record === null) return null;
  const { overrides } = seat;
  const own = personOf(record.person);
  return {
    shown: true,
    person: record.person.id,
    name: overrides.name ?? own.name,
    role: overrides.role ?? record.role,
    photo: overrides.photo ?? null,
    linkedin: overrides.linkedin ?? own.linkedin ?? "",
  };
}

/** Another person in the place: their own name, photo and LinkedIn; the role on the page stays. */
export function withPerson(roles: TeamRoles, fields: PersonFields, id: number): PersonFields {
  const person = memberOf(roles, id);
  if (person === undefined) return fields;
  const own = personOf(person);
  return { ...fields, person: id, name: own.name, photo: null, linkedin: own.linkedin ?? "" };
}

/** "linkedin.com/in/elif-kaya", "in/elif-kaya" and "elif-kaya" are all the handle "elif-kaya". */
export function linkedinHandle(text: string): string {
  const value = text.trim();
  return linkedinHandleOf(value) ?? value.replace(/^in\//i, "");
}

export type PersonFieldErrors = { readonly name?: string; readonly role?: string; readonly linkedin?: string };

const TOO_LONG = `Up to ${TEAM_PAGE_TEXT_MAX} characters.`;

/** What the panel refuses before it saves: names and roles the layer would not take, or a LinkedIn that is no handle. */
export function personFieldErrors(fields: PersonFields): PersonFieldErrors {
  const linkedin = linkedinHandle(fields.linkedin);
  return {
    ...(textLength(fields.name.trim()) > TEAM_PAGE_TEXT_MAX && { name: TOO_LONG }),
    ...(textLength(fields.role.trim()) > TEAM_PAGE_TEXT_MAX && { role: TOO_LONG }),
    ...(linkedin !== "" && !isLinkedinHandle(linkedin) && { linkedin: "Enter the part after linkedin.com/in/." }),
  };
}

export function hasErrors(errors: PersonFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * The overrides a place's fields make for `person` on `binding`: only what
 * differs from what the binding reads by itself, so a field put back as the
 * record has it is no override. A blank name, role or LinkedIn reads as the
 * record's.
 */
export function overridesOf(
  roles: TeamRoles,
  binding: PlaceBinding,
  person: TeamPerson,
  fields: Pick<PersonFields, "name" | "role" | "photo" | "linkedin">,
  headOf?: string,
): SeatOverrides {
  const own = personOf(person);
  const title = holdingOf(binding, roles, headOf)?.title ?? "";
  const name = fields.name.trim();
  const role = fields.role.trim();
  const linkedin = linkedinHandle(fields.linkedin);
  return {
    ...(name !== "" && name !== own.name && { name }),
    ...(role !== "" && role !== title && { role }),
    ...(fields.photo !== null && { photo: fields.photo }),
    ...(linkedin !== "" && linkedin !== (own.linkedin ?? "") && { linkedin }),
  };
}

/**
 * The binding of a place that showed `holder` once the editor picks `person`
 * for it: the binding it has while they are the one it shows, else the seat
 * they hold (`bindingFor`).
 */
export function rebound(roles: TeamRoles, binding: PlaceBinding, holder: TeamPerson | undefined, person: TeamPerson): PlaceBinding {
  return holder?.id === person.id ? binding : bindingFor(person, roles);
}

/**
 * The page seat the panel's fields make of page seat `id`: bound as the
 * person picked asks (`rebound`), with only the overrides that differ from
 * the record; null for a place on the arc taken off the page. The team
 * leader's place is always on the page.
 */
export function seatOfFields(roles: TeamRoles, layout: TeamLayout, id: number, fields: PersonFields): PageSeat | null {
  const seat = personSeat(layout, id);
  if (seat === undefined) return null;
  if (!fields.shown && !isLeaderSeat(layout, id)) return null;
  const holder = spotRecord(roles, layout, id)?.person;
  const person = memberOf(roles, fields.person) ?? holder;
  if (person === undefined) return seat;
  const binding = rebound(roles, seat.binding, holder, person);
  return { id, binding, overrides: overridesOf(roles, binding, person, fields) };
}

/** `layout` with the panel's fields kept at page seat `id`; a place on the arc taken off the page leaves the layout. */
export function withPersonFields(roles: TeamRoles, layout: TeamLayout, id: number, fields: PersonFields): TeamLayout {
  return withPersonSeat(layout, id, seatOfFields(roles, layout, id, fields));
}

/** Whether the panel's fields change page seat `id`. */
export function changesSeat(roles: TeamRoles, layout: TeamLayout, id: number, fields: PersonFields): boolean {
  const seat = personSeat(layout, id);
  const next = seatOfFields(roles, layout, id, fields);
  return seat !== undefined && (next === null || !sameBinding(next.binding, seat.binding) || !sameOverrides(next.overrides, seat.overrides));
}

/** Whether two page seats override the same fields with the same values. */
export function sameOverrides(a: SeatOverrides, b: SeatOverrides): boolean {
  return a.name === b.name && a.role === b.role && a.photo === b.photo && a.linkedin === b.linkedin;
}

/** A photo the editor can pick, and whose it is. */
export type PhotoChoice<P extends PersonPhoto = PersonPhoto> = { readonly src: P; readonly label: string };

function uniqueBySrc<P extends PersonPhoto>(choices: readonly PhotoChoice<P>[]): PhotoChoice<P>[] {
  const seen = new Set<string>();
  return choices.filter((c) => !seen.has(c.src) && seen.add(c.src));
}

/** Every photo the site already holds for a person: each member's own, then the hand-typed record's. */
export function personPhotoChoices(people: readonly TeamPerson[], base: TeamPage): PhotoChoice[] {
  const own = people.flatMap((p) => {
    const { photo } = personOf(p);
    return photo === undefined ? [] : [{ src: photo, label: p.name }];
  });
  const typed = [
    ...(base.orgChart.leader === null ? [] : [base.orgChart.leader]),
    ...base.orgChart.leaders,
    ...base.departments.groups.flatMap((g) => g.members.flatMap((m) => [m, ...(m.kind === "head" ? m.leads : [])])),
    ...base.advisors.people,
  ].flatMap((p) => (p.photo === undefined ? [] : [{ src: p.photo, label: p.name }]));
  return uniqueBySrc([...own, ...typed]);
}

const isSitePhoto = (src: PersonPhoto): src is Photo => src.startsWith("/team/");

/** The photos the group photo may be: the site's own photos in public/team/, the record's group photo first. */
export function groupPhotoChoices(people: readonly TeamPerson[], base: TeamPage): PhotoChoice[] {
  const group: PhotoChoice = { src: base.coreMembers.groupPhoto.src, label: base.coreMembers.groupPhoto.alt };
  const site = personPhotoChoices(people, base).filter((c): c is PhotoChoice<Photo> => isSitePhoto(c.src));
  return uniqueBySrc<PersonPhoto>([group, ...site]);
}

/** The group photo the page shows under the layer's text. */
export function groupPhotoOf(base: TeamPage, text: TeamPageText): GroupPhoto {
  return text.groupPhoto ?? base.coreMembers.groupPhoto;
}

/**
 * What the editor typed in the group photo box, by photo file (issue #430):
 * each photo keeps its own description, so picking another photo never
 * carries the text along. A description is optional.
 */
export type GroupPhotoDescriptions = Readonly<Record<string, string>>;

/** The descriptions the box opens on: the photo shown now and the record's own. */
export function groupPhotoDescriptions(photo: GroupPhoto, original: GroupPhoto): GroupPhotoDescriptions {
  return { [original.src]: original.alt, [photo.src]: photo.alt };
}

/** The photo `src` with its own description: the one typed for it, else none. */
export function describedGroupPhoto(src: PersonPhoto, descriptions: GroupPhotoDescriptions): GroupPhoto {
  return { src, alt: descriptions[src] ?? "" };
}

/**
 * The photos the group photo box shows (issue #510): each photo uploaded in
 * it, newest first, the one shown now among them when it is an upload, then
 * the site's own.
 */
export function groupPhotoRow(site: readonly PhotoChoice[], uploads: readonly PersonPhoto[], shown: GroupPhoto): PhotoChoice[] {
  const uploaded = [...uploads, ...(isSitePhoto(shown.src) ? [] : [shown.src])].map((src) => ({ src, label: "Uploaded photo" }));
  return uniqueBySrc<PersonPhoto>([...uploaded, ...site]);
}

/** A group photo put back as the record has it is no edit. */
export function withGroupPhoto(base: TeamPage, text: TeamPageText, photo: GroupPhoto): TeamPageText {
  const original = base.coreMembers.groupPhoto;
  const same = photo.src === original.src && photo.alt.trim() === original.alt;
  return { ...text, groupPhoto: same ? null : { src: photo.src, alt: photo.alt.trim() } };
}

/** The intro as typed in place; blank or as the record has it is no edit. */
export function withIntro(base: TeamPage, text: TeamPageText, typed: string): TeamPageText {
  const intro = typed.trim();
  return { ...text, intro: intro === "" || intro === base.header.intro ? null : intro };
}

export function introError(text: string): string | undefined {
  return textLength(text.trim()) > TEAM_PAGE_INTRO_MAX ? `Up to ${TEAM_PAGE_INTRO_MAX} characters.` : undefined;
}

/** The four figures under the intro as the page shows them under the layer's text (issue #510). */
export function figuresOf(base: TeamPage, text: TeamPageText): HeaderStats {
  return text.figures ?? base.header.stats;
}

const trimmedFigure = ({ value, label }: HeaderStat): HeaderStat => {
  const phone = label.phone?.trim() ?? "";
  return { value: value.trim(), label: { text: label.text.trim(), ...(phone !== "" && { phone }) } };
};

const sameFigure = (a: HeaderStat, b: HeaderStat) => a.value === b.value && a.label.text === b.label.text && a.label.phone === b.label.phone;

/**
 * The figures as typed in place: each trimmed, a blank phone label showing the
 * desktop one, and all four as the record has them is no edit.
 */
export function withFigures(base: TeamPage, text: TeamPageText, figures: HeaderStats): TeamPageText {
  const [a, b, c, d] = figures;
  const typed: HeaderStats = [trimmedFigure(a), trimmedFigure(b), trimmedFigure(c), trimmedFigure(d)];
  const { figures: _old, ...rest } = text;
  return typed.every((f, i) => sameFigure(f, base.header.stats[i])) ? rest : { ...rest, figures: typed };
}

/** One figure's fields the page would not take: a value or label blank or too long. */
export type FigureErrors = { readonly value?: string; readonly label?: string; readonly phone?: string };

function textError(text: string, max: number, required: boolean): string | undefined {
  const typed = text.trim();
  if (typed === "") return required ? "Required." : undefined;
  return textLength(typed) > max ? `Up to ${max} characters.` : undefined;
}

/** Each figure's errors, in order; an empty object for a figure the page takes. */
export function figureErrors(figures: HeaderStats): readonly FigureErrors[] {
  return figures.map(({ value, label }) => {
    const errors = {
      value: textError(value, TEAM_PAGE_FIGURE_VALUE_MAX, true),
      label: textError(label.text, TEAM_PAGE_FIGURE_LABEL_MAX, true),
      phone: textError(label.phone ?? "", TEAM_PAGE_FIGURE_LABEL_MAX, false),
    };
    return Object.fromEntries(Object.entries(errors).filter(([, error]) => error !== undefined)) as FigureErrors;
  });
}

/** Why the intro block cannot be saved as typed; undefined when it can. */
export function introBlockError(base: TeamPage, text: TeamPageText): string | undefined {
  const intro = introError(text.intro ?? "");
  if (intro !== undefined) return `Intro text: ${intro}`;
  return figureErrors(figuresOf(base, text)).some((e) => Object.keys(e).length > 0) ? "Figures: fix the highlighted fields." : undefined;
}

/** How many of `seats` differ from `record`, matched by binding: a seat with an override or a binding `record` lacks, and a binding of `record` no seat holds. */
function seatEdits(seats: readonly PageSeat[], record: readonly PageSeat[]): number {
  const kept = seats.filter((seat) => !record.some((r) => sameBinding(r.binding, seat.binding)) || Object.keys(seat.overrides).length > 0);
  const gone = record.filter((r) => !seats.some((seat) => sameBinding(seat.binding, r.binding)));
  return kept.length + gone.length;
}

/**
 * Whether the bindings both lists hold come in the same order, each as often
 * in one list as in the other: a binding held twice, as two lead rows picking
 * the same person make it, is a change Reset to team undoes.
 */
function sameOrder(bindings: readonly PlaceBinding[], record: readonly PlaceBinding[]): boolean {
  const common = (list: readonly PlaceBinding[], other: readonly PlaceBinding[]) => list.filter((b) => other.some((o) => sameBinding(o, b)));
  const a = common(bindings, record);
  const b = common(record, bindings);
  return a.length === b.length && a.every((binding, i) => sameBinding(binding, b[i]));
}

const bindingsOf = (seats: readonly PageSeat[]) => seats.map((seat) => seat.binding);

/**
 * How many edits Reset to team removes (board 80h): `layout` against
 * `record`, the layout Reset to team writes. One per page seat drawn with an
 * override or bound where the record has none, one per place of the record
 * the layout no longer draws, one per department block added or gone, one
 * per block's name and its leads' order, and one each for the arc's order and
 * the blocks' order. Only drawn seats count: one whose seat has no holder
 * shows nothing to reset. The intro text, its figures and the group photo
 * stay, so they do not count.
 */
export function editCount(roles: TeamRoles, layout: TeamLayout, record: TeamLayout): number {
  const drawn = (seats: readonly PageSeat[]) => seats.filter((seat) => holdingOf(seat.binding, roles) !== null);
  const drawnBlocks = (of: TeamLayout) => of.departments.filter((b) => holdingOf(b.head.binding, roles, b.name) !== null);
  const leader = seatEdits(drawn(layout.leader === null ? [] : [layout.leader]), drawn(record.leader === null ? [] : [record.leader]));
  const arc = seatEdits(drawn(layout.arc), drawn(record.arc)) + (sameOrder(bindingsOf(drawn(layout.arc)), bindingsOf(drawn(record.arc))) ? 0 : 1);
  const blocks = drawnBlocks(layout);
  const departments = blocks.reduce((n, block) => {
    const own = record.departments.find((r) => sameBinding(r.head.binding, block.head.binding));
    if (own === undefined) return n + 1;
    const leads = drawn(block.leads);
    return (
      n +
      (block.name === own.name ? 0 : 1) +
      (Object.keys(block.head.overrides).length > 0 ? 1 : 0) +
      seatEdits(leads, own.leads) +
      (sameOrder(bindingsOf(leads), bindingsOf(own.leads)) ? 0 : 1)
    );
  }, 0);
  const goneBlocks = record.departments.filter((r) => !blocks.some((b) => sameBinding(b.head.binding, r.head.binding))).length;
  const heads = (of: readonly DepartmentBlock[]) => of.map((b) => b.head.binding);
  const blockOrder = sameOrder(heads(blocks), heads(drawnBlocks(record))) ? 0 : 1;
  return leader + arc + departments + goneBlocks + blockOrder;
}
