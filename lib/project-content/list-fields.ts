import type { GalleryItem } from "@/components/gallery/items";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import { isPhotoSrc } from "@/lib/outreach-photos";
import { planSteps, versionList, type PlanStatus } from "@/lib/project-pages";
import {
  specRows,
  type GallerySection,
  type LaunchPhoto,
  type LaunchPhotos,
  type Outcome,
  type Plan,
  type PlanStep,
  type SpecKey,
  type Version,
  type Versions,
} from "@/lib/project-pages/types";
import type { Award } from "@/lib/projects";
import { copyFields, copyOf, filled, titleOf, titleText, type CopyFields } from "./copy-fields";
import type { LaunchHistory, PageStat, ProjectRecord, StoredLaunch } from "./record";

// The list sections of the Edit <project> panel (board 75c, issue #299):
// Versions, Launch history, Plan and Gallery, as the text an editor types.
// Each is optional, so each has a show-on-page switch, and each keeps a rule
// its stored shape holds: one version highlighted, a launch at least in a
// shown launch history, one plan step under way, a photo at least in a shown
// gallery. An edit that would break one is refused with a message (the
// `remove…` and `set…` edits below), and a save checks them again
// (`listProblems`), since a request can carry any fields.

export type ListSection = "versions" | "launches" | "plan" | "gallery";

/** A section's fields with its show-on-page switch. Switched off, the section leaves the record and its fields stay in the panel. */
type Switched<T> = T & { readonly shown: boolean };

// Versions

/** One version's column. A spec left empty has no known value: the page shows a dash. */
export type VersionFields = {
  readonly pill: string;
  readonly tab: string;
  readonly role: CopyFields;
  readonly specs: Readonly<Record<SpecKey, string>>;
  /** Exactly one version is highlighted: bold on desktop and the phone's default tab. */
  readonly highlighted: boolean;
};

export type VersionsFields = Switched<{ readonly title: string; readonly note: CopyFields; readonly items: readonly VersionFields[] }>;

const blankSpecs = (): Record<SpecKey, string> => Object.fromEntries(specRows.map(([key]) => [key, ""])) as Record<SpecKey, string>;

export const blankVersion = (): VersionFields => ({ pill: "", tab: "", role: { text: "", phone: "" }, specs: blankSpecs(), highlighted: false });

function versionFields(version: Version, highlighted: boolean): VersionFields {
  const specs = Object.fromEntries(specRows.map(([key]) => [key, version.specs[key] ?? ""])) as Record<SpecKey, string>;
  return { pill: version.pill, tab: version.tab, role: copyFields(version.role), specs, highlighted };
}

function versionsFields(versions: Versions | undefined): VersionsFields {
  if (versions === undefined) return { shown: false, title: "", note: { text: "", phone: "" }, items: [{ ...blankVersion(), highlighted: true }] };
  return {
    shown: true,
    title: versions.title,
    note: copyFields(versions.note),
    items: versionList(versions).map((v) => versionFields(v, v === versions.highlighted)),
  };
}

function versionOf(fields: VersionFields): Version {
  const specs = Object.fromEntries(specRows.map(([key]) => [key, filled(fields.specs[key])])) as Record<SpecKey, string | null>;
  return { pill: fields.pill.trim(), tab: fields.tab.trim(), role: copyOf(fields.role), specs };
}

/** The versions as stored; null while no version, or more than one, is highlighted. */
function versionsOf(fields: VersionsFields): Versions | null {
  const at = fields.items.findIndex((v) => v.highlighted);
  if (at === -1 || fields.items.filter((v) => v.highlighted).length > 1) return null;
  const items = fields.items.map(versionOf);
  return { title: fields.title.trim(), note: copyOf(fields.note), before: items.slice(0, at), highlighted: items[at], after: items.slice(at + 1) };
}

/** Highlights the version at `index`, and only it. */
export function highlightVersion(fields: VersionsFields, index: number): VersionsFields {
  return { ...fields, items: fields.items.map((v, i) => ({ ...v, highlighted: i === index })) };
}

export const VERSION_KEEPS_HIGHLIGHT = "This is the highlighted version. Highlight another version before you remove it.";

