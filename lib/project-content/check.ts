import { isPhotoSrc } from "@/lib/outreach-photos";
import { specRows } from "@/lib/project-pages/types";
import { ownModels, ownRocketModels } from "@/lib/rocket-model";
import type { ProjectRecord } from "./record";

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

/** The hero, its panel naming one of `models`: a rocket's names a rocket, an engine's any model. */
const heroOf = (models: readonly string[]) =>
  shape({
    intro: copy,
    status: isString,
    dates: isString,
    visual: optional(
      shape({
        caption: isString,
        rocket: optional(shape({ own: optional(shape({ model: oneOf(...models), alt: isString })) })),
      }),
    ),
    facts: list(shape({ value: isString, label: copy }), 1, 6),
  });

const nameStory = shape({ title, body: prose });

const design = shape({
  title,
  body: prose,
  parts: shape({
    label: isString,
    caption: isString,
    items: list(shape({ name: isString, desc: isString, phone: isString }), 1),
  }),
});

const version = shape({
  pill: isString,
  tab: isString,
  role: copy,
  specs: shape(Object.fromEntries(specRows.map(([key]) => [key, (v: unknown) => v === null || isString(v)]))),
});

const versions = shape({ title: isString, note: copy, before: list(version), highlighted: version, after: list(version) });

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
  photos: optional(list(shape({ src: isPhotoSrc, alt: isString }), 1, 2)),
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

const launches = shape({ title: isString, entries: list((v) => flown(v) || grounded(v), 1) });

const planStep = shape({ date: optional(isString), title: isString, text: copy });

const plan = shape({
  title,
  intro: copy,
  done: list(planStep),
  now: planStep,
  next: list(planStep),
  later: list(planStep),
});

const reasons = shape({ eyebrow: isString, title, items: list(shape({ title: isString, text: isString }), 1, 5) });

const galleryItem: Check = (v) =>
  shape({ src: isString, alt: isString, caption: optional(isString) })(v) ||
  shape({ placeholder: oneOf(true), alt: isString, caption: optional(isString) })(v);

const gallery = shape({ title: isString, items: list(galleryItem, 1) });

const cardFields = {
  year: copy,
  status: isString,
  statusTone: oneOf("dark", "light"),
  desc: copy,
  specs: list(spec, 3, 3),
  infoTint: optional(isNumber),
};

/**
 * A rocket's pill may count its flights; an engine has none to count. A
 * rocket's card draws a rocket; an engine's may draw any model (record.ts).
 */
const vehicleCard = shape({
  ...cardFields,
  status: (v) => isString(v) || shape({ count: oneOf("flights") })(v),
  rocket: optional(oneOf(...ownRocketModels)),
});
const engineCard = shape({ ...cardFields, rocket: optional(oneOf(...ownModels)) });

const listingBase = { years: isString, description: copy, specs: list(spec, 6, 6) };

const recordBase = {
  slug: (v: unknown) => isString(v) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v as string),
  name: isString,
  texture: isString,
  description: isString,
  nameStory,
  design,
  versions: optional(versions),
  plan: optional(plan),
  reasons: optional(reasons),
  gallery: optional(gallery),
};

const vehicle = shape({
  ...recordBase,
  kind: oneOf("vehicle"),
  hero: heroOf(ownRocketModels),
  card: vehicleCard,
  listing: shape({ ...listingBase, versions: list(isString), logSummary: isString }),
  launches: optional(launches),
});

const engine = shape({
  ...recordBase,
  kind: oneOf("engine"),
  hero: heroOf(ownModels),
  card: engineCard,
  listing: shape({ ...listingBase, workLines: list(shape({ code: isString, name: isString })), milestone: isString }),
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

