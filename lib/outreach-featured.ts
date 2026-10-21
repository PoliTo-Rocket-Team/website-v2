import { publicVersion } from "@/lib/content/versioned";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import { newestFirst, postsWithPages, slugOf, type FeaturedCard } from "@/lib/outreach";
import type { OutreachContent, PostItem, UpToTwo } from "@/lib/outreach-types";

// Featured posts (Owner decision, issue #496). Featured is a setting on any
// published post: a featured post leaves the list on /outreach for its own
// Featured card at the top of the page, and at most two are featured at once.
// The rule lives here and nowhere else: the outreach editor
// (lib/outreach-editor.ts) checks it behind the site-content gate, each store
// checks it again before it writes (lib/dashboard/database-outreach.ts,
// lib/dummy-data/outreach.ts), and the database's two featured slots
// (migration 0048) cannot hold a third. The Outreach list's row menu and the
// edit shell's Outreach list target both move it.

/** The ids of the featured posts: none, one or two, never the same id twice. */
export type FeaturedIds = UpToTwo<number>;

export const NO_FEATURED: FeaturedIds = [];

/** `list` as none, one or two, or null when it holds more. */
export function upToTwo<T>(list: readonly T[]): UpToTwo<T> | null {
  if (list.length > 2) return null;
  return list as UpToTwo<T>;
}

/** Whether the post `id` is one of the featured. */
export function isFeatured(featured: FeaturedIds, id: number): boolean {
  return (featured as readonly number[]).includes(id);
}

/** Ids read from a store as featured ids; null when they are more than two or one repeats. */
export function featuredIdsOf(ids: readonly number[]): FeaturedIds | null {
  if (new Set(ids).size !== ids.length) return null;
  return upToTwo(ids);
}

/** Why a third post is refused. */
export const FEATURED_FULL = "Two posts are featured already. Unfeature one before you feature another.";

/** Why a post never published offers no Feature, as the list menu says it. */
export const FEATURE_LOCKED = "Publish the post before you feature it.";

/** The featured ids once the post `id` is featured too, or why not: two are featured already. Featuring a featured post changes nothing. */
export function featuring(current: FeaturedIds, id: number): WriteResult<FeaturedIds> {
  if (isFeatured(current, id)) return written(current);
  if (current.length === 0) return written([id]);
  if (current.length === 1) return written([current[0], id]);
  return refused(FEATURED_FULL);
}

/** The featured ids once the post `id` is not featured; nothing changes for a post that is not. */
export function unfeaturing(current: FeaturedIds, id: number): FeaturedIds {
  // Fewer ids than before are still two at most.
  return upToTwo((current as readonly number[]).filter((other) => other !== id)) ?? current;
}

/** The database's two places for a featured post (migration 0048): each holds one post at most. */
export type FeaturedSlot = 1 | 2;

/** The lowest slot no post holds, or null while both are held. */
export function freeFeaturedSlot(taken: readonly FeaturedSlot[]): FeaturedSlot | null {
  return ([1, 2] as const).find((slot) => !taken.includes(slot)) ?? null;
}

/** The post `id` may be featured, or why not: it must be in the list and on the site. */
export function checkFeature(id: number, items: readonly PostItem[]): WriteResult<number> {
  const item = items.find((i) => i.id === id);
  if (item === undefined) return refused("This post was removed. Reload the page.");
  if (publicVersion(item.version) === null) return refused(FEATURE_LOCKED);
  return written(id);
}

// The edit shell's Outreach list target (issue #431): each Featured card offers
// Unfeature, and every post card under them offers Feature.

/** The published posts' ids, by the address their cards link to: how a card names the post it moves. */
export type FeatureIds = Readonly<Record<string, number>>;

/** What the editor is handed to feature from the page: the featured posts' ids and every published post's id. */
export type FeatureState = { readonly featured: FeaturedIds; readonly ids: FeatureIds };

export function featureStateOf(items: readonly PostItem[], featured: FeaturedIds): FeatureState {
  const ids = Object.fromEntries(
    items.flatMap((item) => {
      const live = publicVersion(item.version);
      return live === null ? [] : [[slugOf(live), item.id] as const];
    }),
  );
  return { featured, ids };
}

