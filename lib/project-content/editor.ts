import { contentEditor, type ContentEditor, type ContentStore } from "@/lib/content/editor";
import type { ContentItem, PublishStep } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, type WriteResult } from "@/lib/dashboard/write";
import { editedLine, type EditStamp } from "./edited";
import { checkProjectFields, type ProjectFields } from "./fields";
import type { ProjectRecord } from "./record";

// The projects' editor (issues #255, #297 and #298): the shared content
// editor (lib/content/editor.ts), so the site-content gate, the draft and
// publish rules and the site order are the ones every content type has, plus
// the Edit <project> panel's save and the dashboard Projects page's list.
// Each side of the dashboard brings its store and its edit history: the
// database and its audit log, or a test developer's cookie over the dummy
// projects, seen from the dummy team's moment.

/** When each project was last edited and by whom, and the moment the list counts "today" from. */
export interface EditHistory {
  stamps(): Promise<ReadonlyMap<number, EditStamp>>;
  now(): Date;
}

/** No one is named and nothing is dated: for an editor that never shows the list. */
export const NO_EDIT_HISTORY: EditHistory = { stamps: async () => new Map(), now: () => new Date() };

/** The dashboard Projects page (board 75): every project in site order, with the line over its card. */
export type ProjectBoard = {
  readonly items: readonly ContentItem<ProjectRecord>[];
  /** The "edited by" line of each project that has one, by id. */
  readonly edited: Readonly<Record<number, string>>;
};

export interface ProjectEditor extends ContentEditor<ProjectRecord> {
  /**
   * Save draft or Publish with the panel's fields on a stored project. The
   * fields are laid over the version the panel opened on (the draft when
   * there is one), and checked again here, whatever the browser checked.
   */
  saveFields(id: number, step: PublishStep, fields: ProjectFields): Promise<WriteResult<ContentItem<ProjectRecord>>>;
  /** The Projects page's list; null for a viewer the site-content gate refuses. */
  board(): Promise<ProjectBoard | null>;
  /** Every project in the order its cards were dragged into: the site order Home and /projects follow. */
  setSiteOrder(ids: readonly number[]): Promise<WriteResult<null>>;
}

export function projectEditor(viewer: ViewerStanding, store: ContentStore<ProjectRecord>, history: EditHistory = NO_EDIT_HISTORY): ProjectEditor {
  const editor = contentEditor(viewer, store);
  return {
    ...editor,
    saveFields: (id, step, fields) =>
      editor.save(id, step, async (opened) => (opened === null ? refused("Unknown project.") : checkProjectFields(fields, opened))),
    async board() {
      const items = await editor.list();
      if (items === null) return null;
      const stamps = await history.stamps();
      const now = history.now().toISOString();
      const edited = Object.fromEntries(
        items.flatMap((item) => {
          const line = editedLine(item, stamps.get(item.id), now);
          return line === null ? [] : [[item.id, line] as const];
        }),
      );
      return { items, edited };
    },
    setSiteOrder: (ids) => editor.reorder(() => true, ids),
  };
}
