import { isPhotoSrc } from "@/lib/outreach-photos";
import type { BlockFacts, BlockKind, Fact, Part, PartList, Photo, Prose, Reason, Reasons, TextWidth } from "@/lib/project-pages/types";
import { copyFields, copyOf, titleOf, titleText, type CopyFields } from "./copy-fields";
import {
  blankGallery,
  blankLaunches,
  blankPlan,
  blankVersions,
  galleryFields,
  galleryOf,
  galleryProblems,
  historyOf,
  launchesFields,
  launchesProblems,
  planFields,
  planOf,
  planProblems,
  readGalleryFields,
  readLaunchesFields,
  readPlanFields,
  readVersionsFields,
  versionsFields,
  versionsOf,
  versionsProblems,
  type GalleryFields,
  type LaunchesFields,
  type ListProblem,
  type PlanFields,
  type VersionsFields,
} from "./list-fields";
import type { ProjectBlock } from "./record";

// One page block as the Edit <project> panel types it (boards 93, 93b and
// 93c, epic #522): its id and hidden flag, its kind, and the text an editor
// types for that kind. The list kinds (Versions, Launch history, Timeline,
// Gallery) keep their fields and rules in ./list-fields.ts; Text, Key facts,
// Photo and Numbered points are here. `blockOf` turns the fields back into the
// stored block, and `blockProblems` says what stops a save: a block on the
// page must be filled in, and every block, hidden or not, must keep its
// shape's rule, because a hidden block is stored as it is and shows again
// as it was.

/** The eight kinds, in the order the Add block menu offers them (board 93b). */
export const BLOCK_KINDS = ["text", "facts", "photo", "gallery", "versions", "launches", "timeline", "points"] as const satisfies readonly BlockKind[];

/** How many big numbers a Key facts block holds (`BlockFacts`), and points a Numbered points block. */
export const KEY_FACTS_LIMIT = { min: 2, max: 6 } as const;
export const POINTS_LIMIT = { min: 3, max: 5 } as const;

export type FactFields = { readonly value: string; readonly label: CopyFields };
export type PartFields = { readonly name: string; readonly desc: string; readonly phone: string };
export type ReasonFields = { readonly title: string; readonly text: string };

/** A parts list under a text block's paragraphs, as the design story drew its compartments. */
export type PartsFields = { readonly label: string; readonly caption: string; readonly items: readonly PartFields[] };

/**
 * A text block (board 93c): its width, an optional heading (the title, and
 * the label its numbered eyebrow shows), its paragraphs in order, and the
 * phone's one paragraph, which shows the paragraphs while empty.
 */
export type TextFields = {
  readonly width: TextWidth;
  readonly heading: string;
  readonly label: string;
  readonly paragraphs: readonly string[];
  readonly phone: string;
  readonly parts: PartsFields | null;
};

export type FactsFields = { readonly facts: readonly FactFields[] };

/** One wide photo, none until it is uploaded, and its caption. */
export type PhotoFields = { readonly photo: Photo | null; readonly caption: string };

export type PointsFields = { readonly eyebrow: string; readonly title: string; readonly items: readonly ReasonFields[] };

type ContentOf = {
  readonly text: TextFields;
  readonly facts: FactsFields;
  readonly photo: PhotoFields;
  readonly gallery: GalleryFields;
  readonly versions: VersionsFields;
  readonly launches: LaunchesFields;
  readonly timeline: PlanFields;
  readonly points: PointsFields;
};

/** The block's stable id, unique in its project, and whether the page leaves it out. */
export type BlockMetaFields = { readonly id: string; readonly hidden: boolean };

/** A block of kind `K`; over a union of kinds, the union of their blocks. */
export type BlockFieldsOf<K extends BlockKind> = K extends BlockKind ? BlockMetaFields & { readonly kind: K } & ContentOf[K] : never;

/** One page block as the panel types it. */
export type BlockFields = BlockFieldsOf<BlockKind>;

const blankFact = (): FactFields => ({ value: "", label: { text: "", phone: "" } });
const blankReason = (): ReasonFields => ({ title: "", text: "" });

