import { isPhotoSrc } from "@/lib/outreach-photos";
import { specRows } from "@/lib/project-pages/types";
import { ownModels, ownRocketModels } from "@/lib/rocket-model";
import { BACKGROUND_PRESETS, type ProjectRecord } from "./record";

// Whether a value read back is a project record (./record.ts): a stored JSON
// document from the database, or a test developer's changes from their
// cookie. The types promise every shape rule (a non-empty list, one to six
// key facts, the phone variants), so a value that breaks one is refused here
// rather than drawn half-broken.

type Check = (v: unknown) => boolean;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isString: Check = (v) => typeof v === "string";
const isNumber: Check = (v) => typeof v === "number" && Number.isFinite(v);
const optional = (check: Check): Check => (v) => v === undefined || check(v);
const oneOf = (...values: readonly unknown[]): Check => (v) => values.includes(v);

/** An object whose every listed field passes its check; a key it does not list is refused. */
function shape(fields: Record<string, Check>): Check {
  return (v) => {
    if (!isObject(v)) return false;
    if (Object.keys(v).some((key) => !(key in fields))) return false;
    return Object.entries(fields).every(([key, check]) => check(v[key]));
  };
}

function list(item: Check, min = 0, max = Infinity): Check {
  return (v) => Array.isArray(v) && v.length >= min && v.length <= max && v.every(item);
}

const copy = shape({ text: isString, phone: optional(isString) });
const copyWithPhone = shape({ text: isString, phone: isString });
const spec = shape({ label: copy, value: copy });
const title: Check = (v) => isString(v) || list(isString, 1)(v);
const prose = shape({ text: list(isString, 1), phone: isString });
const award = shape({ name: isString, short: optional(isString), citation: optional(isString) });
const pageStat = shape({ value: isString, label: isString, phoneLabel: optional(isString) });

const photo = shape({ src: isPhotoSrc, alt: isString });
const fact = shape({ value: isString, label: copy });

/** The top of the page, its visual naming one of `models`: a rocket's names a rocket, an engine's any model. */
const heroOf = (models: readonly string[]) =>
  shape({
    intro: copy,
    status: isString,
    dates: isString,
    visual: (v) =>
      shape({ kind: oneOf("model"), caption: isString, own: optional(shape({ model: oneOf(...models), alt: isString })) })(v) ||
      shape({ kind: oneOf("photo"), caption: isString, photo })(v) ||
      shape({ kind: oneOf("none") })(v),
    facts: list(fact, 1, 6),
  });

const partList = shape({
  label: isString,
  caption: isString,
  items: list(shape({ name: isString, desc: isString, phone: isString }), 1),
});

/** A site file kept from before presets ("/textures/project-cavour.webp"). */
const sitePath: Check = (v) => isString(v) && /^\/[\w\-./]+$/.test(v as string) && !(v as string).includes("..");

const background: Check = (v) =>
  shape({ kind: oneOf("preset"), preset: oneOf(...BACKGROUND_PRESETS) })(v) ||
  shape({ kind: oneOf("upload"), tall: isPhotoSrc, wide: isPhotoSrc })(v) ||
  shape({ kind: oneOf("texture"), src: sitePath })(v);

const version = shape({
  pill: isString,
  tab: isString,
  role: copy,
  specs: shape(Object.fromEntries(specRows.map(([key]) => [key, (v: unknown) => v === null || isString(v)]))),
});

const launchBase = {
  date: isString,
  where: isString,
  result: isString,
  award: optional(award),
  title: isString,
  place: copy,
  version: isString,
  motor: isString,
  summary: copyWithPhone,
  cover: optional(photo),
};

const flown = shape({
  ...launchBase,
  outcome: oneOf("nominal", "recovery-failed"),
  flight: shape({ apogee: isString, maxSpeed: isString, country: isString }),
  stats: list(pageStat, 2, 2),
  phoneStat: oneOf(0, 1),
});

const grounded = shape({
  ...launchBase,
  outcome: oneOf("did-not-fly"),
  stats: list(pageStat, 4, 4),
  phoneDrops: oneOf(0, 1, 2, 3),
});

const planStep = shape({ date: optional(isString), title: isString, text: copy });

