import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import type { Fact, KeyFacts, Part, Prose, Reason, Reasons, Title } from "@/lib/project-pages/types";
import type { Copy } from "@/lib/projects";
import { isProjectRecord } from "./check";
import type { ProjectRecord } from "./record";

// The Edit <project> panel's fields (board 75c, issue #298): the story
// sections of one project record as the text an editor types. The page under
// the edit shell is drawn from `projectViewOf`, so it changes as they type;
// Save draft and Publish send the fields, and `checkProjectFields` turns them
// back into a record. A section the panel does not edit yet (versions, launch
// history, plan, gallery, the cards) is carried over from the version the
// panel opened on.
//
// Desktop and phone copy: a text with a shorter phone version keeps both, and
// an empty phone field means the phone shows the desktop text (`Copy`). The
// story bodies always have a phone paragraph of their own (`Prose`).
//
// An optional section has a show-on-page switch. Switched off, the section
// leaves the record, so the page drops it and the numbers of the sections
// after it close up (`sectionsOf`); its fields stay in the panel, so
// switching it back on brings the same text back.

/** The panel's sections, in order; each block's Edit chip opens one. */
export type PanelSection = "top" | "name" | "design" | "reasons" | "teaser";

export type CopyFields = { readonly text: string; readonly phone: string };
export type FactFields = { readonly value: string; readonly label: CopyFields };
export type PartFields = { readonly name: string; readonly desc: string; readonly phone: string };
export type ReasonFields = { readonly title: string; readonly text: string };

/** A story column: its title (a line per forced break), its paragraphs (a blank line between two) and the phone's one paragraph. */
export type StoryFields = { readonly title: string; readonly body: string; readonly phone: string };

export type ProjectFields = {
  readonly hero: {
    readonly intro: CopyFields;
    readonly status: string;
    readonly dates: string;
    /** The visual panel's caption; null for a project whose page has no visual panel. */
    readonly caption: string | null;
    readonly facts: readonly FactFields[];
  };
  readonly nameStory: StoryFields;
  readonly design: StoryFields & { readonly partsCaption: string; readonly parts: readonly PartFields[] };
  /** "Why": optional, so it carries its show-on-page switch. */
  readonly reasons: {
    readonly shown: boolean;
    readonly eyebrow: string;
    readonly title: string;
    readonly items: readonly ReasonFields[];
  };
  /** The one line the previous project's page shows on its next-project card. */
  readonly teaser: string;
};

/** How many key facts the hero holds (`KeyFacts`), and reasons the Why section (`Reasons`). */
export const FACTS_LIMIT = { min: 1, max: 6 } as const;
export const REASONS_LIMIT = { min: 1, max: 3 } as const;

const copyFields = (copy: Copy): CopyFields => ({ text: copy.text, phone: copy.phone ?? "" });

/** A title's forced line breaks as lines of text. */
const titleText = (title: Title): string => (typeof title === "string" ? title : title.join("\n"));

const proseText = (prose: Prose): string => prose.text.join("\n\n");

/** The panel's fields for a project record: what the panel opens on. */
export function fieldsOf(record: ProjectRecord): ProjectFields {
  const { hero, nameStory, design, reasons } = record;
  return {
    hero: {
      intro: copyFields(hero.intro),
      status: hero.status,
      dates: hero.dates,
      caption: hero.visual?.caption ?? null,
      facts: hero.facts.map((f) => ({ value: f.value, label: copyFields(f.label) })),
    },
    nameStory: { title: titleText(nameStory.title), body: proseText(nameStory.body), phone: nameStory.body.phone },
    design: {
      title: titleText(design.title),
      body: proseText(design.body),
      phone: design.body.phone,
      partsCaption: design.parts.caption,
      parts: design.parts.items.map((p) => ({ name: p.name, desc: p.desc, phone: p.phone })),
    },
    // A project with no Why section opens with it switched off and one empty reason to start from.
    reasons:
      reasons === undefined
        ? { shown: false, eyebrow: "", title: "", items: [{ title: "", text: "" }] }
        : { shown: true, eyebrow: reasons.eyebrow, title: titleText(reasons.title), items: reasons.items.map((r) => ({ ...r })) },
    teaser: record.teaser,
  };
}

const copyOf = (fields: CopyFields): Copy => {
  const text = fields.text.trim();
  const phone = fields.phone.trim();
  return phone === "" ? { text } : { text, phone };
};