const BLANK: { readonly [K in BlockKind]: () => ContentOf[K] } = {
  text: () => ({ width: "full", heading: "", label: "", paragraphs: [""], phone: "", parts: null }),
  facts: () => ({ facts: Array.from({ length: KEY_FACTS_LIMIT.min }, blankFact) }),
  photo: () => ({ photo: null, caption: "" }),
  gallery: blankGallery,
  versions: blankVersions,
  launches: blankLaunches,
  timeline: blankPlan,
  points: () => ({ eyebrow: "", title: "", items: Array.from({ length: POINTS_LIMIT.min }, blankReason) }),
};

/** A new block of `kind`, shown, with the least its shape needs to start from; a text block takes the full width (Owner decision on #522). */
export function blankBlock<K extends BlockKind>(kind: K, id: string): BlockFieldsOf<K> {
  // BLANK pairs each kind with its own content, which the compiler cannot follow through `K`.
  return { id, kind, hidden: false, ...BLANK[kind]() } as unknown as BlockFieldsOf<K>;
}

/** The phone's paragraph when the phone field is left empty: the paragraphs, run together. */
const phoneOf = (paragraphs: readonly string[]) => paragraphs.join(" ");

function partsFields(parts: PartList): PartsFields {
  return { label: parts.label, caption: parts.caption, items: parts.items.map((p) => ({ name: p.name, desc: p.desc, phone: p.phone })) };
}

/** The panel's fields for a stored block. */
export function blockFieldsOf(block: ProjectBlock): BlockFields {
  const meta = { id: block.id, hidden: block.hidden };
  switch (block.kind) {
    case "text":
      return {
        ...meta,
        kind: "text",
        width: block.width,
        heading: block.heading ? titleText(block.heading.title) : "",
        label: block.heading?.label ?? "",
        paragraphs: [...block.body.text],
        phone: block.body.phone === phoneOf(block.body.text) ? "" : block.body.phone,
        parts: block.parts ? partsFields(block.parts) : null,
      };
    case "facts":
      return { ...meta, kind: "facts", facts: block.facts.map((f) => ({ value: f.value, label: copyFields(f.label) })) };
    case "photo":
      return { ...meta, kind: "photo", photo: block.photo, caption: block.caption };
    case "gallery":
      return { ...meta, kind: "gallery", ...galleryFields(block) };
    case "versions":
      return { ...meta, kind: "versions", ...versionsFields(block) };
    case "launches":
      return { ...meta, kind: "launches", ...launchesFields(block) };
    case "timeline":
      return { ...meta, kind: "timeline", ...planFields(block) };
    case "points":
      return { ...meta, kind: "points", eyebrow: block.eyebrow, title: titleText(block.title), items: block.items.map((r) => ({ ...r })) };
  }
}

function nonEmpty<T>(items: readonly T[]): readonly [T, ...T[]] | null {
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  return [first, ...rest];
}

function proseOf(fields: TextFields): Prose {
  const typed = fields.paragraphs.map((p) => p.trim()).filter((p) => p !== "");
  const text = nonEmpty(typed) ?? [""];
  const phone = fields.phone.trim();
  return { text, phone: phone === "" ? phoneOf(text) : phone };
}

function partListOf(parts: PartsFields | null): PartList | null {
  const items = nonEmpty(parts?.items.map((p): Part => ({ name: p.name.trim(), desc: p.desc.trim(), phone: p.phone.trim() })) ?? []);
  return parts === null || items === null ? null : { label: parts.label.trim() || "Parts", caption: parts.caption.trim(), items };
}

function factsOf(facts: readonly FactFields[]): BlockFacts | null {
  if (facts.length < KEY_FACTS_LIMIT.min || facts.length > KEY_FACTS_LIMIT.max) return null;
  return facts.map((f): Fact => ({ value: f.value.trim(), label: copyOf(f.label) })) as unknown as BlockFacts;
}

function pointsOf(items: readonly ReasonFields[]): Reasons["items"] | null {
  if (items.length < POINTS_LIMIT.min || items.length > POINTS_LIMIT.max) return null;
  return items.map((r): Reason => ({ title: r.title.trim(), text: r.text.trim() })) as unknown as Reasons["items"];
}

