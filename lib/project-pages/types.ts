import type { FilledGallery } from "@/components/gallery/items";
import type { Award, Copy } from "@/lib/projects";

// One project page as data: every /projects/<slug> page is one of these
// records drawn by the same components (components/project-page/). A section
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
   * The panel on the project's texture. Without a `still` it shows the
   * texture alone; a project with no visual at all leaves the panel out.
   */
  visual?: { caption: string; still?: { src: string; alt: string } };
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

/** One project's page. The registry (index.ts) keys it by the slug of its /projects entry. */
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
  /** The one line the previous project's page shows on its next-project card. */
  teaser: string;
};
