import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import { CHANGED_SINCE_READ, type ContentStore } from "./editor";
import { sameVersions, type ContentItem } from "./versioned";

export interface MemoryContentStore<T extends D, D = T> extends ContentStore<T, D> {
  /** Every item becomes `next` in one write: `keep` takes the whole list or refuses it, and a refusal changes nothing. */
  replace(next: readonly ContentItem<T, D>[]): Promise<WriteResult<null>>;
}

/**
 * A content store held in memory, starting from `seed`. Every write hands
 * the new list to `keep`, which may refuse it, as a test of a failing store
 * does. A refused write changes nothing.
 */
export function memoryContentStore<T extends D, D = T>(
  seed: readonly ContentItem<T, D>[],
  keep: (items: readonly ContentItem<T, D>[]) => Promise<string | null> = async () => null,
): MemoryContentStore<T, D> {
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
    async replace(next) {
      const result = await apply(next, null);
      if (result.ok) lastId = next.reduce((last, item) => Math.max(last, item.id), lastId);
      return result;
    },
    async create(version, siteOrder) {
      const item = { id: lastId + 1, siteOrder, version };
      const result = await apply([...items, item], item);
      if (result.ok) lastId = item.id;
      return result;
    },
    async update(id, version, expected) {
      const stored = items.find((item) => item.id === id);
      if (stored === undefined || !sameVersions(stored.version, expected)) return refused(CHANGED_SINCE_READ);
      const updated = { ...stored, version };
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