const galleryItem: Check = (v) =>
  shape({ src: isString, alt: isString, caption: optional(isString) })(v) ||
  shape({ placeholder: oneOf(true), alt: isString, caption: optional(isString) })(v);

// The page blocks (epic #522), each with its id and hidden flag.

const meta = { id: (v: unknown) => isString(v) && (v as string).length > 0, hidden: (v: unknown) => typeof v === "boolean" };
const block = (kind: string, fields: Record<string, Check>) => shape({ ...meta, kind: oneOf(kind), ...fields });

/**
 * Numbered points keep one to five, as the reasons they were made from did
 * (migration 0050): a stored project with fewer than three still reads.
 */
const blockChecks: Readonly<Record<string, Check>> = {
  text: block("text", {
    width: oneOf("full", "half"),
    heading: optional(shape({ label: isString, title })),
    body: prose,
    parts: optional(partList),
  }),
  facts: block("facts", { facts: list(fact, 2, 6) }),
  photo: block("photo", { photo, caption: isString }),
  gallery: block("gallery", { title: isString, items: list(galleryItem, 1) }),
  versions: block("versions", { title: isString, note: copy, before: list(version), highlighted: version, after: list(version) }),
  launches: block("launches", { title: isString, entries: list((v) => flown(v) || grounded(v), 1) }),
  timeline: block("timeline", { title, intro: copy, done: list(planStep), now: planStep, next: list(planStep), later: list(planStep) }),
  points: block("points", { eyebrow: isString, title, items: list(shape({ title: isString, text: isString }), 1, 5) }),
};

/** The blocks of a page whose kinds are `kinds`: each one whole, no two with one id. */
const blocksOf =
  (kinds: readonly string[]): Check =>
  (v) => {
    if (!Array.isArray(v)) return false;
    const ids = new Set(v.map((b) => (isObject(b) ? b.id : undefined)));
    return ids.size === v.length && v.every((b) => isObject(b) && kinds.includes(b.kind as string) && blockChecks[b.kind as string](b));
  };

const ALL_KINDS = Object.keys(blockChecks);

const cardFields = {
  year: copy,
  status: isString,
  statusTone: oneOf("dark", "light"),
  desc: copy,
  specs: list(spec, 3, 3),
  infoTint: optional(isNumber),
};

/** A rocket's pill may count its flights; an engine has none to count. */
const vehicleCard = shape({ ...cardFields, status: (v) => isString(v) || shape({ count: oneOf("flights") })(v) });
const engineCard = shape(cardFields);

const listingBase = { years: isString, description: copy, specs: list(spec, 6, 6) };

const recordBase = {
  slug: (v: unknown) => isString(v) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v as string),
  name: isString,
  background,
  description: isString,
};

/** A rocket's visual names a rocket only, so its card and its panel draw a rocket (record.ts). */
const vehicle = shape({
  ...recordBase,
  kind: oneOf("vehicle"),
  hero: heroOf(ownRocketModels),
  card: vehicleCard,
  listing: shape({ ...listingBase, versions: list(isString), logSummary: isString }),
  blocks: blocksOf(ALL_KINDS),
});

/** An engine's visual may name any model; its page holds no launch history. */
const engine = shape({
  ...recordBase,
  kind: oneOf("engine"),
  hero: heroOf(ownModels),
  card: engineCard,
  listing: shape({ ...listingBase, workLines: list(shape({ code: isString, name: isString })), milestone: isString }),
  blocks: blocksOf(ALL_KINDS.filter((kind) => kind !== "launches")),
});

export function isProjectRecord(value: unknown): value is ProjectRecord {
  return vehicle(value) || engine(value);
}

/**
 * Keys a record saved before may still carry, which nothing reads now:
 * `teaser`, the line of the next-project card the pages no longer draw
 * (issue #377). Migration 0037 imported it and every save until then kept it,
 * so stored versions and a test developer's cookie still hold it.
 */
export const RETIRED_KEYS: ReadonlySet<string> = new Set(["teaser"]);

/**
 * A record read back from the store: the record with any retired key left
 * out, or null when what is left is not a record.
 */
export function storedProjectRecord(value: unknown): ProjectRecord | null {
  if (!isObject(value)) return null;
  const record = Object.fromEntries(Object.entries(value).filter(([key]) => !RETIRED_KEYS.has(key)));
  return isProjectRecord(record) ? record : null;
}

