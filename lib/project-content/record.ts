import type {
  DesignStory,
  GallerySection,
  Hero,
  LaunchLog,
  LaunchPhotos,
  LogEntry,
  NameStory,
  Plan,
  ProjectPageRecord,
  Reasons,
  Stat,
  Versions,
} from "@/lib/project-pages/types";
import { type Award, type Copy, type Launch, type Project, type ProjectPage, type Spec, type WorkLine } from "@/lib/projects";
import { publicVersion, type ContentItem } from "@/lib/content/versioned";
import type { OwnModel, OwnRocketModel } from "@/lib/rocket-model";

// One project as the content store keeps it (issue #295): everything the
// project page, its /projects entry and its home card show, in one record
// with a published version and a working draft (lib/content/versioned.ts).
// Before the store each was typed by hand in its own file; now all three are
// read off this record, so a fact lives in one place. Each top-level key is
// one section an editor changes on its own. A section the page leaves out is
// an absent key, as in lib/project-pages/types.ts. A 3D rocket is code, not
// content: the record only names the model its card and its page draw
// (lib/rocket-model.ts), and a project with none draws the placeholder.

/**
 * The home card (board 21): its own short copy, beside the project's name and
 * texture. `M` narrows the models it may name: a rocket's card names a rocket.
 */
export type HomeCard<M extends OwnModel = OwnModel> = {
  year: Copy;
  /** The pill's text. */
  status: string;
  /** IN DESIGN reads as a light pill; flown vehicles get a dark one. */
  statusTone: "dark" | "light";
  /** Subscript digits ("N₂O") are drawn lowered, as the card always set them. */
  desc: Copy;
  specs: readonly [Spec, Spec, Spec];
  /** A bright texture tints its info box darker (Efesto's). */
  infoTint?: number;
  /**
   * The model the card draws; with none it draws the shared placeholder
   * (lib/rocket-model.ts). Board 21 draws Cavour on all three cards; VES
   * draws its own since it was built (issue #361), and Efesto its engine
   * (issue #382).
   */
  rocket?: M;
};

/**
 * A rocket's pill may count its flights instead of naming them: it then reads
 * "FLOWN ×<n>" off the published launch history, as /projects counts them, so
 * a launch published changes it (issue #299).
 */
export type FlightCount = { readonly count: "flights" };

/** A rocket's home card: its pill is text or its flight count. */
export type VehicleCard = Omit<HomeCard<OwnRocketModel>, "status"> & { status: string | FlightCount };

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
  /** Photos beside the page's launch card; absent until one is uploaded. */
  photos?: LaunchPhotos;
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
  /** The page's meta description. */
  description: string;
  hero: Hero;
  nameStory: NameStory;
  design: DesignStory;
  versions?: Versions;
  plan?: Plan;
  reasons?: Reasons;
  gallery?: GallerySection;
};

/**
 * A rocket: versions and a launch history, and its status counts its flights.
 * Its card draws a rocket only, never an engine; the stored record check
 * holds its page panel to the same (check.ts).
 */
export type VehicleRecord = RecordBase & { kind: "vehicle"; card: VehicleCard; listing: VehicleListing; launches?: LaunchHistory };

/**
 * An engine in development: work lines and a milestone in place of a launch
 * history. It may name a rocket model as well as an engine: the import drew
 * Cavour on Efesto's card, as board 21 did (migration 0037).
 */
export type EngineRecord = RecordBase & { kind: "engine"; card: HomeCard; listing: EngineListing };

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
    ...(launch.photos && { photos: launch.photos }),
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
  };
}

/** The project's page: every published project has one at its slug (issue #301). The card links there. */
export function pageOf(slug: string): ProjectPage {
  return `/projects/${slug}`;
}

/**
 * What /projects/<slug> draws, read off the published projects in site
 * order: the project and its place. Null for a slug no published project
 * has, a project with only a draft included: that address is not found.
 */
export type PublishedPage = { readonly record: ProjectRecord; readonly position: number };

export function publishedPageOf(published: readonly ProjectRecord[], slug: string): PublishedPage | null {
  const position = published.findIndex((r) => r.slug === slug);
  return position === -1 ? null : { record: published[position], position };
}

