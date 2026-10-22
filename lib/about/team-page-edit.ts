import { textLength } from "@/lib/content/text";
import {
  applyLayer,
  isLinkedinHandle,
  TEAM_PAGE_FIGURE_LABEL_MAX,
  TEAM_PAGE_FIGURE_VALUE_MAX,
  TEAM_PAGE_INTRO_MAX,
  TEAM_PAGE_TEXT_MAX,
  type ArcSpot,
  type GroupPhoto,
  type PersonEdit,
  type ShownTeam,
  type SpotEdit,
  type TeamBuild,
  type TeamPageLayer,
} from "./team-layer";
import { linkedinHandleOf, personOf, type TeamPerson } from "./team-person";
import { teamPageOf, withLayerText } from "./team-roles";
import type { HeaderStat, HeaderStats, PersonPhoto, Photo, TeamPage } from "./types";

// The Team page editor's own steps (boards 80, 80b and 80h, issue #284): the
// page as the working layer draws it, the Edit person panel's fields for a
// spot and the edit they make, Back to the team record, the intro text and
// the group photo, and how many edits Reset to team removes. Pure: the
// editor holds the layer and sends it whole to the layer actions
// (./team-page-editor.ts), which check it again.

/** A spot the Edit person panel opens (board 80b): the team leader, or a place on the arc the roles fill. */
export type PersonSpot = "leader" | ArcSpot;

/** The page the working layer draws, and where each person on it came from; `shown` is null when the roles cannot fill the page. */
export type EditedTeamPage = { readonly page: TeamPage; readonly shown: ShownTeam | null };

/** The page with `layer` laid on the roles build, onto `base`; as the public page draws it (`publicTeamPage`). */
export function editedTeamPage(build: TeamBuild, base: TeamPage, layer: TeamPageLayer): EditedTeamPage {
  const shown = applyLayer(build, layer);
  const page = teamPageOf(build, shown, base);
  return page === null ? { page: withLayerText(base, layer), shown: null } : { page, shown };
}

/** What the roles put in a spot: the "Team record" lines of board 80b. */
export type SpotRecord = { readonly person: TeamPerson; readonly role: string };

export function spotRecord(build: TeamBuild, spot: PersonSpot): SpotRecord | null {
  if (spot === "leader") return build.leader;
  return build.arc.find((built) => built.spot === spot) ?? null;
}

/** The edit a spot holds; an empty one when it holds none. */
export function spotEditOf(layer: TeamPageLayer, spot: PersonSpot): SpotEdit {
  return spot === "leader" ? layer.leader : (layer.spots[spot] ?? {});
}

export function isEdited(layer: TeamPageLayer, spot: PersonSpot): boolean {
  return Object.keys(spotEditOf(layer, spot)).length > 0;
}

/**
 * `layer` with `edit` at the spot. An empty edit removes the spot's edit:
 * that is Back to the team record. The team leader cannot be hidden, so a
 * `hidden` for them is dropped.
 */
export function withSpotEdit(layer: TeamPageLayer, spot: PersonSpot, edit: SpotEdit): TeamPageLayer {
  if (spot === "leader") {
    const { hidden: _hidden, ...leader } = edit;
    return { ...layer, leader };
  }
  const { [spot]: _old, ...spots } = layer.spots;
  return { ...layer, spots: Object.keys(edit).length === 0 ? spots : { ...spots, [spot]: edit } };
}

