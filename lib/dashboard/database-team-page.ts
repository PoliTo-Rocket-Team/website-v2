import "server-only";

import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { teamPageLayerVersions } from "@/db/schema";
import { isTeamPageLayer, type TeamPageLayer } from "@/lib/about/team-layer";
import { ownsTeamPageUpload } from "@/lib/about/team-page-photos";
import { ownPublicStoreHost } from "@/lib/storage/public-store";
import type { ContentStore } from "@/lib/content/editor";
import { versionedFromRows, versionRows, type ContentItem, type Versioned, type VersionKind } from "@/lib/content/versioned";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { written } from "./write";

// The database side of the Team page's visual layer (issue #283): the
// editor's store and the public read /about/the-team makes. The layer is one
// document, so the store holds one item at most, kept as one row per
// version in `team_page_layer_versions` (migration 0034). Writes touch that
// table alone, through runAuditQuery or runAuditBatch so the audit trigger
// logs who made them, then refresh the public read
// (.patterns/audited-mutations.md).

export const TEAM_PAGE_LAYER_CACHE_TAG = "team-page-layer";

/** The one document's id and place: the store keeps nothing else. */
const DOCUMENT = { id: 1, siteOrder: 1 } as const;

/** Postgres' "undefined_table": the layer's migration has not run on this database yet. */
const UNDEFINED_TABLE = "42P01";

function isUndefinedTable(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === UNDEFINED_TABLE) return true;
  }
  return false;
}

/**
 * The layer document, or none before the first save. A row no write of this
 * code leaves is skipped; a group photo it uploaded is one in this
 * deployment's public store (issue #510).
 */
export async function readTeamPageLayer(): Promise<ContentItem<TeamPageLayer>[]> {
  const rows = await getDb().select().from(teamPageLayerVersions);
  const owns = ownsTeamPageUpload(ownPublicStoreHost());
  const versions = rows.flatMap((row): { kind: VersionKind; content: TeamPageLayer }[] =>
    isTeamPageLayer(row.layer, owns) ? [{ kind: row.version, content: row.layer }] : [],
  );
  const version = versionedFromRows(versions);
  return version === null ? [] : [{ ...DOCUMENT, version }];
}

/**
 * The layer document as /about/the-team reads it, cached until a layer write
 * refreshes it; none while this database has no layer table yet, so the page
 * shows the roles build alone until the migration runs.
 */
export async function cachedTeamPageLayer(): Promise<ContentItem<TeamPageLayer>[]> {
  "use cache";

  cacheTag(TEAM_PAGE_LAYER_CACHE_TAG);
  cacheLife("weeks");

  try {
    return await readTeamPageLayer();
  } catch (error) {
    if (isUndefinedTable(error)) return [];
    throw error;
  }
}

/** The writes that make the document's rows exactly `version`'s, for a batch (one transaction) that may hold other writes too. */
export function layerVersionWrites(db: ReturnType<typeof getDb>, version: Versioned<TeamPageLayer>) {
  const values = versionRows(version).map(({ kind, content }) => ({ version: kind, layer: content, updatedAt: new Date().toISOString() }));
  return [db.delete(teamPageLayerVersions), db.insert(teamPageLayerVersions).values(values)] as const;
}

/** The document's rows become exactly `version`'s. */
async function writeVersions(version: Versioned<TeamPageLayer>): Promise<ContentItem<TeamPageLayer>> {
  await runAuditBatch((db) => [...layerVersionWrites(db, version)]);
  updateTag(TEAM_PAGE_LAYER_CACHE_TAG);
  return { ...DOCUMENT, version };
}

export const databaseTeamPageLayerStore: ContentStore<TeamPageLayer> = {
  list: readTeamPageLayer,
  create: async (version) => written(await writeVersions(version)),
  update: async (_id, version) => written(await writeVersions(version)),
  async remove() {
    await runAuditQuery((db) => db.delete(teamPageLayerVersions));
    updateTag(TEAM_PAGE_LAYER_CACHE_TAG);
    return written(null);
  },
  // One document has no order to change.
  setOrder: async () => written(null),
};
