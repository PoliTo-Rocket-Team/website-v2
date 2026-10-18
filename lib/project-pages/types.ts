import type { FilledGallery } from "@/components/gallery/items";
import type { PhotoSrc } from "@/lib/outreach-types";
import type { Award, Copy } from "@/lib/projects";
import type { OwnRocket } from "@/lib/rocket-model";

// One project page as data: every /projects/<slug> page is one of these
// records drawn by the same components (components/project-page/), read off
// the project's stored record (lib/project-content/record.ts). A section
// the project has no data for is an absent key, never an empty value, so the
// page leaves it out; the section numbers follow the sections that are there.

/** A title with forced line breaks; a plain string wraps where it falls. */
export type Title = string | readonly [string, ...string[]];

/** Desktop paragraphs and the phone's one shorter paragraph. */
export type Prose = { text: readonly [string, ...string[]]; phone: string };

export type Stat = { value: string; label: string };

/** A key fact under the hero. The label may have a shorter phone version. */
export type Fact = { value: string; label: Copy };

/** One to six key facts. */
export type KeyFacts =
  | readonly [Fact]
  | readonly [Fact, Fact]
  | readonly [Fact, Fact, Fact]
  | readonly [Fact, Fact, Fact, Fact]
  | readonly [Fact, Fact, Fact, Fact, Fact]
  | readonly [Fact, Fact, Fact, Fact, Fact, Fact];

export type Hero = {
  intro: Copy;
  /** The status pill, beside the dates. */
  status: string;
  dates: string;
  /**
   * The panel on the project's texture. Its rocket slot draws a still of the
   * project's `own` model, or of the shared placeholder when it has none
   * (lib/rocket-model.ts). Without a `rocket` it shows the texture alone; a
   * project with no visual at all leaves the panel out. The stored record
   * check refuses an engine on a rocket's page (lib/project-content/check.ts).
   */
  visual?: { caption: string; rocket?: { own?: OwnRocket } };
  facts: KeyFacts;
};

/** One row of the design story's list, in the order drawn, top to bottom. */
export type Part = { name: string; desc: string; phone: string };

export type NameStory = { title: Title; body: Prose };

export type DesignStory = {
  title: Title;
  body: Prose;
  parts: {
    /** What the list is, for assistive tech. */
    label: string;
    /** The note under the list, before its number range. */
    caption: string;
    /** Drawn top to bottom and numbered bottom to top. */
    items: readonly [Part, ...Part[]];
  };
};

/** The versions table's rows, in order; every version gives each one, null where no value is known. */
export const specRows = [
  ["diameter", "DIAMETER"],
  ["length", "LENGTH"],
  ["emptyMass", "EMPTY MASS"],
  ["wetMass", "WET MASS"],
  ["payload", "PAYLOAD"],
  ["motor", "MOTOR"],
  ["thrustToWeight", "LIFTOFF T/W"],
  ["maxThrust", "MAX THRUST"],
  ["maxSpeed", "MAX SPEED"],
  ["targetApogee", "TARGET APOGEE"],
] as const;

export type SpecKey = (typeof specRows)[number][0];

export type Version = {
  /** The column's pill on desktop, and the launch log's version line. */
  pill: string;
  /** The phone tab. */
  tab: string;
  /** What the version was for, under its pill. */
  role: Copy;
  /** null where the sources give no value; the page shows a dimmed dash. */
  specs: Record<SpecKey, string | null>;
};

/**
 * The versions in table order. Exactly one is highlighted (bold on desktop,
 * the default tab on phones); its place in the order is where it sits.
 */
export type Versions = {
  title: string;
  note: Copy;
  before: readonly Version[];
  highlighted: Version;
  after: readonly Version[];
};

export type Outcome = "nominal" | "recovery-failed" | "did-not-fly";

/** A photo of a campaign: a file uploaded from the dashboard (lib/outreach-photos.ts) and what it shows, for assistive tech. */
export type LaunchPhoto = { src: PhotoSrc; alt: string };

/** A launch card draws two photo slots, so it holds one or two photos; with none the key is absent and the slots show the texture. */
export type LaunchPhotos = readonly [LaunchPhoto] | readonly [LaunchPhoto, LaunchPhoto];

/** One campaign on the launch history, as the page draws it. */
export type LogEntry = {
  date: string;
  title: string;
  place: Copy;
  version: string;
  motor: string;
  outcome: Outcome;
  summary: Copy & { phone: string };
  award?: Award;
  stats: readonly [Stat, Stat, Stat, Stat];
  /** The phone card keeps three numbers, with shorter labels. */
  phoneStats: readonly [Stat, Stat, Stat];
  photos?: LaunchPhotos;
};

export type LaunchLog = { title: string; entries: readonly [LogEntry, ...LogEntry[]] };

export type PlanStep = { date?: string; title: string; text: Copy };

/** The plan in order. Its shape keeps the steps in status order, with one step under way. */
export type Plan = {
  title: Title;
  intro: Copy;
  done: readonly PlanStep[];
  now: PlanStep;
  next: readonly PlanStep[];
  later: readonly PlanStep[];
};

export type Reason = { title: string; text: string };

export type Reasons = {
  /** The eyebrow after the section number, for example "WHY LIQUID". */
  eyebrow: string;
  title: Title;
  items: readonly [Reason] | readonly [Reason, Reason] | readonly [Reason, Reason, Reason];
};

export type GallerySection = { title: string; items: FilledGallery };

/** One project's page, as `pageRecordOf` (lib/project-content/record.ts) reads it off the stored record. */
export type ProjectPageRecord = {
  /** The page's meta description. */
  description: string;
  hero: Hero;
  name: NameStory;
  design: DesignStory;
  versions?: Versions;
  launches?: LaunchLog;
  plan?: Plan;
  reasons?: Reasons;
  gallery?: GallerySection;
};
