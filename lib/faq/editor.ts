import { contentEditor, type ContentStore } from "@/lib/content/editor";
import type { ContentItem, PublishStep } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { written, type WriteResult } from "@/lib/dashboard/write";
import { checkFaqFields, type FaqFields, type FaqVersion } from "./faq";

// The FAQ page's reads and writes (boards 79 and 79b, issue #258): the shared
// content editor (lib/content/editor.ts) with the question's own fields. The
// dashboard data interface builds it with the database's store and the time
// now; a test brings its own store and clock.

/** The list as the page opens it: every question, and the moment its Updated column counts from. */
export type FaqList = { readonly items: readonly ContentItem<FaqVersion>[]; readonly now: string };

export interface FaqEditor {
  /** Every question as the editor sees it, in site order; null for a viewer without site-content access. */
  list(): Promise<FaqList | null>;
  /** Save draft or Publish (`id` null: New question). The version is dated now. */
  save(id: number | null, step: PublishStep, fields: FaqFields): Promise<WriteResult<ContentItem<FaqVersion>>>;
  remove(id: number): Promise<WriteResult<null>>;
  /** Every question in its new order, as dragged. */
  reorder(ids: readonly number[]): Promise<WriteResult<null>>;
}

export function faqEditor(viewer: ViewerStanding, store: ContentStore<FaqVersion>, now: () => Date): FaqEditor {
  const editor = contentEditor(viewer, store);
  return {
    async list() {
      const items = await editor.list();
      return items === null ? null : { items, now: now().toISOString() };
    },
    save: (id, step, fields) =>
      editor.save(id, step, async () => {
        const faq = checkFaqFields(fields);
        return faq.ok ? written({ ...faq.value, updatedAt: now().toISOString() }) : faq;
      }),
    remove: (id) => editor.remove(id),
    reorder: (ids) => editor.reorder(() => true, ids),
  };
}
