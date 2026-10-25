import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import { isPhotoSrc } from "@/lib/outreach-photos";
import type { Fact, KeyFacts, Photo, TopVisual } from "@/lib/project-pages/types";
import { editorVersion, type Versioned } from "@/lib/content/versioned";
import { MODEL_ALTS, ownModels, ownRocketModels, rocketModelOf, type OwnModel, type RocketModel } from "@/lib/rocket-model";
import { blockFieldsOf, blockOf, blockPhotos, blockProblems, readBlockFields, type BlockFields, type FactFields } from "./block-fields";
import { BLOCKS_MAX } from "./block-list";
import { cardFieldsAfterSave, cardFieldsOf, cardProblems, readCardFields, withCardFields, type CardFields } from "./card-fields";
import { isProjectRecord } from "./check";
import { copyFields, copyOf, type CopyFields } from "./copy-fields";
import {
  isUploadedSrc,
  presetNamed,
  visualModelOf,
  type Background,
  type BackgroundPreset,
  type ProjectBlock,
  type ProjectRecord,
  type UploadedBackground,
} from "./record";

// The Edit <project> panel's fields (boards 75c, 93 and 93d, issues #298 and
// #299, epic #522): the top of the page with its visual, caption and
// background, the page blocks in order (each typed as ./block-fields.ts says,
// and added, duplicated, hidden, removed and moved as ./block-list.ts says),
// and the home card (./card-fields.ts, issue #300). The page under the edit
// shell is drawn from `projectViewOf`, so it changes as the editor types;
// Save draft and Publish send the fields, and `checkProjectFields` turns them
// back into a record. What the panel does not edit (the /projects entry's own
// copy) is carried over from the version the panel opened on.
//
// Desktop and phone copy: a text with a shorter phone version keeps both, and
// an empty phone field means the phone shows the desktop text (`Copy`).
//
// A hidden block stays in the record with its content: the page leaves it out
// and the numbers of the blocks after it close up (`pageRowsOf`).

/**
 * The panel's sections, each a row that opens where it sits, any of them at
 * once (epic #614, rulings R1.2 and R2.1 on #720): the top of the page, one
 * row per block by the block's id, and the home card. The top's Edit chip on
 * the page opens its row, and each block's chip its block's row.
 */
export type PanelSection = PageSection | "card";

/** The sections that edit a part of the project page, which the page outlines. */
export type PageSection = "top" | BlockSection;

/** The row of one block. */
export type BlockSection = `block:${string}`;

export const blockSection = (id: string): BlockSection => `block:${id}`;

/** The block id a block's row names; null for every other section. */
export function blockIdOf(section: BlockSection): string;
export function blockIdOf(section: PanelSection): string | null;
export function blockIdOf(section: PanelSection): string | null {
  return section.startsWith("block:") ? section.slice("block:".length) : null;
}

/** The panel's rows in the order it draws them: the top of the page, each block in page order, then the card. */
export const panelSections = (fields: ProjectFields): PanelSection[] => ["top", ...fields.blocks.map((b) => blockSection(b.id)), "card"];

/**
 * The section whose part of the page is outlined: of the open rows, the one
 * opened last that edits the page. The card is drawn on Home and the Projects
 * list, so it outlines nothing on the project page.
 */
export function outlinedSection(expanded: readonly PanelSection[]): PageSection | null {
  for (let i = expanded.length - 1; i >= 0; i--) {
    const section = expanded[i];
    if (section !== "card") return section;
  }
  return null;
}

export type { BlockFields, CardFields, CopyFields, FactFields };

/**
 * The top of the page's visual as the panel picks it (board 93d): a model
 * from the Rocket field (`pickableModelsOf`, issue #389), a photo, none until
 * it is uploaded, or no visual at all.
 */
export type VisualFields =
  | { readonly kind: "model"; readonly model: RocketModel }
  | { readonly kind: "photo"; readonly photo: Photo | null }
  | { readonly kind: "none" };

/**
 * The background as the panel picks it (boards 93d and 93f): one of the 18
 * presets, a picture the editor uploaded with its Tall and Wide crops
 * (issue #529), or the brand texture the panel opened on, kept from before
 * presets. A request can name a preset or uploaded files, never a file the
 * site ships: a kept background is the opened version's, whatever the request
 * says, and a save takes an upload only when this side stored its files.
 */
export type BackgroundFields =
  | { readonly kind: "preset"; readonly preset: BackgroundPreset }
  | ({ readonly kind: "upload" } & UploadedBackground)
  | { readonly kind: "kept" };

