// Site content with drafts as seed rows (issue #305). A content module lists
// its items the way the editor holds them (lib/content/versioned.ts), and
// this turns them into one version row per version each item holds, the
// rows the editor's own writes leave behind.

import { versionRows, type ContentItem, type VersionKind } from "@/lib/content/versioned";

/** One stored version of one item. */
export type ContentVersionRow<T> = { readonly itemId: number; readonly kind: VersionKind; readonly content: T };

export function contentVersionRows<T extends D, D = T>(items: readonly ContentItem<T, D>[]): ContentVersionRow<D>[] {
  return items.flatMap((item) => versionRows(item.version).map(({ kind, content }) => ({ itemId: item.id, kind, content })));
}
