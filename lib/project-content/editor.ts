import { contentEditor, type ContentEditor, type ContentStore } from "@/lib/content/editor";
import { maySiteContent, SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import type { ContentItem, PublishStep } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { checkImageUpload, checkPhotoUpload, filesNoLongerShown, freeingFiles, isPhotoSrc, isSitePhotoSrc, type PhotoFiles } from "@/lib/outreach-photos";
import type { PhotoSrc } from "@/lib/outreach-types";
import { editedLine, type EditStamp } from "./edited";
import { checkProjectFields, heldPhotos, type ProjectFields } from "./fields";
import { listPhotos } from "./list-fields";
import { checkNewProject, takenSlugs, type NewProject } from "./new-project";
import { BACKGROUND_MAX_BYTES, backgroundUploads, isUploadedSrc, type ProjectRecord, type UploadedSrc } from "./record";

// The projects' editor (issues #255, #297 and #298): the shared content
// editor (lib/content/editor.ts), so the site-content gate, the draft and
// publish rules and the site order are the ones every content type has, plus
// the Edit <project> panel's save and the dashboard Projects page's list.
// Each side of the dashboard brings its store and its edit history: the
// database and its audit log, or, in tests, a cookie over the dummy
// projects, seen from the dummy team's moment. Photos of a launch or of the
// gallery (issue #299) are uploaded the way Outreach's are
// (lib/outreach-photos.ts): stored at once behind the gate, put on the
// project by a save, and deleted once no version of any project shows them
// and the panel holds them no more. An uploaded background's two crops
// (issue #529) take the same path through their own files, kept apart from
// the photos': a save takes a background crop only from them.

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

/** The uploaded files a project's version holds: its visual's and its blocks' photos, a hidden block's included, and its uploaded background's crops. */
const photosIn = (record: ProjectRecord): PhotoSrc[] => [...listPhotos(record).filter(isPhotoSrc), ...backgroundUploads(record.background)];

/** `files`, never deleting the photos in `held`. */
function keeping(files: Pick<PhotoFiles, "drop">, held: readonly string[]): Pick<PhotoFiles, "drop"> {
  const kept = new Set(held);
  return { drop: (srcs) => files.drop(srcs.filter((src) => !kept.has(src))) };
}

/** Photo files and background files as one: a file is this side's when either stored it, and each deletes only its own. */
function eitherFiles(photos: PhotoFiles, backgrounds: PhotoFiles): Pick<PhotoFiles, "owns" | "drop"> {
  return {
    owns: (src): src is PhotoSrc => photos.owns(src) || backgrounds.owns(src),
    drop: async (srcs) => {
      await Promise.all([photos.drop(srcs), backgrounds.drop(srcs)]);
    },
  };
}

/**
 * The record, or why not: an uploaded background's crops are the ones the
 * version the panel opened on had, or files this side stored as backgrounds
 * (issue #529). A save cannot point a background at a photo, a file the site
 * ships or a file somewhere else.
 */
export function checkBackgroundFiles(record: ProjectRecord, opened: ProjectRecord, backgrounds: Pick<PhotoFiles, "owns">): WriteResult<ProjectRecord> {
  const known = new Set<string>(backgroundUploads(opened.background));
  const stray = backgroundUploads(record.background).find((src) => !known.has(src) && !backgrounds.owns(src));
  return stray === undefined ? written(record) : refused("The background was not uploaded. Upload it again.");
}

/**
 * The record, or why not: each photo is one the version the panel opened on
 * had, a file this side stored, or a file the site ships (issue #371). A save
 * cannot point a project at a file somewhere else.
 */
export function checkProjectPhotos(record: ProjectRecord, opened: ProjectRecord, files: Pick<PhotoFiles, "owns">): WriteResult<ProjectRecord> {
  const known = new Set(listPhotos(opened));
  const stray = listPhotos(record).find((src) => !known.has(src) && !files.owns(src) && !isSitePhotoSrc(src));
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
  /**
   * A photo or a background crop removed in the panel before any save used
   * it: its file is deleted, unless a version of a project shows it.
   */
  discardPhoto(src: string): Promise<WriteResult<null>>;
  /**
   * One crop of a background picked in the panel (board 93f, issue #529):
   * a JPEG, PNG or WebP file of at most 10 MB, read from its own bytes,
   * stored under the backgrounds' own folder once the gate admits the
   * viewer; answers its src.
   */
  uploadBackground(crop: Upload): Promise<WriteResult<UploadedSrc>>;
}

export function projectEditor(
  viewer: ViewerStanding,
  store: ContentStore<ProjectRecord>,
  history: EditHistory = NO_EDIT_HISTORY,
  files: PhotoFiles = NO_PHOTO_FILES,
  backgrounds: PhotoFiles = NO_PHOTO_FILES,
): ProjectEditor {
  const allowed = maySiteContent(viewer);
  const stored = eitherFiles(files, backgrounds);
  const editor = contentEditor(viewer, freeingFiles(store, stored, photosIn));
  return {
    ...editor,
    saveFields(id, step, fields) {
      // A block's fields stay in the panel, photos and all, hidden or not,
      // so this save deletes none of the files the fields still hold.
      const saving = contentEditor(viewer, freeingFiles(store, keeping(stored, heldPhotos(fields)), photosIn));
      return saving.save(id, step, async (opened) => {
        if (opened === null) return refused("Unknown project.");
        const record = checkProjectFields(fields, opened);
        if (!record.ok) return record;
        const photos = checkProjectPhotos(record.value, opened, files);
        return photos.ok ? checkBackgroundFiles(photos.value, opened, backgrounds) : photos;
      });
    },
    create: (project) =>
      editor.save(null, "save-draft", async () => checkNewProject(project, takenSlugs(await store.list()), history.now().getUTCFullYear())),

    async board() {
      // The stamps need nothing of the items, so both are read at once (issue #397).
      const [items, stamps] = await Promise.all([editor.list(), history.stamps()]);
      if (items === null) return null;
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
      if (!stored.owns(src)) return written(null);
      await stored.drop(filesNoLongerShown([src], await store.list(), photosIn));
      return written(null);
    },

    async uploadBackground(upload) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const crop = checkImageUpload(upload, BACKGROUND_MAX_BYTES, "background");
      if (!crop.ok) return crop;
      const src = await backgrounds.put(crop.value);
      return isUploadedSrc(src) ? written(src) : refused("The background could not be stored. Try again.");
    },
  };
}