export type ProjectFields = {
  readonly hero: {
    readonly intro: CopyFields;
    readonly status: string;
    readonly dates: string;
    readonly visual: VisualFields;
    /** The visual panel's caption, optional; a project with no visual keeps none. */
    readonly caption: string;
    readonly facts: readonly FactFields[];
  };
  /** What the cards, the /projects panel and the page visual lie on. */
  readonly background: BackgroundFields;
  /** The page blocks, in page order. */
  readonly blocks: readonly BlockFields[];
  /** The project's card on Home, which the page switch shows in place (board 75d). */
  readonly card: CardFields;
};

/** How many key facts the top of the page holds (`KeyFacts`). */
export const FACTS_LIMIT = { min: 1, max: 6 } as const;

function visualFieldsOf(visual: TopVisual): VisualFields {
  switch (visual.kind) {
    case "model":
      return { kind: "model", model: visual.own?.model ?? "placeholder" };
    case "photo":
      return { kind: "photo", photo: visual.photo };
    case "none":
      return { kind: "none" };
  }
}

/**
 * The models the Rocket field offers a project (issue #389), the outline
 * rocket last. A rocket's record names a rocket only (`isProjectRecord`,
 * issue #382), so an engine never draws on a rocket's card; an engine's may
 * name any model.
 */
const PICKABLE_MODELS: Readonly<Record<ProjectRecord["kind"], readonly RocketModel[]>> = {
  vehicle: [...ownRocketModels, "placeholder"],
  engine: [...ownModels, "placeholder"],
};

export function pickableModelsOf(kind: ProjectRecord["kind"]): readonly RocketModel[] {
  return PICKABLE_MODELS[kind];
}

/**
 * The model the Rocket field opens on (issue #389): the project's own, from
 * the version the panel opened or else the published one, so a visual
 * switched to Photo or None and back keeps it; the outline rocket for a
 * project that has none.
 */
export function projectModelOf(version: Versioned<ProjectRecord>): RocketModel {
  const own = visualModelOf<OwnModel>(editorVersion(version).hero) ?? (version.state === "published" ? visualModelOf<OwnModel>(version.published.hero) : undefined);
  return rocketModelOf(own);
}

export function backgroundFieldsOf(background: Background): BackgroundFields {
  switch (background.kind) {
    case "preset":
      return { kind: "preset", preset: background.preset };
    case "upload":
      return { kind: "upload", tall: background.tall, wide: background.wide };
    case "texture":
      return { kind: "kept" };
  }
}

/** The panel's fields for a project record: what the panel opens on. */
export function fieldsOf(record: ProjectRecord): ProjectFields {
  const { hero } = record;
  const blocks: readonly ProjectBlock[] = record.blocks;
  return {
    hero: {
      intro: copyFields(hero.intro),
      status: hero.status,
      dates: hero.dates,
      visual: visualFieldsOf(hero.visual),
      caption: hero.visual.kind === "none" ? "" : hero.visual.caption,
      facts: hero.facts.map((f) => ({ value: f.value, label: copyFields(f.label) })),
    },
    background: backgroundFieldsOf(record.background),
    blocks: blocks.map(blockFieldsOf),
    card: cardFieldsOf(record),
  };
}

/**
 * The visual the page draws for the panel's choice. A model keeps the alt
 * text the opened version gave it, or takes the model's own when it is newly
 * picked; the placeholder carries none. A photo not uploaded yet shows the
 * opened version's photo, or no panel.
 */
function visualOf(fields: VisualFields, caption: string, was: TopVisual): TopVisual {
  switch (fields.kind) {
    case "model": {
      if (fields.model === "placeholder") return { kind: "model", caption };
      const own = was.kind === "model" && was.own?.model === fields.model ? was.own : { model: fields.model, alt: MODEL_ALTS[fields.model] };
      return { kind: "model", caption, own };
    }
    case "photo":
      if (fields.photo === null) return was.kind === "photo" ? was : { kind: "none" };
      return { kind: "photo", caption, photo: { src: fields.photo.src, alt: fields.photo.alt.trim() } };
    case "none":
      return { kind: "none" };
  }
}

/** The background the panel picked: a preset, an upload, or the opened version's own. */
export function backgroundOf(fields: BackgroundFields, opened: Background): Background {
  switch (fields.kind) {
    case "preset":
      return { kind: "preset", preset: fields.preset };
    case "upload":
      return { kind: "upload", tall: fields.tall, wide: fields.wide };
    case "kept":
      return opened;
  }
}

