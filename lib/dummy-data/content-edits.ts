import { memoryContentStore, type MemoryContentStore } from "@/lib/content/memory";
import type { ContentItem, Versioned } from "@/lib/content/versioned";
import { DUMMY_STATE_COOKIE_BYTES } from "./state";

// A test developer's changes to one content type (issues #256 and #258), on
// previews and in test-developer sessions, which never touch a database. The
// dashboard starts from a seed; what they change is kept in a cookie in their
// own browser, cleared on sign out, as the edits that turn the seed into what
// they see. The public pages never read it. Every content type keeps its
// edits this way, each in its own cookie.

/** What a test developer changed: items saved or created, ids removed, and new places in the site order. */
export type ContentEdits<T extends D, D = T> = {
  readonly saved: readonly ContentItem<T, D>[];
  readonly removed: readonly number[];
  readonly order: readonly (readonly [number, number])[];
};

export const NO_CONTENT_EDITS: ContentEdits<never> = { saved: [], removed: [], order: [] };

export type ContentEditsStore<T> = {
  readonly current: ContentEdits<T>;
  save(next: ContentEdits<T>): Promise<void>;
};

export const NO_CONTENT_EDITS_STORE: ContentEditsStore<never> = { current: NO_CONTENT_EDITS, save: async () => {} };

/** The seed with the edits laid over it. */
export function withContentEdits<T extends D, D = T>(seed: readonly ContentItem<T, D>[], edits: ContentEdits<T, D>): ContentItem<T, D>[] {
  const saved = new Map(edits.saved.map((item) => [item.id, item]));
  const order = new Map(edits.order);
  const removed = new Set(edits.removed);
  const fromSeed = seed.filter((item) => !removed.has(item.id)).map((item) => saved.get(item.id) ?? item);
  const created = edits.saved.filter((item) => !seed.some((s) => s.id === item.id));
  return [...fromSeed, ...created].map((item) => ({ ...item, siteOrder: order.get(item.id) ?? item.siteOrder }));
}

/** The edits that turn `seed` into `items`: what the cookie keeps, each saved version passed through `kept`. */
export function contentEditsOf<T extends D, D = T>(
  seed: readonly ContentItem<T, D>[],
  items: readonly ContentItem<T, D>[],
  kept: (version: Versioned<T, D>) => Versioned<T, D> = (version) => version,
): ContentEdits<T, D> {
  const bySeed = new Map(seed.map((item) => [item.id, item]));
  const saved = items
    .filter((item) => {
      const was = bySeed.get(item.id);
      return was === undefined || JSON.stringify(was.version) !== JSON.stringify(item.version);
    })
    .map((item) => ({ ...item, version: kept(item.version) }));
  const order = items.flatMap((item): (readonly [number, number])[] =>
    bySeed.get(item.id)?.siteOrder === item.siteOrder ? [] : [[item.id, item.siteOrder]],
  );
  const removed = seed.filter((s) => !items.some((item) => item.id === s.id)).map((s) => s.id);
  return { saved, removed, order };
}

export function serializeContentEdits<T extends D, D = T>(edits: ContentEdits<T, D>): string {
  return encodeURIComponent(JSON.stringify(edits));
}

const isId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;

type Guard<T> = (value: unknown) => value is T;

function isVersioned<T extends D, D = T>(value: unknown, isContent: Guard<T>, isDraft: Guard<D>): value is Versioned<T, D> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Versioned<unknown>;
  if (v.state === "draft") return isDraft(v.draft);
  return v.state === "published" && isContent(v.published) && (v.draft === null || isContent(v.draft));
}

/**
 * The edits in the cookie; none when it is absent or not one this code wrote,
 * with every saved version passing `isContent`, or, for the draft of a
 * never-published item, `isDraft` (`Versioned`).
 */
export function parseContentEdits<T extends D, D = T>(
  value: string | undefined,
  isContent: Guard<T>,
  isDraft: Guard<D> = isContent,
): ContentEdits<T, D> {
  if (!value) return NO_CONTENT_EDITS;
  try {
    return contentEditsFrom(JSON.parse(decodeURIComponent(value)), isContent, isDraft);
  } catch {
    return NO_CONTENT_EDITS;
  }
}

/** Edits read back from a cookie's parsed JSON; none unless every part is one this code wrote. */
export function contentEditsFrom<T extends D, D = T>(
  value: unknown,
  isContent: Guard<T>,
  isDraft: Guard<D> = isContent,
): ContentEdits<T, D> {
  if (typeof value !== "object" || value === null) return NO_CONTENT_EDITS;
  const wire = value as Partial<ContentEdits<unknown>>;
  const saved = Array.isArray(wire.saved) ? wire.saved : [];
  const removed = Array.isArray(wire.removed) ? wire.removed : [];
  const order = Array.isArray(wire.order) ? wire.order : [];
  if (
    !saved.every((item) => isId(item?.id) && Number.isSafeInteger(item.siteOrder) && isVersioned(item.version, isContent, isDraft)) ||
    !removed.every(isId) ||
    !order.every((o) => Array.isArray(o) && o.length === 2 && isId(o[0]) && Number.isSafeInteger(o[1]))
  ) {
    return NO_CONTENT_EDITS;
  }
  return { saved: saved as ContentItem<T, D>[], removed, order };
}

export const PREVIEW_FULL = "This preview keeps only a few changes. Sign out to start over.";

/** A test developer's store: also says, without keeping anything, whether their cookie can hold a list. */
export interface DummyContentStore<T> extends MemoryContentStore<T> {
  /** Why the cookie cannot hold `items` (it is full); null when it can. */
  refusal(items: readonly ContentItem<T>[]): string | null;
}

/**
 * The test developer's items: the seed with their edits, in a store that
 * keeps each write in their cookie, and refuses one the cookie cannot hold.
 */
export function dummyContentStore<T>(
  seed: readonly ContentItem<T>[],
  edits: ContentEditsStore<T>,
  kept?: (version: Versioned<T>) => Versioned<T>,
): DummyContentStore<T> {
  const refusal = (items: readonly ContentItem<T>[]) =>
    serializeContentEdits(contentEditsOf(seed, items, kept)).length > DUMMY_STATE_COOKIE_BYTES ? PREVIEW_FULL : null;
  const store = memoryContentStore(withContentEdits(seed, edits.current), async (items) => {
    const refused = refusal(items);
    if (refused !== null) return refused;
    await edits.save(contentEditsOf(seed, items, kept));
    return null;
  });
  return { ...store, refusal };
}