/** The block as stored; null while its fields break its shape's rule (a photo block with no photo, a timeline with no step under way, ...). */
export function blockOf(fields: BlockFields): ProjectBlock | null {
  const meta = { id: fields.id, hidden: fields.hidden };
  switch (fields.kind) {
    case "text": {
      const heading = fields.heading.trim() === "" ? null : { label: fields.label.trim(), title: titleOf(fields.heading) };
      const parts = partListOf(fields.parts);
      return { ...meta, kind: "text", width: fields.width, ...(heading && { heading }), body: proseOf(fields), ...(parts && { parts }) };
    }
    case "facts": {
      const facts = factsOf(fields.facts);
      return facts === null ? null : { ...meta, kind: "facts", facts };
    }
    case "photo":
      return fields.photo === null ? null : { ...meta, kind: "photo", photo: { src: fields.photo.src, alt: fields.photo.alt.trim() }, caption: fields.caption.trim() };
    case "gallery": {
      const gallery = galleryOf(fields);
      return gallery === null ? null : { ...meta, kind: "gallery", ...gallery };
    }
    case "versions": {
      const versions = versionsOf(fields);
      return versions === null ? null : { ...meta, kind: "versions", ...versions };
    }
    case "launches": {
      const history = historyOf(fields);
      return history === null ? null : { ...meta, kind: "launches", ...history };
    }
    case "timeline": {
      const plan = planOf(fields);
      return plan === null ? null : { ...meta, kind: "timeline", ...plan };
    }
    case "points": {
      const items = pointsOf(fields.items);
      return items === null ? null : { ...meta, kind: "points", eyebrow: fields.eyebrow.trim(), title: titleOf(fields.title), items };
    }
  }
}

/** One field of a block that cannot be saved as it is: its path in the block ("text.paragraphs") and why. */
export type BlockProblem = ListProblem;

/**
 * What stops a save in one block. A blank needs filling in only while the
 * block is on the page; a broken rule (a count out of bounds, no photo, no
 * step under way) stops a save hidden or not, since the block is stored whole.
 */
export function blockProblems(fields: BlockFields): BlockProblem[] {
  const shown = !fields.hidden;
  const found: BlockProblem[] = [];
  const need = (field: string, value: string, what: string) => {
    if (shown && value.trim() === "") found.push({ field, error: `Fill in ${what}.` });
  };
  const count = (field: string, n: number, limit: { min: number; max: number }, what: string) => {
    if (n < limit.min || n > limit.max) found.push({ field, error: `Keep ${limit.min} to ${limit.max} ${what}.` });
  };
  switch (fields.kind) {
    case "text":
      if (fields.heading.trim() !== "") need("text.label", fields.label, "the heading's label");
      if (shown && fields.paragraphs.every((p) => p.trim() === "")) found.push({ field: "text.paragraphs", error: "Write one paragraph at least." });
      if (fields.parts !== null) {
        need("text.parts.caption", fields.parts.caption, "the note under the parts");
        if (fields.parts.items.length === 0) found.push({ field: "text.parts", error: "Keep at least one part." });
        fields.parts.items.forEach((p, i) => {
          need(`text.parts.${i}.name`, p.name, `part ${i + 1}'s name`);
          need(`text.parts.${i}.desc`, p.desc, `part ${i + 1}'s description`);
          need(`text.parts.${i}.phone`, p.phone, `part ${i + 1}'s phone description`);
        });
      }
      return found;
    case "facts":
      count("facts.items", fields.facts.length, KEY_FACTS_LIMIT, "key facts");
      fields.facts.forEach((f, i) => {
        need(`facts.items.${i}.value`, f.value, `key fact ${i + 1}'s value`);
        need(`facts.items.${i}.label`, f.label.text, `key fact ${i + 1}'s label`);
      });
      return found;
    case "photo":
      if (fields.photo === null) found.push({ field: "photo.photo", error: "Add the photo." });
      need("photo.caption", fields.caption, "the photo's caption");
      return found;
    case "gallery":
      return galleryProblems(fields, shown);
    case "versions":
      return versionsProblems(fields, shown);
    case "launches":
      return launchesProblems(fields, shown);
    case "timeline":
      return planProblems(fields, shown);
    case "points":
      need("points.eyebrow", fields.eyebrow, "the points' eyebrow");
      need("points.title", fields.title, "the points' title");
      count("points.items", fields.items.length, POINTS_LIMIT, "points");
      fields.items.forEach((r, i) => {
        need(`points.items.${i}.title`, r.title, `point ${i + 1}'s title`);
        need(`points.items.${i}.text`, r.text, `point ${i + 1}'s text`);
      });
      return found;
  }
}

