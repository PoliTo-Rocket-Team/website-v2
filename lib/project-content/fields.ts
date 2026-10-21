import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import type { Fact, KeyFacts } from "@/lib/project-pages/types";
import { blockFieldsOf, blockOf, blockPhotos, blockProblems, readBlockFields, type BlockFields, type FactFields } from "./block-fields";
import { BLOCKS_MAX } from "./block-list";
import { cardFieldsAfterSave, cardFieldsOf, cardProblems, readCardFields, withCardFields, type CardFields } from "./card-fields";
import { isProjectRecord } from "./check";
import { copyFields, copyOf, type CopyFields } from "./copy-fields";
import type { ProjectBlock, ProjectRecord } from "./record";

// The Edit <project> panel's fields (boards 75c and 93, issues #298 and #299,
// epic #522): the top of the page, the page blocks in order (each typed as
// ./block-fields.ts says, and added, duplicated, hidden, removed and moved as
// ./block-list.ts says), and the home card (./card-fields.ts, issue #300).
// The page under the edit shell is drawn from `projectViewOf`, so it changes
// as the editor types; Save draft and Publish send the fields, and
// `checkProjectFields` turns them back into a record. What the panel does not
// edit (the /projects entry's own copy, the background) is carried over from
// the version the panel opened on.
//
// Desktop and phone copy: a text with a shorter phone version keeps both, and
// an empty phone field means the phone shows the desktop text (`Copy`).
//
// A hidden block stays in the record with its content: the page leaves it out
// and the numbers of the blocks after it close up (`pageRowsOf`).

/**
 * The panel's sections: the top of the page, the Page blocks card, one
 * block's panel by the block's id, and the home card. Each block's Edit chip
 * on the page opens its block's panel.
 */
export type PanelSection = "top" | "blocks" | BlockSection | "card";

/** The panel of one block. */
export type BlockSection = `block:${string}`;

export const blockSection = (id: string): BlockSection => `block:${id}`;

/** The block id a block's panel names; null for every other section. */
export const blockIdOf = (section: PanelSection): string | null => (section.startsWith("block:") ? section.slice("block:".length) : null);

export type { BlockFields, CardFields, CopyFields, FactFields };

export type ProjectFields = {
  readonly hero: {
    readonly intro: CopyFields;
    readonly status: string;
    readonly dates: string;
    /** The visual panel's caption; null for a project whose top visual is none. */
    readonly caption: string | null;
    readonly facts: readonly FactFields[];
  };
  /** The page blocks, in page order. */
  readonly blocks: readonly BlockFields[];
  /** The project's card on Home, which the page switch shows in place (board 75d). */
  readonly card: CardFields;
};

/** How many key facts the top of the page holds (`KeyFacts`). */
export const FACTS_LIMIT = { min: 1, max: 6 } as const;

/** The panel's fields for a project record: what the panel opens on. */
export function fieldsOf(record: ProjectRecord): ProjectFields {
  const { hero } = record;
  const blocks: readonly ProjectBlock[] = record.blocks;
  return {
    hero: {
      intro: copyFields(hero.intro),
      status: hero.status,
      dates: hero.dates,
      caption: hero.visual.kind === "none" ? null : hero.visual.caption,
      facts: hero.facts.map((f) => ({ value: f.value, label: copyFields(f.label) })),
    },
    blocks: blocks.map(blockFieldsOf),
    card: cardFieldsOf(record),
  };
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
  const { visual } = opened.hero;
  const caption = visual.kind !== "none" && hero.caption !== null ? { visual: { ...visual, caption: hero.caption.trim() } } : {};
  const record = {
    ...opened,
    hero: {
      ...opened.hero,
      ...caption,
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
  return fields.blocks.flatMap(blockPhotos);
}

/**
 * One field the panel cannot save as it is: the section it sits in and its
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
  if (hero.caption !== null) need("hero.caption", hero.caption, "the visual's caption");
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

/** The fields a request carries, or null when it does not carry them in this shape. */
export function readProjectFields(input: unknown): ProjectFields | null {
  if (!isObject(input)) return null;
  const { hero } = input;
  if (!hasStrings(hero, ["status", "dates"])) return null;
  const caption = hero.caption === null ? null : isString(hero.caption) ? hero.caption : undefined;
  if (caption === undefined) return null;
  const intro = readCopy(hero.intro);
  const facts = Array.isArray(hero.facts) && hero.facts.length <= 50 ? hero.facts.map(readFact) : null;
  const blocks = readBlocks(input.blocks);
  const card = readCardFields(input.card);
  if (intro === null || facts === null || !facts.every((f) => f !== null) || blocks === null || card === null) return null;
  return { hero: { intro, status: hero.status, dates: hero.dates, caption, facts: facts as FactFields[] }, blocks, card };
}
