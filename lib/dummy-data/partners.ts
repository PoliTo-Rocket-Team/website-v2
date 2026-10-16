import type { ContentStore } from "@/lib/content/editor";
import { memoryContentStore } from "@/lib/content/memory";
import type { ContentItem, Versioned } from "@/lib/content/versioned";
import type { LogoFiles } from "@/lib/partners-editor";
import { checkPartnerFields, fieldsOf } from "@/lib/partners-fields";
import { importedPartners } from "@/lib/partners-import";
import type { Partner, PartnerLogo } from "@/lib/partners";
import { DUMMY_STATE_COOKIE_BYTES } from "./state";

// The partners on previews and in test-developer sessions (issue #256),
// which never touch a database. The dashboard starts from the partners the
// import carries into the database, with one partner holding draft changes
// as board 76 draws it. A test developer's changes are kept in a cookie in
// their own browser, cleared on sign out; the public pages never read it.
// A logo they upload is measured as the database side measures it but kept
// nowhere: the page shows it until the next load, then the logo box shows the
// partner's name, as the boards draw it.

/** The partner the dummy dashboard shows with draft changes (EvoMisure on board 76). */
const DRAFTED_ID = 3;

/** The dashboard's starting partners: the import, with EvoMisure's one-liner changed in a draft. */
export function dummyPartnerSeed(): ContentItem<Partner>[] {
  return importedPartners().map((item) => {
    if (item.id !== DRAFTED_ID || item.version.state !== "published") return item;
    const published = item.version.published;
    const draft = { ...published, oneLiner: "Test and measurement instruments for our engine tests." };
    return { ...item, version: { state: "published", published, draft } };
  });
}

/** A logo src the preview did not keep: the logo box shows the partner's name instead. */
export const UNKEPT_LOGO_SRC = "";

/** What a test developer changed: items saved or created, ids removed, and new places in the site order. */
export type DummyPartnerEdits = {
  readonly saved: readonly ContentItem<Partner>[];
  readonly removed: readonly number[];
  readonly order: readonly (readonly [number, number])[];
};

export const NO_PARTNER_EDITS: DummyPartnerEdits = { saved: [], removed: [], order: [] };

export type DummyPartnerEditsStore = {
  readonly current: DummyPartnerEdits;
  save(next: DummyPartnerEdits): Promise<void>;
};

export const NO_PARTNER_EDITS_STORE: DummyPartnerEditsStore = { current: NO_PARTNER_EDITS, save: async () => {} };

/** The seed with the edits laid over it. */
export function withPartnerEdits(seed: readonly ContentItem<Partner>[], edits: DummyPartnerEdits): ContentItem<Partner>[] {
  const saved = new Map(edits.saved.map((item) => [item.id, item]));
  const order = new Map(edits.order);
  const removed = new Set(edits.removed);
  const fromSeed = seed.filter((item) => !removed.has(item.id)).map((item) => saved.get(item.id) ?? item);
  const created = edits.saved.filter((item) => !seed.some((s) => s.id === item.id));
  return [...fromSeed, ...created].map((item) => ({ ...item, siteOrder: order.get(item.id) ?? item.siteOrder }));
}

/** A logo the cookie can hold: an uploaded one (a data URL) is not kept. */
function keptLogo(logo: PartnerLogo): PartnerLogo {
  return logo.src.startsWith("data:") ? { ...logo, src: UNKEPT_LOGO_SRC } : logo;
}

function keptVersion(version: Versioned<Partner>): Versioned<Partner> {
  const keep = (p: Partner) => ({ ...p, logo: keptLogo(p.logo) });
  return version.state === "draft"
    ? { state: "draft", draft: keep(version.draft) }
    : { state: "published", published: keep(version.published), draft: version.draft === null ? null : keep(version.draft) };
}

/** The edits that turn `seed` into `items`: what the cookie keeps. */
export function partnerEditsOf(seed: readonly ContentItem<Partner>[], items: readonly ContentItem<Partner>[]): DummyPartnerEdits {
  const bySeed = new Map(seed.map((item) => [item.id, item]));
  const saved = items
    .filter((item) => {
      const was = bySeed.get(item.id);
      return was === undefined || JSON.stringify(was.version) !== JSON.stringify(item.version);
    })
    .map((item) => ({ ...item, version: keptVersion(item.version) }));
  const order = items.flatMap((item): (readonly [number, number])[] =>
    bySeed.get(item.id)?.siteOrder === item.siteOrder ? [] : [[item.id, item.siteOrder]],
  );
  const removed = seed.filter((s) => !items.some((item) => item.id === s.id)).map((s) => s.id);
  return { saved, removed, order };
}

export function serializePartnerEdits(edits: DummyPartnerEdits): string {
  return encodeURIComponent(JSON.stringify(edits));
}

const isId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;

/** A partner the panel could have saved; anything else in the cookie is dropped. */
function isPartner(value: unknown): value is Partner {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Partner;
  const logo = p.logo as Partial<PartnerLogo> | undefined;
  return (
    typeof p.name === "string" &&
    typeof logo?.src === "string" &&
    isId(logo.width) &&
    isId(logo.height) &&
    (logo.kind === "mark" || logo.kind === "wordmark") &&
    typeof logo.darkLogo === "boolean" &&
    checkPartnerFields(fieldsOf(p)).ok
  );
}

function isVersioned(value: unknown): value is Versioned<Partner> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Versioned<Partner>;
  if (v.state === "draft") return isPartner(v.draft);
  return v.state === "published" && isPartner(v.published) && (v.draft === null || isPartner(v.draft));
}

/** The edits in the cookie; none when it is absent or not one this code wrote. */
export function parsePartnerEdits(value: string | undefined): DummyPartnerEdits {
  if (!value) return NO_PARTNER_EDITS;
  try {
    const wire = JSON.parse(decodeURIComponent(value)) as DummyPartnerEdits;
    const saved = Array.isArray(wire.saved) ? wire.saved : [];
    const removed = Array.isArray(wire.removed) ? wire.removed : [];
    const order = Array.isArray(wire.order) ? wire.order : [];
    if (
      !saved.every((item) => isId(item?.id) && Number.isSafeInteger(item.siteOrder) && isVersioned(item.version)) ||
      !removed.every(isId) ||
      !order.every((o) => Array.isArray(o) && o.length === 2 && isId(o[0]) && Number.isSafeInteger(o[1]))
    ) {
      return NO_PARTNER_EDITS;
    }
    return { saved, removed, order };
  } catch {
    return NO_PARTNER_EDITS;
  }
}

export const PREVIEW_FULL = "This preview keeps only a few changes. Sign out to start over.";

/**
 * The test developer's partners: the seed with their edits, in a store that
 * keeps each write in their cookie, and refuses one the cookie cannot hold.
 */
export function dummyPartnerStore(edits: DummyPartnerEditsStore): ContentStore<Partner> {
  const seed = dummyPartnerSeed();
  return memoryContentStore(withPartnerEdits(seed, edits.current), async (items) => {
    const next = partnerEditsOf(seed, items);
    if (serializePartnerEdits(next).length > DUMMY_STATE_COOKIE_BYTES) return PREVIEW_FULL;
    await edits.save(next);
    return null;
  });
}

/** A preview stores no files: an uploaded logo comes back as a data URL the page shows until the next load. */
export const dummyLogoFiles: LogoFiles = {
  put: async (logo) => `data:${logo.contentType};base64,${Buffer.from(logo.bytes).toString("base64")}`,
};
