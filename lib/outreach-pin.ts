import { publicVersion } from "@/lib/content/versioned";
import { written, type WriteResult } from "@/lib/dashboard/write";
import { postsWithPages, slugOf, type FeaturedCard } from "@/lib/outreach";
import type { OutreachContent, PostItem } from "@/lib/outreach-types";

// Pin to top and Unpin on the edit shell's Outreach list (issue #431). The
// list menu on /dashboard/outreach pins a post from its row (issue #392); the
// on-page editor offers the same two moves on the cards themselves: Unpin on
// the Featured card, Pin to top on every other card. Both go through the same
// server actions and the outreach editor's gate (lib/outreach-editor.ts), so
// the rules are one: only a published post is pinned, at most one at a time,
// and pinning another post unpins the one before.

/** The published posts' ids, by the address their cards link to: how a card on the list names the post it pins. */
export type PinIds = Readonly<Record<string, number>>;

/** What the editor is handed to pin from the page: the pinned post's id, or null, and every published post's id. */
export type PinState = { readonly pinned: number | null; readonly ids: PinIds };

export function pinStateOf(items: readonly PostItem[], pinned: number | null): PinState {
  const ids = Object.fromEntries(
    items.flatMap((item) => {
      const live = publicVersion(item.version);
      return live === null ? [] : [[slugOf(live), item.id] as const];
    }),
  );
  return { pinned, ids };
}

/**
 * What the public pages show once the post `pinned` is the one pinned, or
 * none is: that post leaves the list for the Featured card, and the post
 * pinned before it goes back to the list. The editor keeps each move's answer
 * on its page this way, as the list on /dashboard/outreach keeps its rows.
 */
export function withPinned(content: OutreachContent, ids: PinIds, pinned: number | null): OutreachContent {
  const all = postsWithPages(content);
  const top = pinned === null ? undefined : all.find((post) => ids[slugOf(post)] === pinned);
  return { ...content, pinned: top ?? null, posts: all.filter((post) => post !== top) };
}

/** Why a post never published offers no pin, as the list menu says it. */
export const PIN_LOCKED = "Publish the post before you pin it.";

/** What a card's pin control does: pin its post, unpin the Featured card's, or nothing yet, and why. */
export type CardPin =
  | { readonly kind: "pin"; readonly id: number; readonly title: string }
  | { readonly kind: "unpin"; readonly title: string }
  | { readonly kind: "locked"; readonly title: string; readonly reason: string };

/** A pin move the server is asked for. */
export type PinMove = Exclude<CardPin, { kind: "locked" }>;

/** The post being edited: its id, and whether a version of it is on the site. */
export type EditedPost = { readonly id: number; readonly live: boolean };

/**
 * Pin to top on a card under the Featured card. The card being edited pins
 * the post being edited, whose card may carry a draft's new title, so it goes
 * by the post's own id and stays locked until the post is published. Every
 * other card is a published post, found by its address; a card with no id
 * offers nothing.
 */
export function listedCardPin(card: { readonly slug: string; readonly title: string }, edited: EditedPost | null, ids: PinIds): CardPin | null {
  if (edited !== null) return edited.live ? { kind: "pin", id: edited.id, title: card.title } : { kind: "locked", title: card.title, reason: PIN_LOCKED };
  const id = ids[card.slug];
  return id === undefined ? null : { kind: "pin", id, title: card.title };
}

/** Unpin on the Featured card while it shows a pinned post; the summit alone has nothing to unpin. */
export function featuredCardPin(feature: FeaturedCard): CardPin | null {
  return feature.slug === null ? null : { kind: "unpin", title: feature.title };
}

/**
 * What opening the Featured card does: Title and details, where the card
 * summary lives, while the pinned post is the one being edited; otherwise the
 * pinned post's own editor. The summit alone opens nothing here.
 */
export type FeaturedOpen = { readonly kind: "details" } | { readonly kind: "editor"; readonly href: `/dashboard/outreach/${string}` };

export function featuredOpen(feature: FeaturedCard, editingPinned: boolean): FeaturedOpen | null {
  if (feature.slug === null) return null;
  return editingPinned ? { kind: "details" } : { kind: "editor", href: `/dashboard/outreach/${feature.slug}` };
}

/** The pin and unpin writes: the server actions, or the outreach editor itself in tests. */
export type PinWrites = {
  readonly pin: (id: number) => Promise<WriteResult<null>>;
  readonly unpin: () => Promise<WriteResult<null>>;
};

/** Runs a move and says what changed, in the list menu's words; a refusal comes back as it is. */
export async function runPinMove(move: PinMove, writes: PinWrites): Promise<WriteResult<string>> {
  const result = move.kind === "pin" ? await writes.pin(move.id) : await writes.unpin();
  if (!result.ok) return result;
  return written(move.kind === "pin" ? `${move.title} is pinned to the top of the Outreach page.` : `${move.title} is back in the post list.`);
}
