import type { ContentStore } from "@/lib/content/editor";
import { memoryContentStore } from "@/lib/content/memory";
import type { ContentItem, Versioned } from "@/lib/content/versioned";
import { DUMMY_STATE_COOKIE_BYTES } from "./state";

// A test developer's changes to one content type (issues #256 and #258), on
// previews and in test-developer sessions, which never touch a database. The
// dashboard starts from a seed; what they change is kept in a cookie in their
// own browser, cleared on sign out, as the edits that turn the seed into what
// they see. The public pages never read it. Every content type keeps its
// edits this way, each in its own cookie.

/** What a test developer changed: items saved or created, ids removed, and new places in the site order. */
export type ContentEdits<T> = {
  readonly saved: readonly ContentItem<T>[];
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
export function withContentEdits<T>(seed: readonly ContentItem<T>[], edits: ContentEdits<T>): ContentItem<T>[] {
  const saved = new Map(edits.saved.map((item) => [item.id, item]));
  const order = new Map(edits.order);
  const removed = new Set(edits.removed);
  const fromSeed = seed.filter((item) => !removed.has(item.id)).map((item) => saved.get(item.id) ?? item);
  const created = edits.saved.filter((item) => !seed.some((s) => s.id === item.id));
  return [...fromSeed, ...created].map((item) => ({ ...item, siteOrder: order.get(item.id) ?? item.siteOrder }));
}

/** The edits that turn `seed` into `items`: what the cookie keeps, each saved version passed through `kept`. */
export function contentEditsOf<T>(
  seed: readonly ContentItem<T>[],
  items: readonly ContentItem<T>[],
  kept: (version: Versioned<T>) => Versioned<T> = (version) => version,
): ContentEdits<T> {
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

export function serializeContentEdits<T>(edits: ContentEdits<T>): string {
  return encodeURIComponent(JSON.stringify(edits));
}

const isId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;

function isVersioned<T>(value: unknown, isContent: (value: unknown) => value is T): value is Versioned<T> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Versioned<unknown>;
  if (v.state === "draft") return isContent(v.draft);
  return v.state === "published" && isContent(v.published) && (v.draft === null || isContent(v.draft));
}

/** The edits in the cookie; none when it is absent or not one this code wrote, with every saved version passing `isContent`. */
export function parseContentEdits<T>(value: string | undefined, isContent: (value: unknown) => value is T): ContentEdits<T> {
  if (!value) return NO_CONTENT_EDITS;
  try {
    const wire = JSON.parse(decodeURIComponent(value)) as ContentEdits<unknown>;
    const saved = Array.isArray(wire.saved) ? wire.saved : [];
    const removed = Array.isArray(wire.removed) ? wire.removed : [];
    const order = Array.isArray(wire.order) ? wire.order : [];
    if (
      !saved.every((item) => isId(item?.id) && Number.isSafeInteger(item.siteOrder) && isVersioned(item.version, isContent)) ||
      !removed.every(isId) ||
      !order.every((o) => Array.isArray(o) && o.length === 2 && isId(o[0]) && Number.isSafeInteger(o[1]))
    ) {
      return NO_CONTENT_EDITS;
    }
    return { saved: saved as ContentItem<T>[], removed, order };
  } catch {
    return NO_CONTENT_EDITS;
  }
}

export const PREVIEW_FULL = "This preview keeps only a few changes. Sign out to start over.";

/**
 * The test developer's items: the seed with their edits, in a store that
 * keeps each write in their cookie, and refuses one the cookie cannot hold.
 */
export function dummyContentStore<T>(
  seed: readonly ContentItem<T>[],
  edits: ContentEditsStore<T>,
  kept?: (version: Versioned<T>) => Versioned<T>,
): ContentStore<T> {
  return memoryContentStore(withContentEdits(seed, edits.current), async (items) => {
    const next = contentEditsOf(seed, items, kept);
    if (serializeContentEdits(next).length > DUMMY_STATE_COOKIE_BYTES) return PREVIEW_FULL;
    await edits.save(next);
    return null;
  });
}