/** Back to the team record (board 80b): the spot shows what the roles put there. */
export function backToTeamRecord(layer: TeamPageLayer, spot: PersonSpot): TeamPageLayer {
  return withSpotEdit(layer, spot, {});
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

function memberOf(build: TeamBuild, id: number): TeamPerson | undefined {
  return build.people.find((p) => p.id === id);
}

/** The panel's fields for a spot as the layer shows it now; null when the roles no longer fill the spot. */
export function personFieldsOf(build: TeamBuild, layer: TeamPageLayer, spot: PersonSpot): PersonFields | null {
  const record = spotRecord(build, spot);
  if (record === null) return null;
  const edit = spotEditOf(layer, spot);
  const person = (edit.person === undefined ? undefined : memberOf(build, edit.person)) ?? record.person;
  const own = personOf(person);
  return {
    shown: edit.hidden !== true,
    person: person.id,
    name: edit.name ?? own.name,
    role: edit.role ?? record.role,
    photo: edit.photo ?? null,
    linkedin: edit.linkedin ?? own.linkedin ?? "",
  };
}

/** Another person in the spot: their own name, photo and LinkedIn; the role on the page stays. */
export function withPerson(build: TeamBuild, fields: PersonFields, id: number): PersonFields {
  const person = memberOf(build, id);
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
 * The edit the panel's fields make at the spot: only what differs from the
 * team record, so a field put back as the roles have it is no edit. A blank
 * name, role or LinkedIn reads as the record's.
 */
export function editOfFields(build: TeamBuild, spot: PersonSpot, fields: PersonFields): SpotEdit {
  const record = spotRecord(build, spot);
  if (record === null) return {};
  const person = memberOf(build, fields.person) ?? record.person;
  const own = personOf(person);
  const name = fields.name.trim();
  const role = fields.role.trim();
  const linkedin = linkedinHandle(fields.linkedin);
  const edit: PersonEdit = {
    ...(person.id !== record.person.id && { person: person.id }),
    ...(name !== "" && name !== own.name && { name }),
    ...(role !== "" && role !== record.role && { role }),
    ...(fields.photo !== null && { photo: fields.photo }),
    ...(linkedin !== "" && linkedin !== (own.linkedin ?? "") && { linkedin }),
  };
  return spot !== "leader" && !fields.shown ? { ...edit, hidden: true } : edit;
}

/** A photo the editor can pick, and whose it is. */
export type PhotoChoice<P extends PersonPhoto = PersonPhoto> = { readonly src: P; readonly label: string };

function uniqueBySrc<P extends PersonPhoto>(choices: readonly PhotoChoice<P>[]): PhotoChoice<P>[] {
  const seen = new Set<string>();
  return choices.filter((c) => !seen.has(c.src) && seen.add(c.src));
}

/** Every photo the site already holds for a person: each member's own, then the hand-typed record's. */
export function personPhotoChoices(build: TeamBuild, base: TeamPage): PhotoChoice[] {
  const own = build.people.flatMap((p) => {
    const { photo } = personOf(p);
    return photo === undefined ? [] : [{ src: photo, label: p.name }];
  });
  const typed = [
    base.orgChart.leader,
    ...base.orgChart.leaders,
    ...base.departments.groups.flatMap((g) => g.members.flatMap((m) => [m, ...(m.kind === "head" ? m.leads : [])])),
    ...base.advisors.people,
  ].flatMap((p) => (p.photo === undefined ? [] : [{ src: p.photo, label: p.name }]));
  return uniqueBySrc([...own, ...typed]);
}

const isSitePhoto = (src: PersonPhoto): src is Photo => src.startsWith("/team/");

/** The photos the group photo may be: the site's own photos in public/team/, the record's group photo first. */
export function groupPhotoChoices(build: TeamBuild, base: TeamPage): PhotoChoice[] {
  const group: PhotoChoice = { src: base.coreMembers.groupPhoto.src, label: base.coreMembers.groupPhoto.alt };
  const site = personPhotoChoices(build, base).filter((c): c is PhotoChoice<Photo> => isSitePhoto(c.src));
  return uniqueBySrc<PersonPhoto>([group, ...site]);
}

/** The group photo the page shows under the layer. */
export function groupPhotoOf(base: TeamPage, layer: TeamPageLayer): GroupPhoto {
  return layer.groupPhoto ?? base.coreMembers.groupPhoto;
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
export function withGroupPhoto(base: TeamPage, layer: TeamPageLayer, photo: GroupPhoto): TeamPageLayer {
  const original = base.coreMembers.groupPhoto;
  const same = photo.src === original.src && photo.alt.trim() === original.alt;
  return { ...layer, groupPhoto: same ? null : { src: photo.src, alt: photo.alt.trim() } };
}

/** The intro as typed in place; blank or as the record has it is no edit. */
export function withIntro(base: TeamPage, layer: TeamPageLayer, text: string): TeamPageLayer {
  const intro = text.trim();
  return { ...layer, intro: intro === "" || intro === base.header.intro ? null : intro };
}

export function introError(text: string): string | undefined {
  return textLength(text.trim()) > TEAM_PAGE_INTRO_MAX ? `Up to ${TEAM_PAGE_INTRO_MAX} characters.` : undefined;
}

/** The four figures under the intro as the page shows them under the layer (issue #510). */
export function figuresOf(base: TeamPage, layer: TeamPageLayer): HeaderStats {
  return layer.figures ?? base.header.stats;
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
export function withFigures(base: TeamPage, layer: TeamPageLayer, figures: HeaderStats): TeamPageLayer {
  const [a, b, c, d] = figures;
  const typed: HeaderStats = [trimmedFigure(a), trimmedFigure(b), trimmedFigure(c), trimmedFigure(d)];
  const { figures: _old, ...rest } = layer;
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
export function introBlockError(base: TeamPage, layer: TeamPageLayer): string | undefined {
  const intro = introError(layer.intro ?? "");
  if (intro !== undefined) return `Intro text: ${intro}`;
  return figureErrors(figuresOf(base, layer)).some((e) => Object.keys(e).length > 0) ? "Figures: fix the highlighted fields." : undefined;
}

/**
 * How many edits Reset to team removes (board 80h): one per edited spot,
 * added leader, added department and added division lead, and one per
 * department name, hiding and order. The intro text, its figures and the
 * group photo stay, so they do not count.
 */
export function editCount(layer: TeamPageLayer): number {
  const departments = Object.values(layer.departments).reduce(
    (n, d) => n + (d?.name === undefined ? 0 : 1) + (d?.hidden ? 1 : 0) + (d?.leadOrder === undefined ? 0 : 1) + (d?.addedLeads?.length ?? 0),
    0,
  );
  return (
    (Object.keys(layer.leader).length > 0 ? 1 : 0) +
    Object.keys(layer.spots).length +
    layer.addedLeaders.length +
    layer.addedDepartments.length +
    departments
  );
}
