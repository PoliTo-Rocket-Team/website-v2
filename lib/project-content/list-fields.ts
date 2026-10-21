import type { GalleryItem } from "@/components/gallery/items";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import {
  blankGallery,
  GALLERY_KEEPS_A_PHOTO,
  galleryProblems,
  readGalleryFields,
  removeGalleryItem,
  type GalleryFields,
  type GalleryItemFields,
} from "@/lib/gallery-fields";
import { isPhotoSrc } from "@/lib/outreach-photos";
import { planSteps, versionList, type PlanStatus } from "@/lib/project-pages";
import {
  specRows,
  type GallerySection,
  type LaunchPhoto,
  type Outcome,
  type Plan,
  type PlanStep,
  type SpecKey,
  type Version,
  type Versions,
} from "@/lib/project-pages/types";
import type { Award } from "@/lib/projects";
import { copyFields, copyOf, filled, titleOf, titleText, type CopyFields } from "./copy-fields";
import type { LaunchesBlock, PageStat, ProjectRecord, StoredLaunch } from "./record";

// The list blocks of the Edit <project> panel (board 75c, issue #299; page
// blocks since epic #522): Versions, Launch history, Timeline and Gallery,
// as the text an editor types. Each keeps a rule its stored shape holds: one
// version highlighted, a launch at least in a launch history, one step under
// way, a photo at least in a gallery. An edit that would break one is refused
// with a message (the `remove…` and `set…` edits below), and a save checks
// them again (the `…Problems` reads), since a request can carry any fields.
// The fields a block needs filled in are checked only while it is on the
// page: a hidden block is stored as it is (./block-fields.ts).

/** One field of a list block that cannot be saved as it is: its path in the block ("versions.items.0.pill") and why. */
export type ListProblem = { readonly field: string; readonly error: string };

/** Collects a block's problems: a blank needs filling in only while the block is on the page; a broken rule always stops a save. */
function problems(shown: boolean) {
  const found: ListProblem[] = [];
  return {
    found,
    need(field: string, value: string, what: string) {
      if (shown && value.trim() === "") found.push({ field, error: `Fill in ${what}.` });
    },
    refuse(field: string, error: string) {
      found.push({ field, error });
    },
  };
}

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

export type VersionsFields = { readonly title: string; readonly note: CopyFields; readonly items: readonly VersionFields[] };

const blankSpecs = (): Record<SpecKey, string> => Object.fromEntries(specRows.map(([key]) => [key, ""])) as Record<SpecKey, string>;

export const blankVersion = (): VersionFields => ({ pill: "", tab: "", role: { text: "", phone: "" }, specs: blankSpecs(), highlighted: false });

/** A new Versions block: one version, highlighted, as the table always has. */
export const blankVersions = (): VersionsFields => ({ title: "", note: { text: "", phone: "" }, items: [{ ...blankVersion(), highlighted: true }] });

function versionFields(version: Version, highlighted: boolean): VersionFields {
  const specs = Object.fromEntries(specRows.map(([key]) => [key, version.specs[key] ?? ""])) as Record<SpecKey, string>;
  return { pill: version.pill, tab: version.tab, role: copyFields(version.role), specs, highlighted };
}

