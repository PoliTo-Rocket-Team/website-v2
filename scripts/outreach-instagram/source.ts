import { readFileSync } from "node:fs";
import { z } from "zod";
import type { NonEmpty } from "@/lib/about/alumni-types";
import { OUTREACH_TAG_MAX } from "@/lib/outreach-editor";
import { isIsoDate } from "@/lib/outreach-rows";
import type { BodyBlock, IsoDate } from "@/lib/outreach-types";
import type { Copy } from "@/lib/projects";

// The import's source (issue #886): one JSON file the owner keeps outside the
// repo, beside the Instagram export. It holds the texts drafted from the
// Instagram captions, the carousel photos of each post, each named by its path
// inside the export, and the tags the new posts need that the tag list does
// not have yet. Each post has a key that stays the same from run to run: the
// ledger (./ledger.ts) remembers, by key, the draft a run wrote, so the next
// run updates that draft instead of adding a second one. The repo holds none
// of it; the tests build fake sources in memory.
//
// Every text is site copy, so none may keep what a caption has and a site
// post does not (owner decision, issue #886): a hashtag, an @handle, an emoji
// or the styled Unicode letters captions use for bold and italics. A source
// that holds one is refused before anything is read from the database.

/** A post's key: lowercase words joined by hyphens, the same on every run. */
export type PostKey = string;

/** A carousel photo: its path inside the export, its alt text, and an optional one-line caption for the lightbox. */
export type SourcePhoto = { readonly file: string; readonly alt: string; readonly caption?: string };

/** An existing post, found by its published title: the longer body its draft carries, and the gallery photos it adds. */
export type ExistingPost = {
  readonly key: PostKey;
  readonly title: string;
  readonly body: NonEmpty<BodyBlock>;
  readonly gallery: NonEmpty<SourcePhoto>;
};

/** A post Instagram has and the site does not: every field a whole post needs; its first gallery photo is also its cover. */
export type NewPost = {
  readonly key: PostKey;
  readonly title: string;
  readonly date: IsoDate;
  readonly place: string;
  readonly tags: NonEmpty<string>;
  readonly summary: Copy;
  readonly lead: string;
  readonly body: NonEmpty<BodyBlock>;
  readonly gallery: NonEmpty<SourcePhoto>;
};

/** The posts, and the tags the import adds to the end of the tag list when the list lacks them. */
export type Source = { readonly newTags: readonly string[]; readonly existing: readonly ExistingPost[]; readonly added: readonly NewPost[] };

/** What in `text` a site text may not keep, or null when it keeps none. */
export function captionMarkIn(text: string): string | null {
  if (/(^|[^\p{L}\p{N}&])#[\p{L}\p{N}_]/u.test(text)) return "a hashtag";
  if (/(^|[^\p{L}\p{N}._%+-])@[\p{L}\p{N}_.]/u.test(text)) return "an @handle";
  if (/\p{Extended_Pictographic}/u.test(text)) return "an emoji";
  if (/[\u{1D400}-\u{1D7FF}]/u.test(text)) return "styled Unicode letters";
  return null;
}

const siteText = z
  .string()
  .refine((s) => s.trim() !== "", "must not be blank")
  .superRefine((s, ctx) => {
    const mark = captionMarkIn(s);
    if (mark !== null) ctx.addIssue({ code: "custom", message: `holds ${mark}; site texts keep none` });
  });

/** A photo path inside the export: relative, plain segments, never climbing out. */
const exportPath = z
  .string()
  .refine((p) => p !== "" && !p.startsWith("/") && !p.includes("\\") && p.split("/").every((s) => s !== "" && s !== "." && s !== ".."), "must be a plain path inside the export");

const photo = z.strictObject({ file: exportPath, alt: siteText, caption: siteText.optional() });

const block = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("paragraph"), text: siteText }),
  z.strictObject({ kind: z.literal("heading"), text: siteText }),
  z.strictObject({ kind: z.literal("highlight"), label: siteText, text: siteText }),
]);

const nonEmpty = <T extends z.ZodType>(item: T) => z.array(item).min(1);

const key = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase words joined by hyphens");

/** A tag the editor could add: at most its limit, no space at either end (lib/outreach-editor.ts, `checkNewTag`). */
const tagName = siteText.refine((s) => s === s.trim() && [...s].length <= OUTREACH_TAG_MAX, `must be at most ${OUTREACH_TAG_MAX} characters, with no space at either end`);

const existing = z.strictObject({ key, title: z.string().min(1), body: nonEmpty(block), gallery: nonEmpty(photo) });

const added = z.strictObject({
  key,
  title: siteText,
  date: z.string().refine(isIsoDate, "must be a day written YYYY-MM-DD"),
  place: siteText,
  tags: nonEmpty(z.string().min(1)),
  summary: z.strictObject({ text: siteText, phone: siteText.optional() }),
  lead: siteText,
  body: nonEmpty(block),
  gallery: nonEmpty(photo),
});

const sourceShape = z
  .strictObject({ newTags: z.array(tagName).default([]), existing: z.array(existing), added: z.array(added) })
  .superRefine((source, ctx) => {
    const keys = new Set<string>();
    const entries = [...source.existing.map((e, i) => ["existing", i, e.key] as const), ...source.added.map((e, i) => ["added", i, e.key] as const)];
    for (const [list, i, k] of entries) {
      if (keys.has(k)) ctx.addIssue({ code: "custom", path: [list, i, "key"], message: `${k} is an earlier post's key` });
      keys.add(k);
    }
    if (new Set(source.newTags).size !== source.newTags.length) ctx.addIssue({ code: "custom", path: ["newTags"], message: "names one tag twice" });
  });

/** A source that is not one: every problem, each with where it is. */
export class SourceError extends Error {}

/** `value` as a source; a `SourceError` naming every problem otherwise. */
export function sourceOf(value: unknown): Source {
  const parsed = sourceShape.safeParse(value);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  ${issue.path.join(".") || "(top)"}: ${issue.message}`);
    throw new SourceError(`The source is not an import source:\n${problems.join("\n")}`);
  }
  // The schema checked each array has an item and each date reads.
  return parsed.data as unknown as Source;
}

/** Reads and checks the source file. */
export function readSource(file: string): Source {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new SourceError(`The source file does not read as JSON: ${error instanceof Error ? error.message.split("\n", 1)[0] : String(error)}`);
  }
  return sourceOf(json);
}