/** Removes a version, or refuses: the highlighted one stays, so the page always has one. */
export function removeVersion(fields: VersionsFields, index: number): WriteResult<VersionsFields> {
  if (fields.items[index]?.highlighted) return refused(VERSION_KEEPS_HIGHLIGHT);
  return written({ ...fields, items: fields.items.filter((_, i) => i !== index) });
}

// Launch history

/** One of a launch card's four numbers; the phone card shows `phoneLabel` where there is one. */
export type NumberFields = { readonly value: string; readonly label: string; readonly phoneLabel: string };

export type LaunchNumbers = readonly [NumberFields, NumberFields, NumberFields, NumberFields];

/** Which number the phone card leaves out: it keeps three. */
export type PhoneDrop = 0 | 1 | 2 | 3;

/**
 * One launch card. On a flight, the first two numbers are its apogee and max
 * speed: their labels are fixed, the phone keeps both, and /projects reads
 * them with the country. A launch that did not fly gives all four.
 */
export type LaunchFields = {
  readonly title: string;
  readonly date: string;
  readonly place: CopyFields;
  readonly version: string;
  readonly motor: string;
  readonly outcome: Outcome;
  /** What happened: the desktop text and the phone card's shorter one. */
  readonly summary: { readonly text: string; readonly phone: string };
  readonly numbers: LaunchNumbers;
  readonly phoneDrops: PhoneDrop;
  /** The /projects log's place and result, and the country the header counts. */
  readonly where: string;
  readonly result: string;
  readonly country: string;
  /** No award while its name is empty. */
  readonly award: { readonly name: string; readonly short: string; readonly citation: string };
  readonly photos: readonly LaunchPhoto[];
};

export type LaunchesFields = Switched<{ readonly title: string; readonly items: readonly LaunchFields[] }>;

/** A launch card holds two photos at most: the page draws two slots beside it. */
export const LAUNCH_PHOTOS_MAX = 2;

/** A flight's first two numbers, as the page labels them. */
export const FLIGHT_LABELS = ["APOGEE", "MAX SPEED"] as const;

export const isFlight = (outcome: Outcome) => outcome !== "did-not-fly";

const blankNumber = (label = ""): NumberFields => ({ value: "", label, phoneLabel: "" });

export const blankLaunch = (): LaunchFields => ({
  title: "",
  date: "",
  place: { text: "", phone: "" },
  version: "",
  motor: "",
  outcome: "nominal",
  summary: { text: "", phone: "" },
  numbers: [blankNumber(FLIGHT_LABELS[0]), blankNumber(FLIGHT_LABELS[1]), blankNumber(), blankNumber()],
  phoneDrops: 3,
  where: "",
  result: "",
  country: "",
  award: { name: "", short: "", citation: "" },
  photos: [],
});

const numberOf = (stat: PageStat): NumberFields => ({ value: stat.value, label: stat.label, phoneLabel: stat.phoneLabel ?? "" });

function launchFields(launch: StoredLaunch): LaunchFields {
  const base = {
    title: launch.title,
    date: launch.date,
    place: copyFields(launch.place),
    version: launch.version,
    motor: launch.motor,
    outcome: launch.outcome,
    summary: { text: launch.summary.text, phone: launch.summary.phone },
    where: launch.where,
    result: launch.result,
    award: { name: launch.award?.name ?? "", short: launch.award?.short ?? "", citation: launch.award?.citation ?? "" },
    photos: launch.photos ?? [],
  };
  if (launch.outcome === "did-not-fly") {
    const [a, b, c, d] = launch.stats;
    return { ...base, numbers: [numberOf(a), numberOf(b), numberOf(c), numberOf(d)], phoneDrops: launch.phoneDrops, country: "" };
  }
  const [c, d] = launch.stats;
  return {
    ...base,
    numbers: [
      { ...blankNumber(FLIGHT_LABELS[0]), value: launch.flight.apogee },
      { ...blankNumber(FLIGHT_LABELS[1]), value: launch.flight.maxSpeed },
      numberOf(c),
      numberOf(d),
    ],
    // The phone keeps apogee, max speed and one of the other two.
    phoneDrops: launch.phoneStat === 0 ? 3 : 2,
    country: launch.flight.country,
  };
}

