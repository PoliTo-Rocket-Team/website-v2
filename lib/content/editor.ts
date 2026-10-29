import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, type WriteResult } from "@/lib/dashboard/write";
import { maySiteContent, SITE_CONTENT_REFUSAL } from "./gate";
import { nextSiteOrder, reorderedSlots, type SiteSlot } from "./order";
import { afterStep, afterUnfinishedDraft, editorVersion, unpublished, type ContentItem, type PublishStep, type Versioned } from "./versioned";

// One content type's editor (issue #256): the reads and writes a dashboard
// content page makes, behind the site-content gate (./gate.ts), with the
// publish step of ./versioned.ts. A content type brings its own store (the
// database, or one held in memory in tests) and its own field checks; the
// gate, the draft and publish rules and the site order are the same for all.
// `D` is what a never-published item's draft may be (`Versioned`).

/**
 * Where one content type's items are kept: the database, or, in tests, one
 * held in memory (./memory.ts). A write answers why when the store cannot
 * take it.
 */
export interface ContentStore<T extends D, D = T> {
  list(): Promise<readonly ContentItem<T, D>[]>;
  /** A new item at `siteOrder`, answered as stored. */
  create(version: Versioned<T, D>, siteOrder: number): Promise<WriteResult<ContentItem<T, D>>>;
  /**
   * The item's versions become `version`; its place in the site order stays.
   * `expected` is the versions the write was made on: when the stored ones
   * are no longer those, another save landed in between, and the write is
   * refused with `CHANGED_SINCE_READ` and changes nothing (issue #831).
   */
  update(id: number, version: Versioned<T, D>, expected: Versioned<T, D>): Promise<WriteResult<ContentItem<T, D>>>;
  remove(id: number): Promise<WriteResult<null>>;
  setOrder(slots: readonly SiteSlot[]): Promise<WriteResult<null>>;
}

export interface ContentEditor<T extends D, D = T> {
  /** Every item, in site order; null for a viewer the gate refuses. */
  list(): Promise<readonly ContentItem<T, D>[] | null>;
  /**
   * Save draft or Publish on one item, or a new one (`id` null). `prepare`
   * turns what the browser sent into the content, given the version the
   * panel opened on; it runs only once the gate has let the viewer through,
   * so nothing they sent is stored (a logo file, say) before that.
   */
  save(id: number | null, step: PublishStep, prepare: (current: D | null) => Promise<WriteResult<T>>): Promise<WriteResult<ContentItem<T, D>>>;
  /**
   * Save draft with content that is not whole yet, on a new item (`id` null)
   * or one never published (board 74f). Refused on a published item, whose
   * draft changes go through `save`.
   */
  saveUnfinished(id: number | null, prepare: (current: D | null) => Promise<WriteResult<D>>): Promise<WriteResult<ContentItem<T, D>>>;
  remove(id: number): Promise<WriteResult<null>>;
  /** Unpublish: the item leaves the public site and stays as a draft (`unpublished`). */
  unpublish(id: number): Promise<WriteResult<ContentItem<T, D>>>;
  /** One group's items, in the order of `ids`. A group is read from the version the editor shows. */
  reorder(inGroup: (content: D) => boolean, ids: readonly number[]): Promise<WriteResult<null>>;
}

/** Why a write made on versions another save has since replaced is refused. */
export const CHANGED_SINCE_READ = "Someone else saved this in the meantime. Reload the page and make your change again.";

export function contentEditor<T extends D, D = T>(viewer: ViewerStanding, store: ContentStore<T, D>): ContentEditor<T, D> {
  const allowed = maySiteContent(viewer);
  const ordered = async () => [...(await store.list())].sort((a, b) => a.siteOrder - b.siteOrder);
  const gone = "This item was removed. Reload the page.";

  /** The item `id` names among `items`: null for a new one, undefined when it is gone. */
  const find = (items: readonly ContentItem<T, D>[], id: number | null) => (id === null ? null : items.find((item) => item.id === id));

  return {
    list: async () => (allowed ? ordered() : null),

    async save(id, step, prepare) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const items = await ordered();
      const current = find(items, id);
      if (current === undefined) return refused(gone);
      const content = await prepare(current === null ? null : editorVersion(current.version));
      if (!content.ok) return content;
      const version = afterStep(current?.version ?? null, content.value, step);
      return current === null ? store.create(version, nextSiteOrder(items)) : store.update(current.id, version, current.version);
    },

    async saveUnfinished(id, prepare) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const items = await ordered();
      const current = find(items, id);
      if (current === undefined) return refused(gone);
      if (current !== null && current.version.state === "published") return refused("This item is on the site. Its draft must be complete.");
      const content = await prepare(current === null ? null : editorVersion(current.version));
      if (!content.ok) return content;
      const version = afterUnfinishedDraft(current?.version ?? null, content.value);
      if (version === null) return refused("This item is on the site. Its draft must be complete.");
      return current === null ? store.create(version, nextSiteOrder(items)) : store.update(current.id, version, current.version);
    },

    async remove(id) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      if (!(await store.list()).some((item) => item.id === id)) return refused(gone);
      return store.remove(id);
    },

    async unpublish(id) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const current = (await store.list()).find((item) => item.id === id);
      if (current === undefined) return refused(gone);
      const version = unpublished(current.version);
      return version === null ? refused("This item is not on the site.") : store.update(id, version, current.version);
    },

    async reorder(inGroup, ids) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const slots = reorderedSlots(await ordered(), (item) => inGroup(editorVersion(item.version)), ids);
      return slots.ok ? store.setOrder(slots.value) : slots;
    },
  };
}