export function versionsFields(versions: Versions): VersionsFields {
  return {
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
export function versionsOf(fields: VersionsFields): Versions | null {
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

export function versionsProblems(versions: VersionsFields, shown: boolean): ListProblem[] {
  const v = problems(shown);
  v.need("versions.title", versions.title, "the versions title");
  v.need("versions.note", versions.note.text, "the note under the versions");
  if (versions.items.filter((x) => x.highlighted).length !== 1) v.refuse("versions.items", "Highlight one version.");
  versions.items.forEach((x, i) => {
    v.need(`versions.items.${i}.pill`, x.pill, `version ${i + 1}'s name`);
    v.need(`versions.items.${i}.tab`, x.tab, `version ${i + 1}'s phone tab`);
    v.need(`versions.items.${i}.role`, x.role.text, `what version ${i + 1} was for`);
  });
  return v.found;
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
  /** Its cover photo, when it has one. */
  readonly photos: readonly LaunchPhoto[];
};

export type LaunchesFields = { readonly title: string; readonly items: readonly LaunchFields[] };

/** The launch history a launches block holds: a title and its launches, in date order. */
type LaunchHistory = Pick<LaunchesBlock, "title" | "entries">;

/** A launch card holds one cover photo (Owner decision on #522). */
export const LAUNCH_PHOTOS_MAX = 1;

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

/** A new Launch history block: one launch card to fill in, as a history always has. */
export const blankLaunches = (): LaunchesFields => ({ title: "", items: [blankLaunch()] });

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
    photos: launch.cover ? [launch.cover] : [],
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

export function launchesFields(history: LaunchHistory): LaunchesFields {
  return { title: history.title, items: history.entries.map(launchFields) };
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

/** The launch as stored. A flight's phone may leave out only its third or fourth number. */
export function launchOf(fields: LaunchFields): StoredLaunch {
  const award = awardOf(fields.award);
  const [first] = fields.photos;
  const cover = first === undefined ? null : { src: first.src, alt: first.alt.trim() };
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
    ...(cover !== null && { cover }),
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
export function historyOf(fields: LaunchesFields): LaunchHistory | null {
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

export const HISTORY_KEEPS_A_LAUNCH = "A launch history keeps one launch at least. Remove the block to take it off the page.";

/**
 * A row the panel removed: the block's fields without it, and the uploaded
 * photos it held. The panel cannot put those back on the page, so their files
 * go unless a stored version of a project shows them (the editor's `discardPhoto`).
 */
export type Removal<F> = { readonly fields: F; readonly letGo: readonly string[] };

/** Removes a launch, or refuses: a launch history keeps one. Its photos are let go. */
export function removeLaunch(fields: LaunchesFields, index: number): WriteResult<Removal<LaunchesFields>> {
  if (fields.items.length <= 1) return refused(HISTORY_KEEPS_A_LAUNCH);
  return written({
    fields: { ...fields, items: fields.items.filter((_, i) => i !== index) },
    letGo: (fields.items[index]?.photos ?? []).map((p) => p.src),
  });
}

export function launchesProblems(launches: LaunchesFields, shown: boolean): ListProblem[] {
  const l = problems(shown);
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
    // A photo's description is optional (Owner decision, issue #430).
    if (x.photos.length > LAUNCH_PHOTOS_MAX) l.refuse(`${p}.photos`, `Keep ${LAUNCH_PHOTOS_MAX} photo at most on launch ${i + 1}.`);
  });
  return l.found;
}

// Timeline

export type StepFields = { readonly status: PlanStatus; readonly date: string; readonly title: string; readonly text: CopyFields };

export type PlanFields = { readonly title: string; readonly intro: CopyFields; readonly steps: readonly StepFields[] };

export const PLAN_STATUSES: readonly PlanStatus[] = ["done", "now", "next", "later"];

export const blankStep = (status: PlanStatus = "next"): StepFields => ({ status, date: "", title: "", text: { text: "", phone: "" } });

/** A new Timeline block: one step, under way, as a timeline always has. */
export const blankPlan = (): PlanFields => ({ title: "", intro: { text: "", phone: "" }, steps: [blankStep("now")] });

export function planFields(plan: Plan): PlanFields {
  return {
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
export function planOf(fields: PlanFields): Plan | null {
  const of = (status: PlanStatus) => fields.steps.filter((s) => s.status === status).map(stepOf);
  const [now, ...more] = of("now");
  if (now === undefined || more.length > 0) return null;
  return { title: titleOf(fields.title), intro: copyOf(fields.intro), done: of("done"), now, next: of("next"), later: of("later") };
}

export const PLAN_KEEPS_A_STEP_UNDER_WAY = "One step is always under way. Mark another step under way first.";

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

export function planProblems(plan: PlanFields, shown: boolean): ListProblem[] {
  const s = problems(shown);
  s.need("plan.title", plan.title, "the timeline title");
  s.need("plan.intro", plan.intro.text, "the timeline intro");
  if (plan.steps.filter((x) => x.status === "now").length !== 1) s.refuse("plan.steps", "Mark one step under way.");
  plan.steps.forEach((x, i) => {
    s.need(`plan.steps.${i}.title`, x.title, `step ${i + 1}'s title`);
    s.need(`plan.steps.${i}.text`, x.text.text, `step ${i + 1}'s text`);
  });
  return s.found;
}

// Gallery: its fields and rules are shared with the Outreach post panel (lib/gallery-fields.ts).

export { blankGallery, GALLERY_KEEPS_A_PHOTO, galleryProblems, removeGalleryItem, type GalleryFields, type GalleryItemFields };

export function galleryFields(gallery: GallerySection): GalleryFields {
  return {
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
export function galleryOf(fields: GalleryFields): GallerySection | null {
  if (fields.items.length === 0) return null;
  const [first, ...rest] = fields.items.map(galleryItemOf);
  return { title: fields.title.trim(), items: [first, ...rest] };
}

/**
 * Every uploaded photo the record holds, as their `src`: what a save must
 * have uploaded or already had. A hidden block's photos count: showing it
 * again puts them back on the page.
 */
export function listPhotos(record: ProjectRecord): string[] {
  const visual = record.hero.visual.kind === "photo" ? [record.hero.visual.photo.src] : [];
  const blocks = record.blocks.flatMap((block): string[] => {
    switch (block.kind) {
      case "launches":
        return block.entries.flatMap((l) => (l.cover ? [l.cover.src] : []));
      case "gallery":
        return block.items.flatMap((item) => ("src" in item ? [item.src] : []));
      case "photo":
        return [block.photo.src];
      default:
        return [];
    }
  });
  return [...visual, ...blocks];
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

export function readVersionsFields(v: Loose): VersionsFields | null {
  const title = strings(v, ["title"]);
  const note = readCopy(v.note);
  const items = listOf(v.items, readVersion);
  return title === null || note === null || items === null ? null : { ...title, note, items };
}

export function readLaunchesFields(v: Loose): LaunchesFields | null {
  const title = strings(v, ["title"]);
  const items = listOf(v.items, readLaunch);
  return title === null || items === null ? null : { ...title, items };
}

export function readPlanFields(v: Loose): PlanFields | null {
  const title = strings(v, ["title"]);
  const intro = readCopy(v.intro);
  const steps = listOf(v.steps, readStep);
  return title === null || intro === null || steps === null ? null : { ...title, intro, steps };
}

export { readGalleryFields };
