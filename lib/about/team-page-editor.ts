import { contentEditor, type ContentStore } from "@/lib/content/editor";
import { editorVersion, publicItems, statusOf, type ContentItem, type ContentStatus, type PublishStep, type Versioned } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import { ARC_FULL, ARC_LEADERS, isTeamPageLayer, leadersOnArc, NO_TEAM_LAYER, resetLayer, type TeamPageLayer } from "./team-layer";
import { teamBuildOf, teamPageFromRoles, withLayerText, type TeamRoles } from "./team-roles";
import type { TeamPage } from "./types";

// The Team page's visual layer as the editor reads and writes it (issue
// #283): one document in the shared content store (lib/content/), with a
// published version /about/the-team lays on the roles build and an optional
// draft. Save draft and Reset to team never reach the public page; Publish
// does. Every write passes the site-content gate (lib/content/gate.ts) first,
// and the only thing any of them writes is the layer: never a role,
// division, department, scope or member. Both sides of the dashboard data
// interface build it, each with its own store and its own roles.

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

/** What the editor opens on: the layer it edits (the draft, else the published one) and the page with it laid on. */
export type TeamPageOpening = {
  /** Null before anything was saved. */
  readonly status: ContentStatus | null;
  readonly layer: TeamPageLayer;
  readonly page: TeamPage;
};

export interface TeamPageEditor {
  /** Null for a viewer without site-content access. */
  open(): Promise<TeamPageOpening | null>;
  /** Save draft or Publish the whole layer, as the editor sent it. */
  save(step: PublishStep, layer: unknown): Promise<WriteResult<Versioned<TeamPageLayer>>>;
  /** Reset to team (board 80h): a draft with every edit gone except the intro text and the group photo. */
  reset(): Promise<WriteResult<Versioned<TeamPageLayer>>>;
}

export const NOT_A_LAYER = "The page changed in a way it cannot keep. Reload and try again.";

export function teamPageEditor(
  viewer: ViewerStanding,
  store: ContentStore<TeamPageLayer>,
  roles: () => Promise<TeamRoles>,
  base: TeamPage,
): TeamPageEditor {
  const editor = contentEditor(viewer, store);
  /** The one document's id; null before the first save. */
  const documentId = async () => (await store.list())[0]?.id ?? null;
  const versionOf = (result: WriteResult<ContentItem<TeamPageLayer>>): WriteResult<Versioned<TeamPageLayer>> =>
    result.ok ? written(result.value.version) : result;

  return {
    async open() {
      const items = await editor.list();
      if (items === null) return null;
      const version = items[0]?.version ?? null;
      const layer = version === null ? NO_TEAM_LAYER : editorVersion(version);
      const page = teamPageFromRoles(await roles(), base, layer) ?? withLayerText(base, layer);
      return { status: version === null ? null : statusOf(version), layer, page };
    },

    async save(step, layer) {
      const result = await editor.save(await documentId(), step, async () => {
        if (!isTeamPageLayer(layer)) return refused(NOT_A_LAYER);
        // The layer may not put more than eight on the arc; the roles alone may (the page then shows the first eight).
        const build = teamBuildOf(await roles());
        const cap = Math.max(ARC_LEADERS, leadersOnArc(build, NO_TEAM_LAYER));
        return leadersOnArc(build, layer) > cap ? refused(ARC_FULL) : written(layer);
      });
      return versionOf(result);
    },

    async reset() {
      const result = await editor.save(await documentId(), "save-draft", async (current) => written(resetLayer(current ?? NO_TEAM_LAYER)));
      return versionOf(result);
    },
  };
}
