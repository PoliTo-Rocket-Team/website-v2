import type { NonEmpty } from "./about/alumni-types";
import { textLength } from "./content/text";
import { refused, written, type WriteResult } from "./dashboard/write";
import type { Edition, OutreachFeature } from "./outreach-types";

// The featured summit's edit panel (board 74's Edit, issue #289) and the one
// check both the panel and the server run on its fields. The panel shows the
// counters and each error under its field; the server refuses whatever the
// panel let through anyway, since a server action takes any input. The photo
// keeps its file until the photo upload of issue #291 can replace it, so
// the panel changes only its alt text.

/** One edition row as typed: the year is text until it is checked. */
export type EditionFields = { readonly year: string; readonly place: string };

export type SummitFields = {
  readonly eyebrow: string;
  readonly title: string;
  readonly story: string;
  /** The shorter story phones show; blank shows the full one. */
  readonly storyPhone: string;
  readonly photoAlt: string;
  readonly editions: readonly EditionFields[];
};

type TextField = Exclude<keyof SummitFields, "editions">;

const TEXT_FIELDS = ["eyebrow", "title", "story", "storyPhone", "photoAlt"] as const satisfies readonly TextField[];

/** The longest text each field takes, as the panel's counters show it. */
export const SUMMIT_LIMITS: Readonly<Record<TextField, number>> = {
  eyebrow: 40,
  title: 100,
  story: 400,
  storyPhone: 260,
  photoAlt: 200,
};

/** The longest place an edition names. */
export const EDITION_PLACE_MAX = 40;

const FIRST_YEAR = 2000;
const LAST_YEAR = 2100;

/** The fields the panel opens on. */
export function summitFieldsOf(feature: OutreachFeature): SummitFields {
  return {
    eyebrow: feature.eyebrow,
    title: feature.title,
    story: feature.story.text,
    storyPhone: feature.story.phone ?? "",
    photoAlt: feature.photo.alt,
    editions: feature.editions.map((e) => ({ year: String(e.year), place: e.place })),
  };
}

/** What the browser sent, as fields; null when it is not their shape. */
export function parseSummitFields(input: unknown): SummitFields | null {
  if (typeof input !== "object" || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!TEXT_FIELDS.every((name) => typeof value[name] === "string")) return null;
  const editions = value.editions;
  if (!Array.isArray(editions)) return null;
  const rows = editions.flatMap((row: unknown) => {
    if (typeof row !== "object" || row === null) return [];
    const { year, place } = row as Record<string, unknown>;
    return typeof year === "string" && typeof place === "string" ? [{ year, place }] : [];
  });
  if (rows.length !== editions.length) return null;
  const text = Object.fromEntries(TEXT_FIELDS.map((name) => [name, value[name] as string])) as Record<TextField, string>;
  return { ...text, editions: rows };
}

export type SummitFieldErrors = Partial<Record<keyof SummitFields, string>>;

const REQUIRED: Readonly<Partial<Record<TextField, string>>> = {
  eyebrow: "Write the line over the title.",
  title: "Write the summit's title.",
  story: "Write the summit's story.",
  // The photo's description is optional (Owner decision, issue #430).
};

/** The editions in order, oldest first, or why not. */
function checkEditions(rows: readonly EditionFields[]): WriteResult<NonEmpty<Edition>> {
  if (rows.length === 0) return refused("Add at least one edition.");
  const editions: Edition[] = [];
  for (const row of rows) {
    const place = row.place.trim();
    const year = Number(row.year.trim());
    if (!/^\d{4}$/.test(row.year.trim()) || year < FIRST_YEAR || year > LAST_YEAR) return refused(`Enter each edition's year, from ${FIRST_YEAR} to ${LAST_YEAR}.`);
    if (place === "") return refused(`Enter where the ${year} edition was.`);
    if (textLength(place) > EDITION_PLACE_MAX) return refused(`Keep each place under ${EDITION_PLACE_MAX} characters.`);
    if (editions.some((e) => e.year === year)) return refused(`${year} is listed twice. One edition a year.`);
    editions.push({ year, place });
  }
  const [first, ...rest] = editions.sort((a, b) => a.year - b.year);
  return written([first, ...rest]);
}

/** Every field that is wrong, by name; empty when the fields make a summit. */
export function summitFieldErrors(fields: SummitFields): SummitFieldErrors {
  const errors: SummitFieldErrors = {};
  for (const name of TEXT_FIELDS) {
    const text = fields[name].trim();
    const required = REQUIRED[name];
    if (text === "" && required !== undefined) errors[name] = required;
    else if (textLength(text) > SUMMIT_LIMITS[name]) errors[name] = `${textLength(text)} characters; the limit is ${SUMMIT_LIMITS[name]}.`;
  }
  const editions = checkEditions(fields.editions);
  if (!editions.ok) errors.editions = editions.error;
  return errors;
}

/** The fields as the summit, keeping `current`'s photo file, or the first error. */
export function checkSummitFields(fields: SummitFields, current: OutreachFeature): WriteResult<OutreachFeature> {
  const errors = summitFieldErrors(fields);
  const first = [...TEXT_FIELDS, "editions" as const].map((name) => errors[name]).find((e) => e !== undefined);
  if (first !== undefined) return refused(first);
  const editions = checkEditions(fields.editions);
  if (!editions.ok) return editions;
  const phone = fields.storyPhone.trim();
  return written({
    eyebrow: fields.eyebrow.trim(),
    title: fields.title.trim(),
    story: { text: fields.story.trim(), ...(phone && { phone }) },
    photo: { src: current.photo.src, alt: fields.photoAlt.trim() },
    editions: editions.value,
  });
}

/** "3 editions · Torino 2023, Padova 2024, Rome 2025": the summit card's line under the title (board 74). */
export function editionsLine(feature: Pick<OutreachFeature, "editions">): string {
  const count = feature.editions.length;
  const list = feature.editions.map((e) => `${e.place} ${e.year}`).join(", ");
  return `${count} ${count === 1 ? "edition" : "editions"} · ${list}`;
}