function keyFactsOf(facts: readonly FactFields[]): KeyFacts | null {
  if (facts.length < FACTS_LIMIT.min || facts.length > FACTS_LIMIT.max) return null;
  return facts.map((f): Fact => ({ value: f.value.trim(), label: copyOf(f.label) })) as unknown as KeyFacts;
}

/**
 * The blocks the page draws while the editor types, in the panel's order. A
 * block whose fields break its shape's rule for the moment (a photo block
 * with no photo yet) shows as the panel opened it, or not at all when it is
 * new. An engine's page holds no launch history.
 */
function blocksOf(fields: readonly BlockFields[], opened: ProjectRecord): ProjectBlock[] {
  const was: readonly ProjectBlock[] = opened.blocks;
  return fields.flatMap((f) => {
    const block = blockOf(f) ?? was.find((b) => b.id === f.id && b.kind === f.kind);
    if (block === undefined) return [];
    return opened.kind === "engine" && block.kind === "launches" ? [] : [{ ...block, hidden: f.hidden }];
  });
}

/**
 * The record the page draws while the editor types: `opened` with the
 * panel's fields laid over it. The top's key facts keep the opened version's
 * while their count is out of bounds, which only a hand-made request can make.
 */
export function projectViewOf(fields: ProjectFields, opened: ProjectRecord): ProjectRecord {
  const { hero } = fields;
  const record = {
    ...opened,
    background: backgroundOf(fields.background, opened.background),
    hero: {
      ...opened.hero,
      visual: visualOf(hero.visual, hero.caption.trim(), opened.hero.visual),
      intro: copyOf(hero.intro),
      status: hero.status.trim(),
      dates: hero.dates.trim(),
      facts: keyFactsOf(hero.facts) ?? opened.hero.facts,
    },
    blocks: blocksOf(fields.blocks, opened),
  } as ProjectRecord;
  return withCardFields(record, fields.card);
}

/** The panel's fields after a save: the stored record's, which is what the page now shows. */
export function fieldsAfterSave(stored: ProjectRecord, sent: ProjectFields): ProjectFields {
  return { ...fieldsOf(stored), card: cardFieldsAfterSave(stored, sent.card) };
}

/**
 * Every uploaded photo the panel holds, a hidden block's included: showing
 * it again puts them on the page, so no save may delete their files while
 * the panel holds them.
 */
export function heldPhotos(fields: ProjectFields): string[] {
  const { visual } = fields.hero;
  const top = visual.kind === "photo" && visual.photo !== null ? [visual.photo.src] : [];
  const background = fields.background.kind === "upload" ? [fields.background.tall, fields.background.wide] : [];
  return [...top, ...background, ...fields.blocks.flatMap(blockPhotos)];
}

/**
 * One field the panel cannot save as it is: the section whose row holds it,
 * which a refused save opens, and its
 * path in the fields, such as "hero.facts.2.value" or, in a block, the block's
 * id and its path there ("blocks.gallery-2.gallery.title").
 */
export type FieldProblem = { readonly section: PanelSection; readonly field: string; readonly error: string };

/** The path of a field of the block with `id`. */
export const blockField = (id: string, path: string) => `blocks.${id}.${path}`;

/** What is missing before the fields can be saved, in panel order. Phone versions of a `Copy` may be empty: the phone shows the desktop text. */
export function fieldProblems(fields: ProjectFields): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const need = (field: string, value: string, what: string) => {
    if (value.trim() === "") problems.push({ section: "top", field, error: `Fill in ${what}.` });
  };

  const { hero } = fields;
  need("hero.intro", hero.intro.text, "the intro");
  need("hero.status", hero.status, "the status");
  need("hero.dates", hero.dates, "the dates");
  if (hero.visual.kind === "photo" && hero.visual.photo === null) problems.push({ section: "top", field: "hero.visual", error: "Add the photo." });
  if (hero.facts.length < FACTS_LIMIT.min || hero.facts.length > FACTS_LIMIT.max) {
    problems.push({ section: "top", field: "hero.facts", error: `Keep ${FACTS_LIMIT.min} to ${FACTS_LIMIT.max} key facts.` });
  }
  hero.facts.forEach((f, i) => {
    need(`hero.facts.${i}.value`, f.value, `key fact ${i + 1}'s value`);
    need(`hero.facts.${i}.label`, f.label.text, `key fact ${i + 1}'s label`);
  });

  for (const block of fields.blocks) {
    for (const { field, error } of blockProblems(block)) problems.push({ section: blockSection(block.id), field: blockField(block.id, field), error });
  }

  return [...problems, ...cardProblems(fields.card)];
}

