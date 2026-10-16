import type {
  DesignStory,
  GallerySection,
  Hero,
  LaunchLog,
  LogEntry,
  NameStory,
  Plan,
  ProjectPageRecord,
  Reasons,
  Stat,
  Versions,
} from "@/lib/project-pages/types";
import { isPageSlug, type Award, type Copy, type Launch, type Project, type ProjectPage, type Spec, type WorkLine } from "@/lib/projects";
import { editorVersion, publicVersion, type ContentItem } from "@/lib/content/versioned";
import type { OwnRocketModel } from "@/lib/rocket-model";

// One project as the content store keeps it (issue #295): everything the
// project page, its /projects entry and its home card show, in one record
// with a published version and a working draft (lib/content/versioned.ts).
// Before the store each was typed by hand in its own file; now all three are
// read off this record, so a fact lives in one place. Each top-level key is
// one section an editor changes on its own. A section the page leaves out is
// an absent key, as in lib/project-pages/types.ts. A 3D rocket is code, not
// content: the record only names the model its card and its page draw
// (lib/rocket-model.ts), and a project with none draws the placeholder.

/** The home card (board 21): its own short copy, beside the project's name and texture. */
export type HomeCard = {
  year: Copy;
  status: string;
  /** IN DESIGN reads as a light pill; flown vehicles get a dark one. */
  statusTone: "dark" | "light";
  /** Subscript digits ("N₂O") are drawn lowered, as the card always set them. */
  desc: Copy;
  specs: readonly [Spec, Spec, Spec];
  /** A bright texture tints its info box darker (Efesto's). */
  infoTint?: number;
  /**
   * The rocket the card draws; with none it draws the shared placeholder
   * (lib/rocket-model.ts). All three cards draw Cavour, as board 21 does.
   */
  rocket?: OwnRocketModel;
};

/** What every /projects entry shows (board 22). */
type ListingBase = {
  years: string;
  description: Copy;
  /** Six specs, laid out 3 x 2. */
  specs: readonly [Spec, Spec, Spec, Spec, Spec, Spec];
};

export type VehicleListing = ListingBase & {
  /** The first version is the current one and reads highlighted. */
  versions: readonly string[];
  /** The phone accordion row, after "LAUNCH LOG · ". */
  logSummary: string;
};

export type EngineListing = ListingBase & { workLines: readonly WorkLine[]; milestone: string };

/** A number only the page's launch card shows; `phoneLabel` is the phone card's shorter label. */
export type PageStat = Stat & { phoneLabel?: string };

type LaunchBase = {
  date: string;
  /** The /projects log's place and result. */
  where: string;
  result: string;
  award?: Award;
  /** The page's launch card. */
  title: string;
  place: Copy;
  /** The version's pill, as the versions table names it. */
  version: string;
  motor: string;
  summary: Copy & { phone: string };
};

/**
 * A campaign that left the pad: its apogee and max speed are the card's
 * first two numbers, and it adds two of its own. A failed recovery is a
 * setback, which /projects reads in orange.
 */
export type FlownLaunch = LaunchBase & {
  outcome: "nominal" | "recovery-failed";
  flight: { apogee: string; maxSpeed: string; /** For the /projects country count. */ country: string };
  stats: readonly [PageStat, PageStat];
  /** Which of the two the phone card keeps. */
  phoneStat: 0 | 1;
};

/** A campaign that never left the pad: no flight numbers, so it gives all four itself. */
export type GroundedLaunch = LaunchBase & {
  outcome: "did-not-fly";
  stats: readonly [PageStat, PageStat, PageStat, PageStat];
  /** The one the phone card leaves out. */
  phoneDrops: 0 | 1 | 2 | 3;
};

export type StoredLaunch = FlownLaunch | GroundedLaunch;

/** The launch history: the page's section and the /projects log, one list in date order. */
export type LaunchHistory = { title: string; entries: readonly [StoredLaunch, ...StoredLaunch[]] };

type RecordBase = {
  /** Its address, /projects/<slug>. */
  slug: string;
  name: string;
  /** The brand texture behind its card and its page. */
  texture: string;
  card: HomeCard;
  /** The page's meta description. */
  description: string;
  hero: Hero;
  nameStory: NameStory;
  design: DesignStory;
  versions?: Versions;
  plan?: Plan;
  reasons?: Reasons;
  gallery?: GallerySection;
  /** The one line the previous project's page shows on its next-project card. */
  teaser: string;
};

/** A rocket: versions and a launch history, and its status counts its flights. */
export type VehicleRecord = RecordBase & { kind: "vehicle"; listing: VehicleListing; launches?: LaunchHistory };

/** An engine in development: work lines and a milestone in place of a launch history. */
export type EngineRecord = RecordBase & { kind: "engine"; listing: EngineListing };

export type ProjectRecord = VehicleRecord | EngineRecord;

/** The record's sections: what an editor changes one at a time, and what a preview keeps per change. */
export type ProjectSection = keyof VehicleRecord;

export const PROJECT_SECTIONS = [
  "kind",
  "slug",
  "name",
  "texture",
  "listing",
  "card",
  "description",
  "hero",
  "nameStory",
  "design",
  "versions",
  "launches",
  "plan",
  "reasons",
  "gallery",
  "teaser",
] as const satisfies readonly ProjectSection[];

/** Sections the page may leave out: absent from the record, never empty. */
export const OPTIONAL_SECTIONS = ["versions", "launches", "plan", "reasons", "gallery"] as const satisfies readonly ProjectSection[];