function launchesFields(history: LaunchHistory | undefined): LaunchesFields {
  if (history === undefined) return { shown: false, title: "", items: [blankLaunch()] };
  return { shown: true, title: history.title, items: history.entries.map(launchFields) };
}

const statOf = (n: NumberFields): PageStat => {
  const phoneLabel = filled(n.phoneLabel);
  return { value: n.value.trim(), label: n.label.trim(), ...(phoneLabel !== null && { phoneLabel }) };
};

function awardOf(fields: LaunchFields["award"]): Award | null {
  const name = filled(fields.name);
  if (name === null) return null;
  const short = filled(fields.short);
  const citation = filled(fields.citation);
  return { name, ...(short !== null && { short }), ...(citation !== null && { citation }) };
}

function photosOf(photos: readonly LaunchPhoto[]): LaunchPhotos | null {
  const trimmed = photos.map((p) => ({ src: p.src, alt: p.alt.trim() }));
  if (trimmed.length === 1) return [trimmed[0]];
  if (trimmed.length === 2) return [trimmed[0], trimmed[1]];
  return null;
}

/** The launch as stored. A flight's phone may leave out only its third or fourth number. */
export function launchOf(fields: LaunchFields): StoredLaunch {
  const award = awardOf(fields.award);
  const photos = photosOf(fields.photos);
  const base = {
    date: fields.date.trim(),
    where: fields.where.trim(),
    result: fields.result.trim(),
    ...(award !== null && { award }),
    title: fields.title.trim(),
    place: copyOf(fields.place),
    version: fields.version.trim(),
    motor: fields.motor.trim(),
    summary: { text: fields.summary.text.trim(), phone: fields.summary.phone.trim() },
    ...(photos !== null && { photos }),
  };
  const [a, b, c, d] = fields.numbers;
  if (fields.outcome === "did-not-fly") {
    return { ...base, outcome: "did-not-fly", stats: [statOf(a), statOf(b), statOf(c), statOf(d)], phoneDrops: fields.phoneDrops };
  }
  return {
    ...base,
    outcome: fields.outcome,
    flight: { apogee: a.value.trim(), maxSpeed: b.value.trim(), country: fields.country.trim() },
    stats: [statOf(c), statOf(d)],
    phoneStat: fields.phoneDrops === 2 ? 1 : 0,
  };
}

/** The history as stored; null while it holds no launch. */
function launchHistoryOf(fields: LaunchesFields): LaunchHistory | null {
  if (fields.items.length === 0) return null;
  const [first, ...rest] = fields.items.map(launchOf);
  return { title: fields.title.trim(), entries: [first, ...rest] };
}

/**
 * A launch with a new outcome. A flight's phone keeps its apogee and max
 * speed, so turning a launch into a flight moves the phone's left-out number
 * to the fourth when it was one of the first two, and gives those two their
 * fixed labels.
 */
export function setOutcome(launch: LaunchFields, outcome: Outcome): LaunchFields {
  if (!isFlight(outcome)) return { ...launch, outcome };
  const [a, b, c, d] = launch.numbers;
  return {
    ...launch,
    outcome,
    numbers: [{ ...a, label: FLIGHT_LABELS[0] }, { ...b, label: FLIGHT_LABELS[1] }, c, d],
    phoneDrops: launch.phoneDrops < 2 ? 3 : launch.phoneDrops,
  };
}

export const HISTORY_KEEPS_A_LAUNCH = "A launch history on the page keeps one launch at least. Switch Launch history off to take it off the page.";

/**
 * A row the panel removed: the section's fields without it, and the uploaded
 * photos it held. The panel cannot put those back on the page, so their files
 * go unless a stored version of a project shows them (the editor's `discardPhoto`).
 */
export type Removal<F> = { readonly fields: F; readonly letGo: readonly string[] };

/** Removes a launch, or refuses: a launch history on the page keeps one. Its photos are let go. */
export function removeLaunch(fields: LaunchesFields, index: number): WriteResult<Removal<LaunchesFields>> {
  if (fields.shown && fields.items.length <= 1) return refused(HISTORY_KEEPS_A_LAUNCH);
  return written({
    fields: { ...fields, items: fields.items.filter((_, i) => i !== index) },
    letGo: (fields.items[index]?.photos ?? []).map((p) => p.src),
  });
}

