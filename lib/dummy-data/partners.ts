import type { ContentStore } from "@/lib/content/editor";
import type { ContentItem, Versioned } from "@/lib/content/versioned";
import type { LogoFiles } from "@/lib/partners-editor";
import { checkPartnerFields, fieldsOf } from "@/lib/partners-fields";
import { importedPartners } from "@/lib/partners-import";
import type { Partner, PartnerLogo } from "@/lib/partners";
import {
  contentEditsOf,
  dummyContentStore,
  NO_CONTENT_EDITS,
  NO_CONTENT_EDITS_STORE,
  parseContentEdits,
  PREVIEW_FULL,
  serializeContentEdits,
  type ContentEdits,
  type ContentEditsStore,
} from "./content-edits";

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

/** What a test developer changed (./content-edits.ts). */
export type DummyPartnerEdits = ContentEdits<Partner>;

export const NO_PARTNER_EDITS: DummyPartnerEdits = NO_CONTENT_EDITS;

export type DummyPartnerEditsStore = ContentEditsStore<Partner>;

export const NO_PARTNER_EDITS_STORE: DummyPartnerEditsStore = NO_CONTENT_EDITS_STORE;

export { PREVIEW_FULL };

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
  return contentEditsOf(seed, items, keptVersion);
}

export const serializePartnerEdits = serializeContentEdits<Partner>;

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

/** The edits in the cookie; none when it is absent or not one this code wrote. */
export function parsePartnerEdits(value: string | undefined): DummyPartnerEdits {
  return parseContentEdits(value, isPartner);
}

/**
 * The test developer's partners: the seed with their edits, in a store that
 * keeps each write in their cookie, and refuses one the cookie cannot hold.
 */
export function dummyPartnerStore(edits: DummyPartnerEditsStore): ContentStore<Partner> {
  return dummyContentStore(dummyPartnerSeed(), edits, keptVersion);
}

/** A preview stores no files: an uploaded logo comes back as a data URL the page shows until the next load. */
export const dummyLogoFiles: LogoFiles = {
  put: async (logo) => `data:${logo.contentType};base64,${Buffer.from(logo.bytes).toString("base64")}`,
};