/**
 * What the public pages show once `featured` are the featured posts: they
 * leave the list for the Featured cards, newest first, and a post no longer
 * featured goes back to the list. The editor keeps each move's answer on its
 * page this way, as the list on /dashboard/outreach keeps its rows.
 */
export function withFeatured(content: OutreachContent, ids: FeatureIds, featured: FeaturedIds): OutreachContent {
  const all = postsWithPages(content);
  const shownFeatured = (post: (typeof all)[number]) => {
    const id = ids[slugOf(post)];
    return id !== undefined && isFeatured(featured, id);
  };
  return {
    ...content,
    featured: upToTwo(newestFirst(all.filter(shownFeatured))) ?? [],
    posts: all.filter((post) => !shownFeatured(post)),
  };
}

/** What a card's control does: feature its post, unfeature it, or nothing yet, and why. */
export type CardFeature =
  | { readonly kind: "feature"; readonly id: number; readonly title: string }
  | { readonly kind: "unfeature"; readonly id: number; readonly title: string }
  | { readonly kind: "locked"; readonly title: string; readonly reason: string };

/** A move the server is asked for. */
export type FeatureMove = Exclude<CardFeature, { kind: "locked" }>;

/** The post being edited: its id, and whether a version of it is on the site. */
export type EditedPost = { readonly id: number; readonly live: boolean };

/**
 * Feature on a card under the Featured cards. The card being edited features
 * the post being edited, whose card may carry a draft's new title, so it goes
 * by the post's own id and stays locked until the post is published. Every
 * other card is a published post, found by its address; a card with no id
 * offers nothing. While two posts are featured, Feature is locked with the
 * words the server refuses a third with.
 */
export function listedCardFeature(
  card: { readonly slug: string; readonly title: string },
  edited: EditedPost | null,
  ids: FeatureIds,
  featured: FeaturedIds,
): CardFeature | null {
  const full = featured.length === 2 ? FEATURED_FULL : null;
  if (edited !== null) {
    const reason = edited.live ? full : FEATURE_LOCKED;
    return reason === null ? { kind: "feature", id: edited.id, title: card.title } : { kind: "locked", title: card.title, reason };
  }
  const id = ids[card.slug];
  if (id === undefined) return null;
  return full === null ? { kind: "feature", id, title: card.title } : { kind: "locked", title: card.title, reason: full };
}

/** Unfeature on a Featured card: the post being edited by its own id, any other by its address. */
export function featuredCardFeature(card: FeaturedCard, edited: EditedPost | null, ids: FeatureIds): CardFeature | null {
  const id = edited?.id ?? ids[card.slug];
  return id === undefined ? null : { kind: "unfeature", id, title: card.title };
}

/**
 * What opening a Featured card does: Title and details, where the card
 * summary lives, while its post is the one being edited; otherwise that
 * post's own editor.
 */
export type FeaturedOpen = { readonly kind: "details" } | { readonly kind: "editor"; readonly href: `/dashboard/outreach/${string}` };

export function featuredOpen(card: FeaturedCard, editing: boolean): FeaturedOpen {
  return editing ? { kind: "details" } : { kind: "editor", href: `/dashboard/outreach/${card.slug}` };
}

/** The feature and unfeature writes: the server actions, or the outreach editor itself in tests. */
export type FeatureWrites = {
  readonly feature: (id: number) => Promise<WriteResult<null>>;
  readonly unfeature: (id: number) => Promise<WriteResult<null>>;
};

/** The words a done move is told in, the list menu's and the edit shell's alike. */
export function featureMoveDone(move: FeatureMove): string {
  return move.kind === "feature" ? `${move.title} is featured at the top of the Outreach page.` : `${move.title} is back in the post list.`;
}

/** The featured ids a page keeps once the server took `move`. */
export function featuredAfter(current: FeaturedIds, move: FeatureMove): FeaturedIds {
  if (move.kind === "unfeature") return unfeaturing(current, move.id);
  const next = featuring(current, move.id);
  return next.ok ? next.value : current;
}

/** Runs a move and says what changed; a refusal comes back as it is. */
export async function runFeatureMove(move: FeatureMove, writes: FeatureWrites): Promise<WriteResult<string>> {
  const result = move.kind === "feature" ? await writes.feature(move.id) : await writes.unfeature(move.id);
  return result.ok ? written(featureMoveDone(move)) : result;
}