// Plan

export type StepFields = { readonly status: PlanStatus; readonly date: string; readonly title: string; readonly text: CopyFields };

export type PlanFields = Switched<{ readonly title: string; readonly intro: CopyFields; readonly steps: readonly StepFields[] }>;

export const PLAN_STATUSES: readonly PlanStatus[] = ["done", "now", "next", "later"];

export const blankStep = (status: PlanStatus = "next"): StepFields => ({ status, date: "", title: "", text: { text: "", phone: "" } });

function planFields(plan: Plan | undefined): PlanFields {
  if (plan === undefined) return { shown: false, title: "", intro: { text: "", phone: "" }, steps: [blankStep("now")] };
  return {
    shown: true,
    title: titleText(plan.title),
    intro: copyFields(plan.intro),
    steps: planSteps(plan).map((s) => ({ status: s.status, date: s.date ?? "", title: s.title, text: copyFields(s.text) })),
  };
}

function stepOf(fields: StepFields): PlanStep {
  const date = filled(fields.date);
  return { ...(date !== null && { date }), title: fields.title.trim(), text: copyOf(fields.text) };
}

/** The plan as stored: its steps in status order, each status keeping the panel's order. Null unless exactly one step is under way. */
function planOf(fields: PlanFields): Plan | null {
  const of = (status: PlanStatus) => fields.steps.filter((s) => s.status === status).map(stepOf);
  const [now, ...more] = of("now");
  if (now === undefined || more.length > 0) return null;
  return { title: titleOf(fields.title), intro: copyOf(fields.intro), done: of("done"), now, next: of("next"), later: of("later") };
}

export const PLAN_KEEPS_A_STEP_UNDER_WAY = "One plan step is always under way. Mark another step under way first.";

/**
 * A step's new status, or a refusal. Marking a step under way marks the one
 * that was under way done, so one step stays under way; the step under way
 * cannot be given another status itself.
 */
export function setStepStatus(fields: PlanFields, index: number, status: PlanStatus): WriteResult<PlanFields> {
  const step = fields.steps[index];
  if (step === undefined || step.status === status) return written(fields);
  if (step.status === "now") return refused(PLAN_KEEPS_A_STEP_UNDER_WAY);
  return written({
    ...fields,
    steps: fields.steps.map((s, i) => (i === index ? { ...s, status } : status === "now" && s.status === "now" ? { ...s, status: "done" } : s)),
  });
}

/** Removes a step, or refuses: the step under way stays. */
export function removeStep(fields: PlanFields, index: number): WriteResult<PlanFields> {
  if (fields.steps[index]?.status === "now") return refused(PLAN_KEEPS_A_STEP_UNDER_WAY);
  return written({ ...fields, steps: fields.steps.filter((_, i) => i !== index) });
}

// Gallery

/** One slot of the carousel: an uploaded photo, or a placeholder (`src` null) until one is uploaded. */
export type GalleryItemFields = { readonly src: string | null; readonly alt: string; readonly caption: string };

export type GalleryFields = Switched<{ readonly title: string; readonly items: readonly GalleryItemFields[] }>;

function galleryFields(gallery: GallerySection | undefined): GalleryFields {
  if (gallery === undefined) return { shown: false, title: "", items: [] };
  return {
    shown: true,
    title: gallery.title,
    items: gallery.items.map((item) => ({ src: "src" in item ? item.src : null, alt: item.alt, caption: item.caption ?? "" })),
  };
}

function galleryItemOf(fields: GalleryItemFields): GalleryItem {
  const caption = filled(fields.caption);
  const rest = { alt: fields.alt.trim(), ...(caption !== null && { caption }) };
  return fields.src === null ? { placeholder: true, ...rest } : { src: fields.src, ...rest };
}

/** The gallery as stored; null while it holds nothing. */
function galleryOf(fields: GalleryFields): GallerySection | null {
  if (fields.items.length === 0) return null;
  const [first, ...rest] = fields.items.map(galleryItemOf);
  return { title: fields.title.trim(), items: [first, ...rest] };
}

export const GALLERY_KEEPS_A_PHOTO = "A gallery on the page keeps one photo at least. Switch Gallery off to take it off the page.";

