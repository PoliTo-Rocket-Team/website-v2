import type { FilledGallery } from "@/components/gallery/items";
import type { PhotoSrc } from "@/lib/outreach-types";
import type { Award, Copy } from "@/lib/projects";
import type { OwnModel, OwnRocket } from "@/lib/rocket-model";

// One project page as data: every /projects/<slug> page is one of these
// records drawn by the same components (components/project-page/), read off
// the project's stored record (lib/project-content/record.ts). The page is a
// fixed top (the hero) and an ordered list of page blocks below it (epic
// #522): the page draws the blocks in their order and leaves out a hidden
// one. The section numbers follow the blocks that show a heading.

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

/** A photo uploaded from the dashboard (lib/outreach-photos.ts) and what it shows, for assistive tech. */
export type Photo = { src: PhotoSrc; alt: string };

/**
 * The top of the page's visual (Owner decision on #522): the project's 3D
 * model, a photo, or none. A model or a photo sits in the panel on the
 * project's background with its caption; with none the page has no panel and
 * the key facts sit under the title. The model slot draws a still of the
 * project's `own` model, or of the shared placeholder when it has none
 * (lib/rocket-model.ts); the home card and the /projects panel draw the same
 * model. `M` narrows the models it may name: a rocket's page names a rocket.
 */
export type TopVisual<M extends OwnModel = OwnModel> =
  | { kind: "model"; caption: string; own?: OwnRocket<M> }
  | { kind: "photo"; caption: string; photo: Photo }
  | { kind: "none" };

export type Hero<M extends OwnModel = OwnModel> = {
  intro: Copy;
  /** The status pill, beside the dates. */
  status: string;
  dates: string;
  visual: TopVisual<M>;
  facts: KeyFacts;
};

/** One row of a text block's parts list, in the order drawn, top to bottom. */
export type Part = { name: string; desc: string; phone: string };

/** A numbered list under a text block's paragraphs, as the design story drew its compartments. */
export type PartList = {
  /** What the list is, for assistive tech. */
  label: string;
  /** The note under the list, before its number range. */
  caption: string;
  /** Drawn top to bottom and numbered bottom to top. */
  items: readonly [Part, ...Part[]];
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

/** A photo of a campaign. A launch card has one cover photo (Owner decision on #522); with none the key is absent and its slot shows the background. */
export type LaunchPhoto = Photo;

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
  cover?: LaunchPhoto;
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
  /** One to five reasons (`REASONS_LIMIT`). */
  items:
    | readonly [Reason]
    | readonly [Reason, Reason]
    | readonly [Reason, Reason, Reason]
    | readonly [Reason, Reason, Reason, Reason]
    | readonly [Reason, Reason, Reason, Reason, Reason];
};

export type GallerySection = { title: string; items: FilledGallery };

// Page blocks (epic #522, boards 93 and 93b): the eight kinds an editor adds
// below the top of the page. Each has a stable id, unique in its project, and
// a hidden flag: a hidden block stays in the record with its content and the
// page leaves it out.

export type BlockMeta = { id: string; hidden: boolean };

/** A text block takes the full content width, or half: two half blocks in a row sit side by side (Owner decision on #522). */
export type TextWidth = "full" | "half";

/** A heading over a block: the numbered eyebrow's label ("THE NAME") and the title. */
export type BlockHeading = { label: string; title: Title };

/** Text: an optional heading, paragraphs, and the parts list the design story had. */
export type TextBlock = BlockMeta & { kind: "text"; width: TextWidth; heading?: BlockHeading; body: Prose; parts?: PartList };

/** Two to six big numbers with their labels. */
export type BlockFacts =
  | readonly [Fact, Fact]
  | readonly [Fact, Fact, Fact]
  | readonly [Fact, Fact, Fact, Fact]
  | readonly [Fact, Fact, Fact, Fact, Fact]
  | readonly [Fact, Fact, Fact, Fact, Fact, Fact];

export type KeyFactsBlock = BlockMeta & { kind: "facts"; facts: BlockFacts };

/** One wide photo with a caption. */
export type PhotoBlock = BlockMeta & { kind: "photo"; photo: Photo; caption: string };

export type GalleryBlock = BlockMeta & { kind: "gallery" } & GallerySection;

export type VersionsBlock = BlockMeta & { kind: "versions" } & Versions;

/** One card per flight, in date order; `L` is a launch as stored, or as the page draws it. */
export type LaunchesBlockOf<L> = BlockMeta & { kind: "launches"; title: string; entries: readonly [L, ...L[]] };

/** Done, now, next and later steps. */
export type TimelineBlock = BlockMeta & { kind: "timeline" } & Plan;

/** A title and numbered points. */
export type PointsBlock = BlockMeta & { kind: "points" } & Reasons;

export type PageBlockOf<L> =
  | TextBlock
  | KeyFactsBlock
  | PhotoBlock
  | GalleryBlock
  | VersionsBlock
  | LaunchesBlockOf<L>
  | TimelineBlock
  | PointsBlock;

export type BlockKind = PageBlockOf<unknown>["kind"];

/** A block as the page draws it: a launch history's campaigns as their cards. */
export type PageBlock = PageBlockOf<LogEntry>;

/** One project's page, as `pageRecordOf` (lib/project-content/record.ts) reads it off the stored record. */
export type ProjectPageRecord = {
  /** The page's meta description. */
  description: string;
  hero: Hero;
  /** In page order, hidden ones included: the page leaves those out (`pageRowsOf`). */
  blocks: readonly PageBlock[];
};
