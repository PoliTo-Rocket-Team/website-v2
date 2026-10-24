import { contentEditor, type ContentStore } from "@/lib/content/editor";
import { maySiteContent, SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import {
  afterStep,
  editorVersion,
  publicItems,
  statusOf,
  type ContentItem,
  type ContentStatus,
  type PublishStep,
  type Versioned,
  versionRows,
} from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { checkPhotoUpload, type CheckedPhoto } from "@/lib/outreach-photos";
import { advisorWritesOf, type AdvisorItem, type AdvisorWrite } from "./advisors";
import {
  applyLayer,
  ARC_FULL,
  ARC_LEADERS,
  isTeamPageLayer,
  layerPhotos,
  leadersOnArc,
  NO_TEAM_LAYER,
  resetLayer,
  type OwnsUpload,
  type TeamBuild,
  type TeamPageLayer,
} from "./team-layer";
import { editedTeamPage } from "./team-page-edit";
import {
  emptySectionOf,
  headsShown,
  HEADS_SHOWN_MAX,
  teamBuildOf,
  teamPageFromRoles,
  withLayerText,
  type TeamPageSection,
  type TeamRoles,
} from "./team-roles";
import type { PersonPhoto, TeamPage } from "./types";

// The Team page's visual layer as the editor reads and writes it (issue
// #283): one document in the shared content store (lib/content/), with a
// published version /about/the-team lays on the roles build and an optional
// draft. Save draft and Reset to team never reach the public page; Publish
// does. Every write passes the site-content gate (lib/content/gate.ts) first.
// Save draft and Publish write the layer and the advisor list (./advisors.ts)
// together, in one step of the store, so the live page never shows a new
// layer with old advisors (issue #321); Reset to team writes the layer alone.
// None of them writes a role, division, department, scope or member. A photo
// picked with Replace photo (issue #323), or uploaded as the group photo
// (issue #510), is stored the moment it is picked,
// behind the same gate, and reaches the page only when Save draft or Publish
// carries its src. Once a write lands, each uploaded photo it left unused by
// every stored layer version and advisor row is deleted, best-effort, so a
// failed delete never fails the write. Both sides of the dashboard data
// interface build it, each with its own store, its own roles and its own
// photo files.

/** The layer the public page lays on: the published version, or none. */
export function publishedLayer(items: readonly ContentItem<TeamPageLayer>[]): TeamPageLayer {
  return publicItems(items)[0] ?? NO_TEAM_LAYER;
}

/**
 * The public Team page: the roles build with the published layer laid on;
 * `base` with the layer's intro text and group photo when the roles cannot
 * fill the page. A draft never reaches it.
 */
export function publicTeamPage(roles: TeamRoles, base: TeamPage, items: readonly ContentItem<TeamPageLayer>[]): TeamPage {
  const layer = publishedLayer(items);
  return teamPageFromRoles(roles, base, layer) ?? withLayerText(base, layer);
}

/**
 * What the editor opens on: the layer it edits (the draft, else the published
 * one) and the page with it laid on, with the roles build and the hand-typed
 * record under it, so the editor lays each change on as it is made
 * (`editedTeamPage`, ./team-page-edit.ts).
 */
export type TeamPageOpening = {
  /** Null before anything was saved. */
  readonly status: ContentStatus | null;
  readonly layer: TeamPageLayer;
  readonly page: TeamPage;
  readonly build: TeamBuild;
  readonly base: TeamPage;
};

/**
 * Where the Team page's layer and advisors are kept. Save draft and Publish
 * go through `save` alone, so the layer and the advisors land together.
 */
export interface TeamPageStore {
  /** The layer document: one item at most, none before the first save. Reset to team writes it alone. */
  readonly layer: ContentStore<TeamPageLayer>;
  /** Every advisor, as ./advisors.ts keeps them. */
  advisors(): Promise<readonly AdvisorItem[]>;
  /**
   * The layer document's versions become `layer` and every advisor write
   * lands, in one step: on a refusal or a failure nothing is written, and
   * the layer and the advisors stay as they were.
   */
  save(layer: Versioned<TeamPageLayer>, advisors: readonly AdvisorWrite[]): Promise<WriteResult<null>>;
}

/**
 * Where a photo uploaded from Replace photo is kept: the public store, or, in
 * tests, a stand-in. Either way `put` answers a src the
 * layer and the advisor rows take: a `/team/` path or an `https://` URL.
 */
export interface TeamPagePhotos {
  put(photo: CheckedPhoto): Promise<PersonPhoto>;
  /** Whether a remote URL is a file `put` stored, so a layer may keep it as the group photo (issue #510). */
  readonly owns: OwnsUpload;
  /**
   * Deletes the files of these photos that `put` stored; any other photo (a
   * `/team/` path, a member's own picture) is left alone. A failed delete is
   * logged, never thrown: the write it follows has already landed.
   */
  drop(photos: readonly PersonPhoto[]): Promise<void>;
}

/** Every photo the stored layer versions and advisor versions show. */
export function photosInUse(layer: readonly ContentItem<TeamPageLayer>[], advisors: readonly AdvisorItem[]): Set<PersonPhoto> {
  const layers = layer.flatMap((item) => versionRows(item.version).flatMap((row) => layerPhotos(row.content)));
  const rows = advisors.flatMap((item) => versionRows(item.version).flatMap((row) => row.content.photo ?? []));
  return new Set([...layers, ...rows]);
}

/** Of the photos in use before a write, those no stored version uses after it, so their files may go. */
export function photosNoLongerUsed(before: ReadonlySet<PersonPhoto>, after: ReadonlySet<PersonPhoto>): PersonPhoto[] {
  return [...before].filter((photo) => !after.has(photo));
}

/** What a Save draft or Publish answers: the layer's versions and the advisors, as stored. */
export type TeamPageSaved = { readonly layer: Versioned<TeamPageLayer>; readonly advisors: readonly AdvisorItem[] };

export interface TeamPageEditor {
  /** Null for a viewer without site-content access. */
  open(): Promise<TeamPageOpening | null>;
  /** Save draft or Publish the whole layer and the Advisors panel's rows, as the editor sent them; either both land or neither. */
  save(step: PublishStep, layer: unknown, advisors: unknown): Promise<WriteResult<TeamPageSaved>>;
  /** Reset to team (board 80h): a draft with every edit gone except the intro text, its figures and the group photo. */
  reset(): Promise<WriteResult<Versioned<TeamPageLayer>>>;
  /** A photo cropped in a panel's Replace photo, stored at once; answers the src a save puts on the person or advisor. */
  uploadPhoto(photo: Upload): Promise<WriteResult<PersonPhoto>>;
}

export const NOT_A_LAYER = "The page changed in a way it cannot keep. Reload and try again.";

/** Why a save is refused when the layer leaves a section the page always draws empty. */
export const SECTION_EMPTY: Readonly<Record<TeamPageSection, string>> = {
  leader: "Keep the team leader on the page.",
  arc: "Keep at least one leader on the arc.",
  departments: "Keep at least one department head on the page.",
  core: "Keep at least one core member on the page.",
};

export const HEADS_FULL = `The departments area shows up to ${HEADS_SHOWN_MAX} heads.`;

/**
 * Why the page cannot be drawn as `layer` edits it; null when it can. The
 * limits bind what the layer does, not what the roles alone do: the roles may
 * put more than eight on the arc or more heads than the carousel shows (the
 * page then shows the first ones), and may leave a section empty (the page
 * then shows the hand-typed record), but the layer may not add past a limit,
 * and may not empty a section the roles fill, which would bring the
 * hand-typed record back without a word.
 */
export function layerRefusal(build: TeamBuild, base: TeamPage, layer: TeamPageLayer): string | null {
  if (leadersOnArc(build, layer) > Math.max(ARC_LEADERS, leadersOnArc(build, NO_TEAM_LAYER))) return ARC_FULL;
  const shown = applyLayer(build, layer);
  const roles = applyLayer(build, NO_TEAM_LAYER);
  const empty = emptySectionOf(build, shown, base);
  if (empty !== null && emptySectionOf(build, roles, base) === null) return SECTION_EMPTY[empty];
  if (headsShown(shown) > Math.max(HEADS_SHOWN_MAX, headsShown(roles))) return HEADS_FULL;
  return null;
}

export function teamPageEditor(
  viewer: ViewerStanding,
  store: TeamPageStore,
  roles: () => Promise<TeamRoles>,
  base: TeamPage,
  photos: TeamPagePhotos,
): TeamPageEditor {
  const editor = contentEditor(viewer, store.layer);
  /** The one document's id; null before the first save. */
  const documentId = async () => (await store.layer.list())[0]?.id ?? null;
  const versionOf = (result: WriteResult<ContentItem<TeamPageLayer>>): WriteResult<Versioned<TeamPageLayer>> =>
    result.ok ? written(result.value.version) : result;

  return {
    async open() {
      // The roles need nothing of the layer, so both are read at once (issue #397).
      const [items, teamRoles] = await Promise.all([editor.list(), roles()]);
      if (items === null) return null;
      const version = items[0]?.version ?? null;
      const layer = version === null ? NO_TEAM_LAYER : editorVersion(version);
      const build = teamBuildOf(teamRoles);
      return { status: version === null ? null : statusOf(version), layer, page: editedTeamPage(build, base, layer).page, build, base };
    },

    async save(step, layer, advisors) {
      if (!maySiteContent(viewer)) return refused(SITE_CONTENT_REFUSAL);
      if (!isTeamPageLayer(layer, photos.owns)) return refused(NOT_A_LAYER);
      const refusal = layerRefusal(teamBuildOf(await roles()), base, layer);
      if (refusal !== null) return refused(refusal);
      const writes = advisorWritesOf(await store.advisors(), step, advisors);
      if (!writes.ok) return writes;
      const items = await store.layer.list();
      const before = photosInUse(items, await store.advisors());
      const version = afterStep(items[0]?.version ?? null, layer, step);
      const saved = await store.save(version, writes.value);
      if (!saved.ok) return saved;
      const advisorsNow = await store.advisors();
      await photos.drop(photosNoLongerUsed(before, photosInUse(await store.layer.list(), advisorsNow)));
      return written({ layer: version, advisors: advisorsNow });
    },

    async reset() {
      const advisors = await store.advisors();
      const before = photosInUse(await store.layer.list(), advisors);
      const result = await editor.save(await documentId(), "save-draft", async (current) => written(resetLayer(current ?? NO_TEAM_LAYER)));
      if (result.ok) await photos.drop(photosNoLongerUsed(before, photosInUse(await store.layer.list(), advisors)));
      return versionOf(result);
    },

    async uploadPhoto(upload) {
      if (!maySiteContent(viewer)) return refused(SITE_CONTENT_REFUSAL);
      const photo = checkPhotoUpload(upload);
      return photo.ok ? written(await photos.put(photo.value)) : photo;
    },
  };
}