/** Removes a photo, or refuses: a gallery on the page keeps one. Its uploaded file is let go. */
export function removeGalleryItem(fields: GalleryFields, index: number): WriteResult<Removal<GalleryFields>> {
  if (fields.shown && fields.items.length <= 1) return refused(GALLERY_KEEPS_A_PHOTO);
  const src = fields.items[index]?.src ?? null;
  return written({ fields: { ...fields, items: fields.items.filter((_, i) => i !== index) }, letGo: src === null ? [] : [src] });
}

// The four sections together

export type ListFields = {
  readonly versions: VersionsFields;
  /** Only a rocket has a launch history; an engine's stays off and is never shown. */
  readonly launches: LaunchesFields;
  readonly plan: PlanFields;
  readonly gallery: GalleryFields;
};

export function listFieldsOf(record: ProjectRecord): ListFields {
  return {
    versions: versionsFields(record.versions),
    launches: launchesFields(record.kind === "vehicle" ? record.launches : undefined),
    plan: planFields(record.plan),
    gallery: galleryFields(record.gallery),
  };
}

/**
 * The record with the list sections laid over it, as the page draws it while
 * the editor types. A section switched off leaves the record. One switched on
 * whose shape rule is broken for the moment (only a hand-made request can
 * break it) keeps the version the panel opened on.
 */
export function withListFields(record: ProjectRecord, fields: ListFields, opened: ProjectRecord): ProjectRecord {
  const { versions: _v, plan: _p, gallery: _g, ...rest } = record;
  const versions = fields.versions.shown ? (versionsOf(fields.versions) ?? opened.versions) : undefined;
  const plan = fields.plan.shown ? (planOf(fields.plan) ?? opened.plan) : undefined;
  const gallery = fields.gallery.shown ? (galleryOf(fields.gallery) ?? opened.gallery) : undefined;
  const sections = { ...(versions && { versions }), ...(plan && { plan }), ...(gallery && { gallery }) };
  if (rest.kind === "engine") return { ...rest, ...sections };
  const { launches: _l, ...vehicle } = rest;
  const launches = fields.launches.shown ? (launchHistoryOf(fields.launches) ?? (opened.kind === "vehicle" ? opened.launches : undefined)) : undefined;
  return { ...vehicle, ...sections, ...(launches && { launches }) };
}

/** The list fields after a save: `stored`'s, with the text of each section switched off kept from what was sent. */
export function listFieldsAfterSave(stored: ProjectRecord, sent: ListFields): ListFields {
  const fields = listFieldsOf(stored);
  return {
    versions: sent.versions.shown ? fields.versions : sent.versions,
    launches: sent.launches.shown ? fields.launches : sent.launches,
    plan: sent.plan.shown ? fields.plan : sent.plan,
    gallery: sent.gallery.shown ? fields.gallery : sent.gallery,
  };
}

/** One field of a list section that cannot be saved as it is. */
export type ListProblem = { readonly section: ListSection; readonly field: string; readonly error: string };

