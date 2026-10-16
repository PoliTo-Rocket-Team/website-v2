import { contentEditor, type ContentEditor, type ContentStore } from "@/lib/content/editor";
import { maySiteContent, SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import type { ContentItem, PublishStep } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { checkPhotoUpload, filesNoLongerShown, freeingFiles, isPhotoSrc, type PhotoFiles } from "@/lib/outreach-photos";
import type { PhotoSrc } from "@/lib/outreach-types";
import { editedLine, type EditStamp } from "./edited";
import { checkProjectFields, type ProjectFields } from "./fields";
import { heldPhotos, listPhotos } from "./list-fields";
import { checkNewProject, takenSlugs, type NewProject } from "./new-project";
import type { ProjectRecord } from "./record";

// The projects' editor (issues #255, #297 and #298): the shared content
// editor (lib/content/editor.ts), so the site-content gate, the draft and
// publish rules and the site order are the ones every content type has, plus
// the Edit <project> panel's save and the dashboard Projects page's list.
// Each side of the dashboard brings its store and its edit history: the
// database and its audit log, or a test developer's cookie over the dummy
// projects, seen from the dummy team's moment. Photos of a launch or of the
// gallery (issue #299) are uploaded the way Outreach's are
// (lib/outreach-photos.ts): stored at once behind the gate, put on the
// project by a save, and deleted once no version of any project shows them
// and the panel holds them no more.

/** When each project was last edited and by whom, and the moment the list counts "today" from. */
export interface EditHistory {
  stamps(): Promise<ReadonlyMap<number, EditStamp>>;
  now(): Date;
}

/** No one is named and nothing is dated: for an editor that never shows the list. */
export const NO_EDIT_HISTORY: EditHistory = { stamps: async () => new Map(), now: () => new Date() };

/** No photo uploads: for an editor that never shows the panel's photos. */
export const NO_PHOTO_FILES: PhotoFiles = {
  put: async () => {
    throw new Error("this projects editor takes no photos");
  },
  owns: (src): src is PhotoSrc => false,
  drop: async () => {},
};

/** The uploaded photos a project's version shows: its launches' and its gallery's. */
const photosIn = (record: ProjectRecord): PhotoSrc[] => listPhotos(record).filter(isPhotoSrc);

/** `files`, never deleting the photos in `held`. */
function keeping(files: Pick<PhotoFiles, "drop">, held: readonly string[]): Pick<PhotoFiles, "drop"> {
  const kept = new Set(held);
  return { drop: (srcs) => files.drop(srcs.filter((src) => !kept.has(src))) };
}

/**
 * The record, or why not: each photo is one the version the panel opened on
 * had, or a file this side stored. A save cannot point a project at a file
 * somewhere else.
 */
export function checkProjectPhotos(record: ProjectRecord, opened: ProjectRecord, files: Pick<PhotoFiles, "owns">): WriteResult<ProjectRecord> {
  const known = new Set(listPhotos(opened));
  const stray = listPhotos(record).find((src) => !known.has(src) && !files.owns(src));
  return stray === undefined ? written(record) : refused("A photo was not uploaded. Add it again.");
}

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
  /**
   * New project (issue #301): a stored project whose only version is a draft,
   * last in the site order, so it reaches no public page until it is
   * published. Its address must be one no project holds.
   */
  create(project: NewProject): Promise<WriteResult<ContentItem<ProjectRecord>>>;
  /** The Projects page's list; null for a viewer the site-content gate refuses. */
  board(): Promise<ProjectBoard | null>;
  /** Every project in the order its cards were dragged into: the site order Home and /projects follow. */
  setSiteOrder(ids: readonly number[]): Promise<WriteResult<null>>;
  /** A photo picked in the panel, stored once the gate admits the viewer; answers its src. */
  uploadPhoto(photo: Upload): Promise<WriteResult<PhotoSrc>>;
  /** A photo removed in the panel before any save used it: its file is deleted, unless a version of a project shows it. */
  discardPhoto(src: string): Promise<WriteResult<null>>;
}

export function projectEditor(
  viewer: ViewerStanding,
  store: ContentStore<ProjectRecord>,
  history: EditHistory = NO_EDIT_HISTORY,
  files: PhotoFiles = NO_PHOTO_FILES,
): ProjectEditor {
  const allowed = maySiteContent(viewer);
  const editor = contentEditor(viewer, freeingFiles(store, files, photosIn));
  return {
    ...editor,
    saveFields(id, step, fields) {
      // A section switched off leaves the record but stays in the panel, photos
      // and all, so this save deletes none of the files the fields still hold.
      const saving = contentEditor(viewer, freeingFiles(store, keeping(files, heldPhotos(fields)), photosIn));
      return saving.save(id, step, async (opened) => {
        if (opened === null) return refused("Unknown project.");
        const record = checkProjectFields(fields, opened);
        return record.ok ? checkProjectPhotos(record.value, opened, files) : record;
      });
    },
    create: (project) =>
      editor.save(null, "save-draft", async () => checkNewProject(project, takenSlugs(await store.list()), history.now().getUTCFullYear())),

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

    async uploadPhoto(upload) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const photo = checkPhotoUpload(upload);
      return photo.ok ? written(await files.put(photo.value)) : photo;
    },

    async discardPhoto(src) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      if (!files.owns(src)) return written(null);
      await files.drop(filesNoLongerShown([src], await store.list(), photosIn));
      return written(null);
    },
  };
}
