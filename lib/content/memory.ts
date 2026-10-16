import { written } from "@/lib/dashboard/write";
import type { ContentStore } from "./editor";
import type { ContentItem } from "./versioned";

/**
 * A content store held in memory, starting from `seed`. Every write hands
 * the new list to `keep`, which may refuse it: tests keep everything, and a
 * preview keeps a test developer's changes in a cookie that can fill up
 * (lib/dummy-data/partners.ts). A refused write changes nothing.
 */
export function memoryContentStore<T extends D, D = T>(
  seed: readonly ContentItem<T, D>[],
  keep: (items: readonly ContentItem<T, D>[]) => Promise<string | null> = async () => null,
): ContentStore<T, D> {
  let items: readonly ContentItem<T, D>[] = seed;
  let lastId = items.reduce((last, item) => Math.max(last, item.id), 0);
  async function apply<V>(next: readonly ContentItem<T, D>[], value: V) {
    const error = await keep(next);
    if (error !== null) return { ok: false as const, error };
    items = next;
    return written(value);
  }
  return {
    list: async () => items,
    async create(version, siteOrder) {
      const item = { id: lastId + 1, siteOrder, version };
      const result = await apply([...items, item], item);
      if (result.ok) lastId = item.id;
      return result;
    },
    async update(id, version) {
      const updated = { ...items.find((item) => item.id === id)!, version };
      return apply(
        items.map((item) => (item.id === id ? updated : item)),
        updated,
      );
    },
    remove: async (id) => apply(items.filter((item) => item.id !== id), null),
    async setOrder(slots) {
      const next = new Map(slots.map((slot) => [slot.id, slot.siteOrder]));
      return apply(
        items.map((item) => ({ ...item, siteOrder: next.get(item.id) ?? item.siteOrder })),
        null,
      );
    },
  };
}