/** What a save needs first in the list sections, in panel order. A section switched off never stops a save. */
export function listProblems(fields: ListFields): ListProblem[] {
  const problems: ListProblem[] = [];
  const at = (section: ListSection) => ({
    need(field: string, value: string, what: string) {
      if (value.trim() === "") problems.push({ section, field, error: `Fill in ${what}.` });
    },
    refuse(field: string, error: string) {
      problems.push({ section, field, error });
    },
  });

  const { versions, launches, plan, gallery } = fields;
  if (versions.shown) {
    const v = at("versions");
    v.need("versions.title", versions.title, "the versions title");
    v.need("versions.note", versions.note.text, "the note under the versions");
    if (versions.items.filter((x) => x.highlighted).length !== 1) v.refuse("versions.items", "Highlight one version.");
    versions.items.forEach((x, i) => {
      v.need(`versions.items.${i}.pill`, x.pill, `version ${i + 1}'s name`);
      v.need(`versions.items.${i}.tab`, x.tab, `version ${i + 1}'s phone tab`);
      v.need(`versions.items.${i}.role`, x.role.text, `what version ${i + 1} was for`);
    });
  }

  // An engine's launch history is never switched on by the panel; one a request switches on is checked all the same.
  if (launches.shown) {
    const l = at("launches");
    l.need("launches.title", launches.title, "the launch history title");
    if (launches.items.length === 0) l.refuse("launches.items", HISTORY_KEEPS_A_LAUNCH);
    launches.items.forEach((x, i) => {
      const p = `launches.items.${i}`;
      const n = `launch ${i + 1}'s`;
      l.need(`${p}.title`, x.title, `${n} name`);
      l.need(`${p}.date`, x.date, `${n} date`);
      l.need(`${p}.place`, x.place.text, `${n} place`);
      l.need(`${p}.version`, x.version, `${n} version`);
      l.need(`${p}.motor`, x.motor, `${n} motor`);
      l.need(`${p}.summary`, x.summary.text, `what happened at launch ${i + 1}`);
      l.need(`${p}.summaryPhone`, x.summary.phone, `what happened at launch ${i + 1}, for phones`);
      x.numbers.forEach((num, j) => {
        l.need(`${p}.numbers.${j}.value`, num.value, `${n} number ${j + 1}`);
        if (!isFlight(x.outcome) || j > 1) l.need(`${p}.numbers.${j}.label`, num.label, `the label of ${n} number ${j + 1}`);
      });
      if (isFlight(x.outcome)) {
        l.need(`${p}.country`, x.country, `the country launch ${i + 1} flew in`);
        if (x.phoneDrops < 2) l.refuse(`${p}.phoneDrops`, `On a flight the phone keeps apogee and max speed: leave out number 3 or 4 of launch ${i + 1}.`);
      }
      l.need(`${p}.where`, x.where, `where launch ${i + 1} reads on /projects`);
      l.need(`${p}.result`, x.result, `launch ${i + 1}'s result on /projects`);
      if (x.photos.length > LAUNCH_PHOTOS_MAX) l.refuse(`${p}.photos`, `Keep ${LAUNCH_PHOTOS_MAX} photos at most on launch ${i + 1}.`);
      x.photos.forEach((photo, j) => l.need(`${p}.photos.${j}`, photo.alt, `a description of launch ${i + 1}'s photo ${j + 1}`));
    });
  }

  if (plan.shown) {
    const s = at("plan");
    s.need("plan.title", plan.title, "the plan title");
    s.need("plan.intro", plan.intro.text, "the plan intro");
    if (plan.steps.filter((x) => x.status === "now").length !== 1) s.refuse("plan.steps", "Mark one plan step under way.");
    plan.steps.forEach((x, i) => {
      s.need(`plan.steps.${i}.title`, x.title, `step ${i + 1}'s title`);
      s.need(`plan.steps.${i}.text`, x.text.text, `step ${i + 1}'s text`);
    });
  }

  if (gallery.shown) {
    const g = at("gallery");
    g.need("gallery.title", gallery.title, "the gallery title");
    if (gallery.items.length === 0) g.refuse("gallery.items", GALLERY_KEEPS_A_PHOTO);
    gallery.items.forEach((x, i) => g.need(`gallery.items.${i}.alt`, x.alt, `a description of photo ${i + 1}`));
  }
  return problems;
}

/** Every uploaded photo the list sections show, as their `src`: what a save must have uploaded or already had. */
export function listPhotos(record: ProjectRecord): string[] {
  const launches = record.kind === "vehicle" ? (record.launches?.entries ?? []) : [];
  const gallery = record.gallery?.items ?? [];
  return [...launches.flatMap((l) => (l.photos ?? []).map((p) => p.src)), ...gallery.flatMap((item) => ("src" in item ? [item.src] : []))];
}

/**
 * Every uploaded photo the panel holds, a section switched off included:
 * switching it back on puts them on the page again, so no save may delete
 * their files while the panel holds them.
 */
export function heldPhotos(fields: ListFields): string[] {
  return [
    ...fields.launches.items.flatMap((l) => l.photos.map((p) => p.src)),
    ...fields.gallery.items.flatMap((item) => (item.src === null ? [] : [item.src])),
  ];
}

// What the browser sent, read back field by field.

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const strings = <K extends string>(v: unknown, keys: readonly K[]): Record<K, string> | null =>
  isObject(v) && keys.every((k) => isString(v[k])) ? (Object.fromEntries(keys.map((k) => [k, v[k]])) as Record<K, string>) : null;
