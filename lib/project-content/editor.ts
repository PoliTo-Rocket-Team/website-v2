import { contentEditor, type ContentEditor, type ContentStore } from "@/lib/content/editor";
import type { ContentItem, PublishStep } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, type WriteResult } from "@/lib/dashboard/write";
import { checkProjectFields, type ProjectFields } from "./fields";
import type { ProjectRecord } from "./record";

// The projects' editor (issues #255 and #298): the shared content editor
// (lib/content/editor.ts), so the site-content gate, the draft and publish
// rules and the site order are the ones every content type has, plus the
// Edit <project> panel's save. Each side of the dashboard brings its store:
// the database, or a test developer's cookie over the dummy projects.

export interface ProjectEditor extends ContentEditor<ProjectRecord> {
  /**
   * Save draft or Publish with the panel's fields on a stored project. The
   * fields are laid over the version the panel opened on (the draft when
   * there is one), and checked again here, whatever the browser checked.
   */
  saveFields(id: number, step: PublishStep, fields: ProjectFields): Promise<WriteResult<ContentItem<ProjectRecord>>>;
}

export function projectEditor(viewer: ViewerStanding, store: ContentStore<ProjectRecord>): ProjectEditor {
  const editor = contentEditor(viewer, store);
  return {
    ...editor,
    saveFields: (id, step, fields) =>
      editor.save(id, step, async (opened) => (opened === null ? refused("Unknown project.") : checkProjectFields(fields, opened))),
  };
}
