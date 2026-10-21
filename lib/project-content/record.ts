import type { Hero, LaunchesBlockOf, LogEntry, PageBlock, PageBlockOf, Photo, ProjectPageRecord, Stat } from "@/lib/project-pages/types";
import { type Award, type Copy, type Launch, type Project, type ProjectPage, type Spec, type WorkLine } from "@/lib/projects";
import { publicVersion, type ContentItem } from "@/lib/content/versioned";
import type { PhotoSrc } from "@/lib/outreach-types";
import { isEngineModel, type OwnModel, type OwnRocketModel } from "@/lib/rocket-model";

// One project as the content store keeps it (issue #295): everything the
// project page, its /projects entry and its home card show, in one record
// with a published version and a working draft (lib/content/versioned.ts).
// Before the store each was typed by hand in its own file; now all three are
// read off this record, so a fact lives in one place. The page is a fixed top
// (`hero`) and an ordered list of page blocks (`blocks`, epic #522), which
// migration 0050 made of the fixed sections each record had before
// (./legacy.ts). A 3D rocket is code, not content: the record only names the
// model its top visual draws, which its card and its /projects panel draw too
// (lib/rocket-model.ts), and a model slot with none draws the placeholder.

/**
 * The home card (board 21): its own short copy, beside the project's name,
 * its background and the model of its top visual.
 */
export type HomeCard = {
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
};

/**
 * A rocket's pill may count its flights instead of naming them: it then reads
 * "FLOWN ×<n>" off the published launch history, as /projects counts them, so
 * a launch published changes it (issue #299).
 */
export type FlightCount = { readonly count: "flights" };

/** A rocket's home card: its pill is text or its flight count. */
export type VehicleCard = Omit<HomeCard, "status"> & { status: string | FlightCount };

/** The 18 background presets (board 93d, Owner decisions on #522). Each has a tall and a wide file. */
export const BACKGROUND_PRESETS = [
  "gradient",
  "orange",
  "black",
  "white",
  "nozzle-orange",
  "nozzle-grey",
  "fan-orange",
  "fan-grey",
  "horizon-orange",
  "horizon-grey",
  "cloud-orange",
  "cloud-grey",
  "orange-streaks",
  "grey-streaks",
  "ember",
  "flare",
  "projects-page",
  "cavour-page",
] as const;

export type BackgroundPreset = (typeof BACKGROUND_PRESETS)[number];

/**
 * What a project's card, its /projects panel and its page visual lie on: a
 * preset, a picture an editor uploaded and cropped twice, or the brand
 * texture the project had before presets (grill #524, R1.1). A kept texture
 * is one file for both shapes, as before; it stays until an editor picks
 * another background.
 */
export type Background =
  | { readonly kind: "preset"; readonly preset: BackgroundPreset }
  | ({ readonly kind: "upload" } & UploadedBackground)
  | { readonly kind: "texture"; readonly src: string };

/** Tall (9:16) for the home card and phones; wide (2:1) for the page visual, the /projects panel and laptops. */
export type BackgroundShape = "tall" | "wide";

/**
 * A file an editor uploaded (issue #529): in this deployment's public store,
 * or a preview's data URL. Never a file the site ships, so a request cannot
 * name one of those as an upload.
 */
export type UploadedSrc = Extract<PhotoSrc, `https://${string}` | `data:image/${string}`>;

export const isUploadedSrc = (value: unknown): value is UploadedSrc => typeof value === "string" && /^(https:\/\/|data:image\/)\S+$/.test(value);

/** One uploaded picture, cropped once per shape (board 93f): a file for each. */
export type UploadedBackground = { readonly [shape in BackgroundShape]: UploadedSrc };

/** The size each shape's file is cut at, as the presets' files are (board 93f): Tall 9:16, Wide 2:1. */
export const BACKGROUND_FRAMES: Readonly<Record<BackgroundShape, { readonly width: number; readonly height: number }>> = {
  tall: { width: 1080, height: 1920 },
  wide: { width: 2400, height: 1200 },
};

/** The largest picture an editor may upload as a background (board 93f): 10 MB. */
export const BACKGROUND_MAX_BYTES = 10 * 1024 * 1024;

/** The uploaded files a background holds: an upload's two crops, else none. */
export const backgroundUploads = (background: Background): UploadedSrc[] => (background.kind === "upload" ? [background.tall, background.wide] : []);

/** The file a background shows in one shape. */
export function backgroundSrc(background: Background, shape: BackgroundShape): string {
  switch (background.kind) {
    case "preset":
      return `/backgrounds/${background.preset}-${shape}.webp`;
    case "upload":
      return background[shape];
    case "texture":
      return background.src;
  }
}

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
  /** The page's launch card's one photo (Owner decision on #522); absent until one is uploaded. */
  cover?: Photo;
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

/** A launch history block as stored: the page's section and the /projects log, one list in date order. */
export type LaunchesBlock = LaunchesBlockOf<StoredLaunch>;