const listOf = <T>(v: unknown, read: (x: unknown) => T | null): T[] | null => {
  if (!Array.isArray(v) || v.length > 50) return null;
  const items = v.map(read);
  return items.every((x) => x !== null) ? (items as T[]) : null;
};
const readCopy = (v: unknown): CopyFields | null => strings(v, ["text", "phone"]);
const switched = <T>(v: unknown, read: (v: Loose) => T | null): Switched<T> | null => {
  if (!isObject(v) || typeof v.shown !== "boolean") return null;
  const rest = read(v);
  return rest === null ? null : { ...rest, shown: v.shown };
};
const OUTCOMES: readonly Outcome[] = ["nominal", "recovery-failed", "did-not-fly"];
const SPEC_KEYS = specRows.map(([key]) => key);

function readVersion(v: unknown): VersionFields | null {
  const text = strings(v, ["pill", "tab"]);
  const role = isObject(v) ? readCopy(v.role) : null;
  const specs = isObject(v) ? strings(v.specs, SPEC_KEYS) : null;
  if (text === null || role === null || specs === null || !isObject(v) || typeof v.highlighted !== "boolean") return null;
  return { ...text, role, specs, highlighted: v.highlighted };
}

function readLaunch(v: unknown): LaunchFields | null {
  const text = strings(v, ["title", "date", "version", "motor", "where", "result", "country"]);
  if (text === null || !isObject(v)) return null;
  const place = readCopy(v.place);
  const summary = readCopy(v.summary);
  const award = strings(v.award, ["name", "short", "citation"]);
  const numbers = listOf(v.numbers, (n) => strings(n, ["value", "label", "phoneLabel"]));
  const photos = listOf(v.photos, (p): LaunchPhoto | null => {
    const photo = strings(p, ["src", "alt"]);
    return photo !== null && isPhotoSrc(photo.src) ? { src: photo.src, alt: photo.alt } : null;
  });
  const outcome = OUTCOMES.find((o) => o === v.outcome);
  const phoneDrops = ([0, 1, 2, 3] as const).find((d) => d === v.phoneDrops);
  if (place === null || summary === null || award === null || numbers?.length !== 4 || photos === null || outcome === undefined || phoneDrops === undefined) {
    return null;
  }
  return { ...text, place, summary, award, outcome, phoneDrops, photos, numbers: [numbers[0], numbers[1], numbers[2], numbers[3]] };
}

function readStep(v: unknown): StepFields | null {
  const text = strings(v, ["date", "title"]);
  const copy = isObject(v) ? readCopy(v.text) : null;
  const status = isObject(v) ? PLAN_STATUSES.find((s) => s === v.status) : undefined;
  return text === null || copy === null || status === undefined ? null : { ...text, text: copy, status };
}

function readGalleryItem(v: unknown): GalleryItemFields | null {
  const text = strings(v, ["alt", "caption"]);
  if (text === null || !isObject(v) || !(v.src === null || isString(v.src))) return null;
  return { ...text, src: v.src };
}

/** The list sections a request carries, or null when it does not carry them in this shape. */
export function readListFields(input: Loose): ListFields | null {
  const versions = switched(input.versions, (v) => {
    const title = strings(v, ["title"]);
    const note = readCopy(v.note);
    const items = listOf(v.items, readVersion);
    return title === null || note === null || items === null ? null : { ...title, note, items };
  });
  const launches = switched(input.launches, (v) => {
    const title = strings(v, ["title"]);
    const items = listOf(v.items, readLaunch);
    return title === null || items === null ? null : { ...title, items };
  });
  const plan = switched(input.plan, (v) => {
    const title = strings(v, ["title"]);
    const intro = readCopy(v.intro);
    const steps = listOf(v.steps, readStep);
    return title === null || intro === null || steps === null ? null : { ...title, intro, steps };
  });
  const gallery = switched(input.gallery, (v) => {
    const title = strings(v, ["title"]);
    const items = listOf(v.items, readGalleryItem);
    return title === null || items === null ? null : { ...title, items };
  });
  if (versions === null || launches === null || plan === null || gallery === null) return null;
  return { versions, launches, plan, gallery };
}