/** Every uploaded photo the block's fields hold, as their `src`; a hidden block's count. */
export function blockPhotos(fields: BlockFields): string[] {
  switch (fields.kind) {
    case "photo":
      return fields.photo === null ? [] : [fields.photo.src];
    case "gallery":
      return fields.items.flatMap((item) => (item.src === null ? [] : [item.src]));
    case "launches":
      return fields.items.flatMap((l) => l.photos.map((p) => p.src));
    default:
      return [];
  }
}

// What the browser sent, read back field by field.

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const strings = <K extends string>(v: unknown, keys: readonly K[]): Record<K, string> | null =>
  isObject(v) && keys.every((k) => isString(v[k])) ? (Object.fromEntries(keys.map((k) => [k, v[k]])) as Record<K, string>) : null;
/** A list as long as a panel list can grow, at most. */
const listOf = <T>(v: unknown, read: (x: unknown) => T | null): T[] | null => {
  if (!Array.isArray(v) || v.length > 50) return null;
  const items = v.map(read);
  return items.every((x) => x !== null) ? (items as T[]) : null;
};
const readCopy = (v: unknown): CopyFields | null => strings(v, ["text", "phone"]);
const readFact = (v: unknown): FactFields | null => {
  const label = isObject(v) ? readCopy(v.label) : null;
  const value = strings(v, ["value"]);
  return value !== null && label !== null ? { value: value.value, label } : null;
};
const readPart = (v: unknown): PartFields | null => strings(v, ["name", "desc", "phone"]);
const readReason = (v: unknown): ReasonFields | null => strings(v, ["title", "text"]);

/** An id as the panel makes them: lower-case words joined by hyphens ("name", "text-2"). */
export const BLOCK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readContent(kind: BlockKind, v: Loose): ContentOf[BlockKind] | null {
  switch (kind) {
    case "text": {
      const text = strings(v, ["heading", "label", "phone"]);
      const paragraphs = listOf(v.paragraphs, (p) => (isString(p) ? p : null));
      const width = v.width === "full" || v.width === "half" ? v.width : null;
      const parts =
        v.parts === null
          ? null
          : ((p) => {
              const head = strings(p, ["label", "caption"]);
              const items = isObject(p) ? listOf(p.items, readPart) : null;
              return head === null || items === null ? undefined : { ...head, items };
            })(v.parts);
      if (text === null || paragraphs === null || width === null || parts === undefined) return null;
      return { ...text, width, paragraphs, parts };
    }
    case "facts": {
      const facts = listOf(v.facts, readFact);
      return facts === null ? null : { facts };
    }
    case "photo": {
      const caption = strings(v, ["caption"]);
      const photo = v.photo === null ? null : strings(v.photo, ["src", "alt"]);
      if (caption === null || (v.photo !== null && (photo === null || !isPhotoSrc(photo.src)))) return null;
      return { caption: caption.caption, photo: photo === null ? null : { src: photo.src as Photo["src"], alt: photo.alt } };
    }
    case "gallery":
      return readGalleryFields(v);
    case "versions":
      return readVersionsFields(v);
    case "launches":
      return readLaunchesFields(v);
    case "timeline":
      return readPlanFields(v);
    case "points": {
      const text = strings(v, ["eyebrow", "title"]);
      const items = listOf(v.items, readReason);
      return text === null || items === null ? null : { ...text, items };
    }
  }
}

/** One block a request carries, or null when it does not carry one in this shape. Only the fields of its kind are kept. */
export function readBlockFields(v: unknown): BlockFields | null {
  if (!isObject(v) || !isString(v.id) || !BLOCK_ID.test(v.id) || v.id.length > 40 || typeof v.hidden !== "boolean") return null;
  const kind = BLOCK_KINDS.find((k) => k === v.kind);
  if (kind === undefined) return null;
  const content = readContent(kind, v);
  return content === null ? null : ({ id: v.id, hidden: v.hidden, kind, ...content } as BlockFields);
}