/** The record Save draft or Publish stores: `opened` with the fields laid over it, or why it cannot be. */
export function checkProjectFields(fields: ProjectFields, opened: ProjectRecord): WriteResult<ProjectRecord> {
  const [first] = fieldProblems(fields);
  if (first !== undefined) return refused(first.error);
  // Only a rocket's pill counts flights, and only a rocket's page has a launch history; the panel never offers either for an engine.
  if (opened.kind === "engine" && (fields.card.countsFlights || fields.blocks.some((b) => b.kind === "launches"))) {
    return refused("Reload the page and try again.");
  }
  const record = projectViewOf(fields, opened);
  return isProjectRecord(record) ? written(record) : refused("Reload the page and try again.");
}

// What the browser sent, read back as fields: a server action takes any
// value. Each value is copied field by field, so nothing it carries beyond
// the fields reaches the record.

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const hasStrings = <K extends string>(v: unknown, keys: readonly K[]): v is Record<K, string> & Loose =>
  isObject(v) && keys.every((k) => isString(v[k]));

const readCopy = (v: unknown): CopyFields | null => (hasStrings(v, ["text", "phone"]) ? { text: v.text, phone: v.phone } : null);
const readFact = (v: unknown): FactFields | null => {
  const label = isObject(v) ? readCopy(v.label) : null;
  return hasStrings(v, ["value"]) && label !== null ? { value: v.value, label } : null;
};

/** The blocks a request carries: each in its shape, no two with one id, no more than a page holds. */
function readBlocks(v: unknown): BlockFields[] | null {
  if (!Array.isArray(v) || v.length > BLOCKS_MAX) return null;
  const blocks = v.map(readBlockFields);
  if (!blocks.every((b) => b !== null)) return null;
  return new Set(blocks.map((b) => b!.id)).size === blocks.length ? (blocks as BlockFields[]) : null;
}

const MODELS: readonly RocketModel[] = [...ownModels, "placeholder"];

/** The visual a request picks: a model the site has, a photo uploaded to a project (or none yet), or no visual. */
function readVisual(v: unknown): VisualFields | null {
  if (!isObject(v)) return null;
  switch (v.kind) {
    case "model": {
      const model = MODELS.find((m) => m === v.model);
      return model === undefined ? null : { kind: "model", model };
    }
    case "photo": {
      if (v.photo === null) return { kind: "photo", photo: null };
      if (!hasStrings(v.photo, ["src", "alt"]) || !isPhotoSrc(v.photo.src)) return null;
      return { kind: "photo", photo: { src: v.photo.src, alt: v.photo.alt } };
    }
    case "none":
      return { kind: "none" };
    default:
      return null;
  }
}

/** The background a request picks: a preset by its name, two uploaded files, or the one the panel opened on. */
function readBackground(v: unknown): BackgroundFields | null {
  if (!isObject(v)) return null;
  if (v.kind === "kept") return { kind: "kept" };
  if (v.kind === "upload") return isUploadedSrc(v.tall) && isUploadedSrc(v.wide) ? { kind: "upload", tall: v.tall, wide: v.wide } : null;
  const preset = presetNamed(v.preset);
  return v.kind === "preset" && preset !== undefined ? { kind: "preset", preset } : null;
}

/** The fields a request carries, or null when it does not carry them in this shape. */
export function readProjectFields(input: unknown): ProjectFields | null {
  if (!isObject(input)) return null;
  const { hero } = input;
  if (!hasStrings(hero, ["status", "dates", "caption"])) return null;
  const intro = readCopy(hero.intro);
  const visual = readVisual(hero.visual);
  const facts = Array.isArray(hero.facts) && hero.facts.length <= 50 ? hero.facts.map(readFact) : null;
  const background = readBackground(input.background);
  const blocks = readBlocks(input.blocks);
  const card = readCardFields(input.card);
  if (intro === null || visual === null || facts === null || !facts.every((f) => f !== null) || background === null || blocks === null || card === null) {
    return null;
  }
  return {
    hero: { intro, status: hero.status, dates: hero.dates, visual, caption: hero.caption, facts: facts as FactFields[] },
    background,
    blocks,
    card,
  };
}