const pad = (i: number) => String(i).padStart(2, "0");

/** The launches of a record, as /projects lists them; an engine has none. */
export function launchesOf(record: ProjectRecord): StoredLaunch[] {
  return record.kind === "vehicle" && record.launches ? [...record.launches.entries] : [];
}

/** One launch as the /projects log reads it. */
export function listedLaunch(launch: StoredLaunch): Launch {
  const flight =
    launch.outcome === "did-not-fly"
      ? null
      : { apogee: launch.flight.apogee, maxSpeed: launch.flight.maxSpeed, nominal: launch.outcome === "nominal", country: launch.flight.country };
  return { date: launch.date, where: launch.where, flight, result: launch.result, ...(launch.award && { award: launch.award }) };
}

const phone = (s: PageStat): Stat => ({ value: s.value, label: s.phoneLabel ?? s.label });
const plain = (s: PageStat): Stat => ({ value: s.value, label: s.label });

/** One launch as the page's launch card draws it. */
export function logEntry(launch: StoredLaunch): LogEntry {
  const base = {
    date: launch.date,
    title: launch.title,
    place: launch.place,
    version: launch.version,
    motor: launch.motor,
    outcome: launch.outcome,
    summary: launch.summary,
    ...(launch.award && { award: launch.award }),
  };
  if (launch.outcome === "did-not-fly") {
    const [a, b, c, d] = launch.stats;
    const kept = launch.stats.filter((_, i) => i !== launch.phoneDrops).map(phone);
    return { ...base, stats: [plain(a), plain(b), plain(c), plain(d)], phoneStats: [kept[0], kept[1], kept[2]] };
  }
  const apogee = { value: launch.flight.apogee, label: "APOGEE" };
  const maxSpeed = { value: launch.flight.maxSpeed, label: "MAX SPEED" };
  const [e, f] = launch.stats;
  return {
    ...base,
    stats: [apogee, maxSpeed, plain(e), plain(f)],
    phoneStats: [apogee, maxSpeed, phone(launch.stats[launch.phoneStat])],
  };
}

function launchLogOf(history: LaunchHistory): LaunchLog {
  const [first, ...rest] = history.entries;
  return { title: history.title, entries: [logEntry(first), ...rest.map(logEntry)] };
}

/** The project page's record: every section the project has, in the shape components/project-page/ draws. */
export function pageRecordOf(record: ProjectRecord): ProjectPageRecord {
  const launches = record.kind === "vehicle" ? record.launches : undefined;
  return {
    description: record.description,
    hero: record.hero,
    name: record.nameStory,
    design: record.design,
    ...(record.versions && { versions: record.versions }),
    ...(launches && { launches: launchLogOf(launches) }),
    ...(record.plan && { plan: record.plan }),
    ...(record.reasons && { reasons: record.reasons }),
    ...(record.gallery && { gallery: record.gallery }),
    teaser: record.teaser,
  };
}

/** The project's page, when one is served for its slug: the card links there. */
export function pageOf(slug: string): ProjectPage | undefined {
  return isPageSlug(slug) ? `/projects/${slug}` : undefined;
}

/** The /projects entry of the project at `position` (from 0) in the site order: its number is its place. */
export function listingOf(record: ProjectRecord, position: number): Project {
  const href = pageOf(record.slug);
  const base = {
    slug: record.slug,
    ...(href && { href }),
    index: pad(position + 1),
    years: record.listing.years,
    name: record.name,
    description: record.listing.description,
    specs: record.listing.specs,
    texture: record.texture,
  };
  if (record.kind === "engine") {
    return { ...base, kind: "engine", workLines: record.listing.workLines, milestone: record.listing.milestone };
  }
  return {
    ...base,
    kind: "vehicle",
    versions: record.listing.versions,
    launches: launchesOf(record).map(listedLaunch),
    logSummary: record.listing.logSummary,
  };
}

/** The home card as the Projects section draws it: the card's copy with the project's number, name and texture. */
export type HomeCardView = HomeCard & { num: string; name: string; texture: string };

export function homeCardOf(record: ProjectRecord, position: number): HomeCardView {
  return { ...record.card, num: pad(position + 1), name: record.name, texture: record.texture };
}

/**
 * Where a stored project sits among the published ones, as its page draws
 * it: its number, the project its next-project card shows (the last loops
 * back to the first), and the project whose card shows it. A project not
 * published yet is counted at its place in the site order, as it will show
 * once published.
 */
export type ProjectPlace = {
  readonly position: number;
  readonly next: { readonly record: ProjectRecord; readonly position: number };
  readonly previous: ProjectRecord;
};

export function placeOf(items: readonly ContentItem<ProjectRecord>[], id: number): ProjectPlace | null {
  const item = items.find((i) => i.id === id);
  if (item === undefined) return null;
  const ordered = [...items].sort((a, b) => a.siteOrder - b.siteOrder);
  const shown = ordered.filter((i) => publicVersion(i.version) !== null || i.id === id);
  const position = shown.findIndex((i) => i.id === id);
  const at = (p: number) => {
    const found = shown[(p + shown.length) % shown.length];
    return found.id === id ? editorVersion(found.version) : publicVersion(found.version)!;
  };
  return { position, next: { record: at(position + 1), position: (position + 1) % shown.length }, previous: at(position - 1) };
}