/** A page block as stored. */
export type ProjectBlock = PageBlockOf<StoredLaunch>;

/** An engine has flown nothing, so its page holds no launch history. */
export type EngineBlock = Exclude<ProjectBlock, LaunchesBlock>;

type RecordBase<M extends OwnModel> = {
  /** Its address, /projects/<slug>. */
  slug: string;
  name: string;
  background: Background;
  /** The page's meta description. */
  description: string;
  /** The top of the page; its visual is the model the card and the /projects panel draw too. */
  hero: Hero<M>;
};

/**
 * A rocket: its status counts its flights. Its visual names a rocket only,
 * never an engine, so its card and its panel draw a rocket.
 */
export type VehicleRecord = RecordBase<OwnRocketModel> & {
  kind: "vehicle";
  card: VehicleCard;
  listing: VehicleListing;
  blocks: readonly ProjectBlock[];
};

/**
 * An engine in development: work lines and a milestone in place of a launch
 * history. Its visual may name a rocket model as well as an engine.
 */
export type EngineRecord = RecordBase<OwnModel> & { kind: "engine"; card: HomeCard; listing: EngineListing; blocks: readonly EngineBlock[] };

export type ProjectRecord = VehicleRecord | EngineRecord;

/** The record's top-level keys: what a preview keeps per change. */
export type ProjectKey = keyof VehicleRecord;

export const PROJECT_KEYS = [
  "kind",
  "slug",
  "name",
  "background",
  "listing",
  "card",
  "description",
  "hero",
  "blocks",
] as const satisfies readonly ProjectKey[];

const pad = (i: number) => String(i).padStart(2, "0");

/**
 * The launch history /projects lists and the card's flight count reads: the
 * first launch history block the page shows. An engine has none.
 */
export function launchHistoryOf(record: ProjectRecord): LaunchesBlock | undefined {
  if (record.kind === "engine") return undefined;
  return record.blocks.find((block): block is LaunchesBlock => block.kind === "launches" && !block.hidden);
}

/** The launches of a record, as /projects lists them; an engine has none. */
export function launchesOf(record: ProjectRecord): StoredLaunch[] {
  return [...(launchHistoryOf(record)?.entries ?? [])];
}

/** The record with another intro at the top of its page. */
export function withIntro(record: ProjectRecord, text: string): ProjectRecord {
  return record.kind === "vehicle"
    ? { ...record, hero: { ...record.hero, intro: { text } } }
    : { ...record, hero: { ...record.hero, intro: { text } } };
}

/** The model a project's top visual names: what its card and its /projects panel draw. None for a photo, no visual, or the placeholder. */
export function visualModelOf<M extends OwnModel>(hero: Hero<M>): M | undefined {
  return hero.visual.kind === "model" ? hero.visual.own?.model : undefined;
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
    ...(launch.cover && { cover: launch.cover }),
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

function pageBlockOf(block: ProjectBlock): PageBlock {
  if (block.kind !== "launches") return block;
  const [first, ...rest] = block.entries;
  return { ...block, entries: [logEntry(first), ...rest.map(logEntry)] satisfies readonly [LogEntry, ...LogEntry[]] };
}

/** The project page's record: its top and its blocks, in the shape components/project-page/ draws. */
export function pageRecordOf(record: ProjectRecord): ProjectPageRecord {
  return { description: record.description, hero: record.hero, blocks: record.blocks.map(pageBlockOf) };
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
    texture: backgroundSrc(record.background, "wide"),
  };
  if (record.kind === "engine") {
    const model = visualModelOf(record.hero);
    return {
      ...base,
      kind: "engine",
      ...(isEngineModel(model) && { engine: model }),
      workLines: record.listing.workLines,
      milestone: record.listing.milestone,
    };
  }
  const rocket = visualModelOf(record.hero);
  return {
    ...base,
    kind: "vehicle",
    ...(rocket && { rocket }),
    versions: record.listing.versions,
    launches: launchesOf(record).map(listedLaunch),
    logSummary: record.listing.logSummary,
  };
}

/**
 * The home card as the Projects section draws it: the card's copy with the
 * project's number, name, background (its tall file) and the model its top
 * visual names; with none the card draws the shared placeholder.
 */
export type HomeCardView = HomeCard & { num: string; name: string; texture: string; rocket?: OwnModel };

/** How many of the record's launches left the pad: the count /projects shows as "FLOWN ×<n>". */
export function flightCountOf(record: ProjectRecord): number {
  return launchesOf(record).filter((launch) => launch.outcome !== "did-not-fly").length;
}

export function homeCardOf(record: ProjectRecord, position: number): HomeCardView {
  const { status } = record.card;
  const rocket = visualModelOf<OwnModel>(record.hero);
  return {
    ...record.card,
    status: typeof status === "string" ? status : `FLOWN ×${flightCountOf(record)}`,
    ...(rocket && { rocket }),
    num: pad(position + 1),
    name: record.name,
    texture: backgroundSrc(record.background, "tall"),
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
