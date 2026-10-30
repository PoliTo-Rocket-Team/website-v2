import { contentEditor, type ContentStore } from "@/lib/content/editor";
import { maySiteContent, SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import {
  afterStep,
  editorVersion,
  mapVersions,
  publicItems,
  sameVersions,
  statusOf,
  type ContentItem,
  type ContentStatus,
  type PublishStep,
  type Versioned,
  versionRows,
} from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { checkPhotoUpload, PHOTO_GONE, type CheckedPhoto } from "@/lib/outreach-photos";
import { advisorsAfter, advisorWritesOf, type AdvisorItem, type AdvisorWrite } from "./advisors";
import {
  applyLayer,
  withLayerPhotos,
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
import { layoutPhotos } from "./team-layout";
import { NO_STORED_TEAM_PAGE, storedTeamPage, storedTeamPageOf, type StoredTeamPage } from "./team-page-stored";
import {
  emptySectionOf,
  headsShown,
  HEADS_SHOWN_MAX,
  teamBuildOf,
  type TeamPageSection,
  type TeamRoles,
} from "./team-roles";
import type { PersonPhoto, TeamPage } from "./types";

// The Team page's visual layer as the editor reads and writes it (issue
// #283): one document in the shared content store (lib/content/), with a
// published version /about/the-team draws and an optional draft. Each
// version is stored with its layout of page seats (./team-page-stored.ts,
// issue #850): the editor still sends a layer, and every write stores it
// with the layout it snapshots to on the roles of that moment, in the same
// write. The public page and the editor's opening page draw the stored
// layout. Save draft and Reset to team never reach the public page; Publish
// does. Every write passes the site-content gate (lib/content/gate.ts) first.
// Save draft and Publish write the layer and the advisor list (./advisors.ts)
// together, in one step of the store, so the live page never shows a new
// layer with old advisors (issue #321); Reset to team writes the layer alone.
// None of them writes a role, division, department, scope or member. A photo
// picked with Replace photo (issue #323), or uploaded as the group photo
// (issue #510), is stored the moment it is picked,
// behind the same gate, and reaches the page only when Save draft or Publish
// carries its src. A photo picked from another row's file, a member's own
// picture say, is copied when a save keeps it, so no two rows share one file
// (Owner decision, issue #831). A save made on a layer or advisors another
// save has replaced since is refused. Once a write lands, each uploaded
// photo it left unused by every stored layer version and advisor row, and
// named by no other row, is deleted, best-effort, so a failed delete never
// fails the write. Both sides of the dashboard data
// interface build it, each with its own store, its own roles and its own
// photo files.

/** The version the public page draws: the published one, or none saved yet. */
export function publishedTeamPage(items: readonly ContentItem<StoredTeamPage>[]): StoredTeamPage {
  return publicItems(items)[0] ?? NO_STORED_TEAM_PAGE;
}

/** The published version's layer, or none. */
export function publishedLayer(items: readonly ContentItem<StoredTeamPage>[]): TeamPageLayer {
  return publishedTeamPage(items).layer;
}

/**
 * The public Team page: the published version's layout drawn on the team
 * record, with its layer's intro text, figures and group photo
 * (`storedTeamPageOf`). A draft never reaches it.
 */
export function publicTeamPage(roles: TeamRoles, base: TeamPage, items: readonly ContentItem<StoredTeamPage>[]): TeamPage {
  return storedTeamPageOf(roles, publishedTeamPage(items), base);
}

/** The layer versions of stored versions, as the editor reads and answers them. */
function layerVersions(version: Versioned<StoredTeamPage>): Versioned<TeamPageLayer> {
  return mapVersions(version, (stored) => stored.layer);
}

/**
 * What the editor opens on: the layer it edits (the draft, else the published
 * one) and the page that version's stored layout draws (`storedTeamPageOf`),
 * with the roles build and the hand-typed record under it, so the editor lays
 * each change on as it is made (`editedTeamPage`, ./team-page-edit.ts).
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
  /** The layer document, each version with its layout: one item at most, none before the first save. Reset to team writes it alone. */
  readonly layer: ContentStore<StoredTeamPage>;
  /** Every advisor, as ./advisors.ts keeps them. */
  advisors(): Promise<readonly AdvisorItem[]>;
  /**
   * The layer document's versions become `layer`, each layer with its
   * layout, and every advisor write lands, in one step: on a refusal or a
   * failure nothing is written, and the layer and the advisors stay as they
   * were. `expected` is the layer and the advisors the save was made on: when
   * another save has replaced either since, it is refused with
   * `CHANGED_SINCE_READ` (issue #831).
   */
  save(layer: Versioned<StoredTeamPage>, advisors: readonly AdvisorWrite[], expected: TeamPageRead): Promise<WriteResult<null>>;
}

/** The layer document's versions (none before the first save) and every advisor, as one save read them. */
export type TeamPageRead = { readonly layer: Versioned<StoredTeamPage> | null; readonly advisors: readonly AdvisorItem[] };

/** Whether two reads of the layer and the advisors hold the same content. */
export function sameTeamPageRead(a: TeamPageRead, b: TeamPageRead): boolean {
  const byId = (items: readonly AdvisorItem[]) => [...items].sort((x, y) => x.id - y.id);
  const advisorsMatch =
    a.advisors.length === b.advisors.length &&
    byId(a.advisors).every((item, i) => {
      const other = byId(b.advisors)[i];
      return item.id === other.id && item.siteOrder === other.siteOrder && sameVersions(item.version, other.version);
    });
  return advisorsMatch && sameVersions(a.layer, b.layer);
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
   * The photo as a saved layer or advisor row keeps it (Owner decision,
   * issue #831): a `/team/` path, a file `put` stored or a URL off this
   * store stay as they are; any other file of this store, a member's own
   * picture say, is copied under a new name, so no two rows share one file.
   * Null when that file is gone.
   */
  adopt(photo: PersonPhoto): Promise<PersonPhoto | null>;
  /**
   * Deletes the files of these photos that `put` or `adopt` stored and no
   * row names any more; any other photo (a `/team/` path, a member's own
   * picture) is left alone. A failed delete is logged, never thrown: the
   * write it follows has already landed.
   */
  drop(photos: readonly PersonPhoto[]): Promise<void>;
  /** Of these photos, the files `put` or `adopt` stored that a save may no longer keep: gone, or old enough for the daily sweep (lib/outreach-photos.ts `goneFiles`). */
  gone(photos: readonly PersonPhoto[]): Promise<PersonPhoto[]>;
}

/** Why a save is refused when a photo it picked from another row is no longer stored. */
export const PICKED_PHOTO_GONE = "A photo you picked is no longer stored. Reload the page and pick it again.";

/** Every photo the stored layer versions, their layouts and the advisor versions show. */
export function photosInUse(layer: readonly ContentItem<StoredTeamPage>[], advisors: readonly AdvisorItem[]): Set<PersonPhoto> {
  const layers = layer.flatMap((item) =>
    versionRows(item.version).flatMap(({ content }) => [...layerPhotos(content.layer), ...(content.layout === null ? [] : layoutPhotos(content.layout))]),
  );
  const rows = advisors.flatMap((item) => versionRows(item.version).flatMap((row) => row.content.photo ?? []));
  return new Set([...layers, ...rows]);
}

/** Each of `shown` as one row keeps it (`TeamPagePhotos.adopt`), as a swap; null when the file of one is gone. */
async function adoptedFor(shown: readonly PersonPhoto[], photos: Pick<TeamPagePhotos, "adopt">): Promise<((photo: PersonPhoto) => PersonPhoto) | null> {
  const kept = new Map<PersonPhoto, PersonPhoto>();
  for (const photo of new Set(shown)) {
    const adopted = await photos.adopt(photo);
    if (adopted === null) return null;
    kept.set(photo, adopted);
  }
  return (photo) => kept.get(photo) ?? photo;
}

/**
 * The layer and the advisor writes with every photo as a save keeps it
 * (`TeamPagePhotos.adopt`): another row's file is copied once for each row
 * that shows it, the layer and every advisor row apart, so no two rows share
 * one copy. The layer's own spots and versions share its one copy. Refused
 * when one of those files is gone.
 */
export async function adoptedPhotos(
  layer: TeamPageLayer,
  writes: readonly AdvisorWrite[],
  photos: Pick<TeamPagePhotos, "adopt">,
): Promise<WriteResult<{ readonly layer: TeamPageLayer; readonly advisors: AdvisorWrite[] }>> {
  const layerSwap = await adoptedFor(layerPhotos(layer), photos);
  if (layerSwap === null) return refused(PICKED_PHOTO_GONE);
  const advisors: AdvisorWrite[] = [];
  for (const w of writes) {
    const swap = await adoptedFor(versionRows(w.version).flatMap((row) => row.content.photo ?? []), photos);
    if (swap === null) return refused(PICKED_PHOTO_GONE);
    advisors.push({ ...w, version: mapVersions(w.version, (a) => (a.photo === undefined ? a : { ...a, photo: swap(a.photo) })) });
  }
  return written({ layer: withLayerPhotos(layer, layerSwap), advisors });
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
 * page then shows the first ones), and may leave a section empty, but the
 * layer may not add past a limit, and may not empty a section the roles
 * fill, which would empty it on the page without a word.
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
  const versionOf = (result: WriteResult<ContentItem<StoredTeamPage>>): WriteResult<Versioned<TeamPageLayer>> =>
    result.ok ? written(layerVersions(result.value.version)) : result;

  return {
    async open() {
      // The roles need nothing of the layer, so both are read at once (issue #397).
      const [items, teamRoles] = await Promise.all([editor.list(), roles()]);
      if (items === null) return null;
      const version = items[0]?.version ?? null;
      const stored = version === null ? NO_STORED_TEAM_PAGE : editorVersion(version);
      const build = teamBuildOf(teamRoles);
      return { status: version === null ? null : statusOf(version), layer: stored.layer, page: storedTeamPageOf(teamRoles, stored, base), build, base };
    },

    async save(step, layer, advisors) {
      if (!maySiteContent(viewer)) return refused(SITE_CONTENT_REFUSAL);
      if (!isTeamPageLayer(layer, photos.owns)) return refused(NOT_A_LAYER);
      const teamRoles = await roles();
      const refusal = layerRefusal(teamBuildOf(teamRoles), base, layer);
      if (refusal !== null) return refused(refusal);
      const [items, advisorItems] = await Promise.all([store.layer.list(), store.advisors()]);
      const writes = advisorWritesOf(advisorItems, step, advisors);
      if (!writes.ok) return writes;
      const adopted = await adoptedPhotos(layer, writes.value, photos);
      if (!adopted.ok) return adopted;
      const before = photosInUse(items, advisorItems);
      const version = afterStep(items[0]?.version ?? null, storedTeamPage(teamRoles, adopted.value.layer), step);
      // A Team page upload the stored versions did not show must still be
      // stored, and young enough that the daily sweep cannot delete it
      // while this save is under way (`TeamPagePhotos.gone`).
      const after = photosInUse([{ id: 1, siteOrder: 1, version }], advisorsAfter(advisorItems, adopted.value.advisors));
      if ((await photos.gone([...after].filter((photo) => !before.has(photo)))).length > 0) return refused(PHOTO_GONE);
      const saved = await store.save(version, adopted.value.advisors, { layer: items[0]?.version ?? null, advisors: advisorItems });
      if (!saved.ok) return saved;
      const advisorsNow = await store.advisors();
      await photos.drop(photosNoLongerUsed(before, photosInUse(await store.layer.list(), advisorsNow)));
      return written({ layer: layerVersions(version), advisors: advisorsNow });
    },

    async reset() {
      const advisors = await store.advisors();
      const before = photosInUse(await store.layer.list(), advisors);
      const result = await editor.save(await documentId(), "save-draft", async (current) =>
        written(storedTeamPage(await roles(), resetLayer(current?.layer ?? NO_TEAM_LAYER))),
      );
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