/** Lines of text as a title: one line is a plain string, more are forced breaks. */
function titleOf(text: string): Title {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (lines.length < 2) return lines[0] ?? "";
  const [first, ...rest] = lines;
  return [first, ...rest];
}

function proseOf(story: StoryFields): Prose {
  const paragraphs = story.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
  const [first = "", ...rest] = paragraphs;
  return { text: [first, ...rest], phone: story.phone.trim() };
}

function nonEmpty<T>(items: readonly T[]): readonly [T, ...T[]] | null {
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  return [first, ...rest];
}

function keyFactsOf(facts: readonly FactFields[]): KeyFacts | null {
  if (facts.length < FACTS_LIMIT.min || facts.length > FACTS_LIMIT.max) return null;
  return facts.map((f): Fact => ({ value: f.value.trim(), label: copyOf(f.label) })) as unknown as KeyFacts;
}

function reasonItemsOf(items: readonly ReasonFields[]): Reasons["items"] | null {
  if (items.length < REASONS_LIMIT.min || items.length > REASONS_LIMIT.max) return null;
  return items.map((r): Reason => ({ title: r.title.trim(), text: r.text.trim() })) as unknown as Reasons["items"];
}

/**
 * The record the page draws while the editor types: `opened` with the
 * panel's sections laid over it. A list the panel cannot leave empty (the key
 * facts, the parts, the reasons) keeps the opened version's while it is out
 * of bounds, which only a hand-made request can make it.
 */
export function projectViewOf(fields: ProjectFields, opened: ProjectRecord): ProjectRecord {
  const { hero, nameStory, design, reasons, teaser } = fields;
  const visual = opened.hero.visual && hero.caption !== null ? { visual: { ...opened.hero.visual, caption: hero.caption.trim() } } : {};
  const parts = nonEmpty(design.parts.map((p): Part => ({ name: p.name.trim(), desc: p.desc.trim(), phone: p.phone.trim() })));
  const reasonItems = reasonItemsOf(reasons.items);
  const { reasons: _left, ...rest } = opened;
  const shownReasons: Reasons | undefined = !reasons.shown
    ? undefined
    : reasonItems === null
      ? opened.reasons
      : { eyebrow: reasons.eyebrow.trim(), title: titleOf(reasons.title), items: reasonItems };
  return {
    ...rest,
    hero: {
      ...opened.hero,
      ...visual,
      intro: copyOf(hero.intro),
      status: hero.status.trim(),
      dates: hero.dates.trim(),
      facts: keyFactsOf(hero.facts) ?? opened.hero.facts,
    },
    nameStory: { title: titleOf(nameStory.title), body: proseOf(nameStory) },
    design: {
      title: titleOf(design.title),
      body: proseOf(design),
      parts: { ...opened.design.parts, caption: design.partsCaption.trim(), items: parts ?? opened.design.parts.items },
    },
    ...(shownReasons && { reasons: shownReasons }),
    teaser: teaser.trim(),
  };
}

/** One field the panel cannot save as it is: where it sits and why. `field` is its path in the fields, such as "hero.facts.2.value". */
export type FieldProblem = { readonly section: PanelSection; readonly field: string; readonly error: string };