/** The /projects entry of the project at `position` (from 0) in the site order: its number is its place. */
export function listingOf(record: ProjectRecord, position: number): Project {
  const base = {
    slug: record.slug,
    href: pageOf(record.slug),
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
    ...(record.card.rocket && { rocket: record.card.rocket }),
    versions: record.listing.versions,
    launches: launchesOf(record).map(listedLaunch),
    logSummary: record.listing.logSummary,
  };
}

/** The home card as the Projects section draws it: the card's copy with the project's number, name and texture. */
export type HomeCardView = HomeCard & { num: string; name: string; texture: string };

/** How many of the record's launches left the pad: the count /projects shows as "FLOWN ×<n>". */
export function flightCountOf(record: ProjectRecord): number {
  return launchesOf(record).filter((launch) => launch.outcome !== "did-not-fly").length;
}

export function homeCardOf(record: ProjectRecord, position: number): HomeCardView {
  const { status } = record.card;
  return {
    ...record.card,
    status: typeof status === "string" ? status : `FLOWN ×${flightCountOf(record)}`,
    num: pad(position + 1),
    name: record.name,
    texture: record.texture,
  };
}

/**
 * The home card as Home draws it: the same card, linked to its project's page
 * (issue #372). Only Home builds one; the dashboard, the edit shell's page
 * switch and the placeholder preview draw a plain `HomeCardView`, which has
 * no link to follow.
 */
export type LandingCardView = HomeCardView & { readonly href: ProjectPage };

export function landingCardOf(record: ProjectRecord, position: number): LandingCardView {
  return { ...homeCardOf(record, position), href: pageOf(record.slug) };
}

/** The year a home card starts at: the first year its year line names ("2024–25" is 2024); null when it names none. */
export function startYearOf(card: Pick<HomeCardView, "year">): number | null {
  const year = /\d{4}/.exec(card.year.text);
  return year === null ? null : Number(year[0]);
}

/**
 * The home cards as the Projects row shows them (issue #359): newest first,
 * by the start or launch year each card names, then by number, the higher
 * (the later in the site order) first. A card that names no year goes last.
 * Each card keeps its number, its place in the site order.
 */
export function newestFirst<C extends HomeCardView>(cards: readonly C[]): C[] {
  const year = (card: HomeCardView) => startYearOf(card) ?? -Infinity;
  return [...cards].sort((a, b) => year(b) - year(a) || Number(b.num) - Number(a.num));
}

/**
 * The /projects entries of `records`, given in site order, as the list shows
 * them (issue #381): in the home row's order, by its home card under
 * `newestFirst`, each entry keeping its number, its place in the site order.
 */
export function listingsNewestFirst(records: readonly ProjectRecord[]): Project[] {
  const cards = records.map((record, position) => ({ ...homeCardOf(record, position), record, position }));
  return newestFirst(cards).map(({ record, position }) => listingOf(record, position));
}

/**
 * Where a stored project sits among the published ones, as its page draws
 * it: its number. A project not published yet is counted at its place in
 * the site order, as it will show once published.
 */
export type ProjectPlace = {
  readonly position: number;
  /**
   * The published projects before and after it in the site order: Home and
   * the Projects list as the page switch draws them, with this project's
   * card between the two (board 75d, `lineupWith`).
   */
  readonly lineup: { readonly before: readonly ProjectRecord[]; readonly after: readonly ProjectRecord[] };
};

/** Every project Home and the Projects list show, in site order, with `edited` in its place. */
export function lineupWith(place: ProjectPlace, edited: ProjectRecord): readonly ProjectRecord[] {
  return [...place.lineup.before, edited, ...place.lineup.after];
}

export function placeOf(items: readonly ContentItem<ProjectRecord>[], id: number): ProjectPlace | null {
  if (!items.some((i) => i.id === id)) return null;
  const ordered = [...items].sort((a, b) => a.siteOrder - b.siteOrder);
  const shown = ordered.filter((i) => publicVersion(i.version) !== null || i.id === id);
  const position = shown.findIndex((i) => i.id === id);
  const published = (from: number, to?: number) => shown.slice(from, to).map((i) => publicVersion(i.version)!);
  return { position, lineup: { before: published(0, position), after: published(position + 1) } };
}
