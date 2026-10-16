import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, type WriteResult } from "@/lib/dashboard/write";
import { maySiteContent, SITE_CONTENT_REFUSAL } from "./gate";
import { nextSiteOrder, reorderedSlots, type SiteSlot } from "./order";
import { afterStep, editorVersion, type ContentItem, type PublishStep, type Versioned } from "./versioned";

// One content type's editor (issue #256): the reads and writes a dashboard
// content page makes, behind the site-content gate (./gate.ts), with the
// publish step of ./versioned.ts. A content type brings its own store (the
// database, or the dummy data on previews) and its own field checks; the
// gate, the draft and publish rules and the site order are the same for all.

/**
 * Where one content type's items are kept. Each side of the dashboard data
 * interface brings one. A write answers why when the store cannot take it (a
 * preview keeps a test developer's changes in one cookie, which fills up).
 */
export interface ContentStore<T> {
  list(): Promise<readonly ContentItem<T>[]>;
  /** A new item at `siteOrder`, answered as stored. */
  create(version: Versioned<T>, siteOrder: number): Promise<WriteResult<ContentItem<T>>>;
  /** The item's versions become `version`; its place in the site order stays. */
  update(id: number, version: Versioned<T>): Promise<WriteResult<ContentItem<T>>>;
  remove(id: number): Promise<WriteResult<null>>;
  setOrder(slots: readonly SiteSlot[]): Promise<WriteResult<null>>;
}

export interface ContentEditor<T> {
  /** Every item, in site order; null for a viewer the gate refuses. */
  list(): Promise<readonly ContentItem<T>[] | null>;
  /**
   * Save draft or Publish on one item, or a new one (`id` null). `prepare`
   * turns what the browser sent into the content, given the version the
   * panel opened on; it runs only once the gate has let the viewer through,
   * so nothing they sent is stored (a logo file, say) before that.
   */
  save(id: number | null, step: PublishStep, prepare: (current: T | null) => Promise<WriteResult<T>>): Promise<WriteResult<ContentItem<T>>>;
  remove(id: number): Promise<WriteResult<null>>;
  /** One group's items, in the order of `ids`. A group is read from the version the editor shows. */
  reorder(inGroup: (content: T) => boolean, ids: readonly number[]): Promise<WriteResult<null>>;
}

export function contentEditor<T>(viewer: ViewerStanding, store: ContentStore<T>): ContentEditor<T> {
  const allowed = maySiteContent(viewer);
  const ordered = async () => [...(await store.list())].sort((a, b) => a.siteOrder - b.siteOrder);
  const gone = "This item was removed. Reload the page.";

  return {
    list: async () => (allowed ? ordered() : null),

    async save(id, step, prepare) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const items = await ordered();
      const current = id === null ? null : (items.find((item) => item.id === id) ?? null);
      if (id !== null && current === null) return refused(gone);
      const content = await prepare(current === null ? null : editorVersion(current.version));
      if (!content.ok) return content;
      const version = afterStep(current?.version ?? null, content.value, step);
      return current === null ? store.create(version, nextSiteOrder(items)) : store.update(current.id, version);
    },

    async remove(id) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      if (!(await store.list()).some((item) => item.id === id)) return refused(gone);
      return store.remove(id);
    },

    async reorder(inGroup, ids) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const slots = reorderedSlots(await ordered(), (item) => inGroup(editorVersion(item.version)), ids);
      return slots.ok ? store.setOrder(slots.value) : slots;
    },
  };
}