/** What is missing before the fields can be saved, in panel order. Phone versions of a `Copy` may be empty: the phone shows the desktop text. */
export function fieldProblems(fields: ProjectFields): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const need = (section: PanelSection, field: string, value: string, what: string) => {
    if (value.trim() === "") problems.push({ section, field, error: `Fill in ${what}.` });
  };
  const count = (section: PanelSection, field: string, n: number, limit: { min: number; max: number }, what: string) => {
    if (n < limit.min || n > limit.max) problems.push({ section, field, error: `Keep ${limit.min} to ${limit.max} ${what}.` });
  };

  const { hero, nameStory, design, reasons } = fields;
  need("top", "hero.intro", hero.intro.text, "the intro");
  need("top", "hero.status", hero.status, "the status");
  need("top", "hero.dates", hero.dates, "the dates");
  if (hero.caption !== null) need("top", "hero.caption", hero.caption, "the visual's caption");
  count("top", "hero.facts", hero.facts.length, FACTS_LIMIT, "key facts");
  hero.facts.forEach((f, i) => {
    need("top", `hero.facts.${i}.value`, f.value, `key fact ${i + 1}'s value`);
    need("top", `hero.facts.${i}.label`, f.label.text, `key fact ${i + 1}'s label`);
  });

  need("name", "nameStory.title", nameStory.title, "the name story's title");
  need("name", "nameStory.body", nameStory.body, "the name story");
  need("name", "nameStory.phone", nameStory.phone, "the name story's phone text");

  need("design", "design.title", design.title, "the design story's title");
  need("design", "design.body", design.body, "the design story");
  need("design", "design.phone", design.phone, "the design story's phone text");
  need("design", "design.partsCaption", design.partsCaption, "the note under the parts");
  if (design.parts.length === 0) problems.push({ section: "design", field: "design.parts", error: "Keep at least one part." });
  design.parts.forEach((p, i) => {
    need("design", `design.parts.${i}.name`, p.name, `part ${i + 1}'s name`);
    need("design", `design.parts.${i}.desc`, p.desc, `part ${i + 1}'s description`);
    need("design", `design.parts.${i}.phone`, p.phone, `part ${i + 1}'s phone description`);
  });

  // A section switched off is not on the page, so what it holds does not stop a save.
  if (reasons.shown) {
    need("reasons", "reasons.eyebrow", reasons.eyebrow, "the Why eyebrow");
    need("reasons", "reasons.title", reasons.title, "the Why title");
    count("reasons", "reasons.items", reasons.items.length, REASONS_LIMIT, "reasons");
    reasons.items.forEach((r, i) => {
      need("reasons", `reasons.items.${i}.title`, r.title, `reason ${i + 1}'s title`);
      need("reasons", `reasons.items.${i}.text`, r.text, `reason ${i + 1}'s text`);
    });
  }

  need("teaser", "teaser", fields.teaser, "the next-project card line");
  return problems;
}

/** The record Save draft or Publish stores: `opened` with the fields laid over it, or why it cannot be. */
export function checkProjectFields(fields: ProjectFields, opened: ProjectRecord): WriteResult<ProjectRecord> {
  const [first] = fieldProblems(fields);
  if (first !== undefined) return refused(first.error);
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
/** A list as long as a panel list can grow, at most. */
const listOf = <T>(v: unknown, read: (x: unknown) => T | null): T[] | null => {
  if (!Array.isArray(v) || v.length > 50) return null;
  const items = v.map(read);
  return items.every((x) => x !== null) ? (items as T[]) : null;
};

const readCopy = (v: unknown): CopyFields | null => (hasStrings(v, ["text", "phone"]) ? { text: v.text, phone: v.phone } : null);
const readFact = (v: unknown): FactFields | null => {
  const label = isObject(v) ? readCopy(v.label) : null;
  return hasStrings(v, ["value"]) && label !== null ? { value: v.value, label } : null;
};
const readPart = (v: unknown): PartFields | null => (hasStrings(v, ["name", "desc", "phone"]) ? { name: v.name, desc: v.desc, phone: v.phone } : null);
const readReason = (v: unknown): ReasonFields | null => (hasStrings(v, ["title", "text"]) ? { title: v.title, text: v.text } : null);
const readStory = (v: unknown): StoryFields | null =>
  hasStrings(v, ["title", "body", "phone"]) ? { title: v.title, body: v.body, phone: v.phone } : null;

/** The fields a request carries, or null when it does not carry them in this shape. */
export function readProjectFields(input: unknown): ProjectFields | null {
  if (!hasStrings(input, ["teaser"])) return null;
  const { hero, nameStory, design, reasons } = input;
  if (!hasStrings(hero, ["status", "dates"])) return null;
  const caption = hero.caption === null ? null : isString(hero.caption) ? hero.caption : undefined;
  if (caption === undefined) return null;
  const intro = readCopy(hero.intro);
  const facts = listOf(hero.facts, readFact);
  const name = readStory(nameStory);
  const designStory = readStory(design);
  const parts = isObject(design) ? listOf(design.parts, readPart) : null;
  const items = isObject(reasons) ? listOf(reasons.items, readReason) : null;
  if (intro === null || facts === null || name === null || designStory === null || parts === null || items === null) return null;
  if (!hasStrings(design, ["partsCaption"]) || !hasStrings(reasons, ["eyebrow", "title"]) || typeof reasons.shown !== "boolean") return null;
  return {
    hero: { intro, status: hero.status, dates: hero.dates, caption, facts },
    nameStory: name,
    design: { ...designStory, partsCaption: design.partsCaption, parts },
    reasons: { shown: reasons.shown, eyebrow: reasons.eyebrow, title: reasons.title, items },
    teaser: input.teaser,
  };
}
