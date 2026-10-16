import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import type { ContentItem } from "./versioned";

// The site order of content items (issue #256): an editor drags rows within
// one group (a partner tier, say), and the public pages follow. One number
// per item orders everything; a group keeps the numbers it already held, so
// reordering one group never moves another.

/** One item's new place in the site order. */
export type SiteSlot = { readonly id: number; readonly siteOrder: number };

/** Where a new item goes: after every item there is. */
export function nextSiteOrder(items: readonly { readonly siteOrder: number }[]): number {
  return items.reduce((last, item) => Math.max(last, item.siteOrder), 0) + 1;
}

/**
 * The new site order of one group, with its items in the order of `ids`. The
 * group's items take the slots the group already held, in their order.
 * Refused unless `ids` names each item of the group exactly once: a list the
 * editor saw before someone else added or removed an item is stale.
 */
export function reorderedSlots<T>(
  items: readonly ContentItem<T>[],
  inGroup: (item: ContentItem<T>) => boolean,
  ids: readonly number[],
): WriteResult<SiteSlot[]> {
  const group = items.filter(inGroup);
  const known = new Set(group.map((item) => item.id));
  if (ids.length !== group.length || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) {
    return refused("The list changed since you opened it. Reload the page and try again.");
  }
  const slots = group.map((item) => item.siteOrder).sort((a, b) => a - b);
  return written(ids.map((id, i) => ({ id, siteOrder: slots[i] })));
}

/** `ids` with `id` moved to `index`: what a drag or a "Move up" does to a group's order. */
export function moveTo(ids: readonly number[], id: number, index: number): number[] {
  const from = ids.indexOf(id);
  if (from === -1) return [...ids];
  const rest = ids.filter((other) => other !== id);
  const to = Math.max(0, Math.min(index, rest.length));
  return [...rest.slice(0, to), id, ...rest.slice(to)];
}
