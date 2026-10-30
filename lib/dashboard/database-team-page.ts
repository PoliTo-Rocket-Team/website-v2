import "server-only";

import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { teamPageLayerVersions } from "@/db/schema";
import { ownsTeamPageUpload } from "@/lib/about/team-page-photos";
import { storedTeamPageOfRow, type StoredTeamPage } from "@/lib/about/team-page-stored";
import { ownPublicStoreHost } from "@/lib/storage/public-store";
import type { ContentStore } from "@/lib/content/editor";
import { versionedFromRows, versionRows, type ContentItem, type Versioned, type VersionKind } from "@/lib/content/versioned";
import { runAuditQuery } from "@/lib/db-audit";
import { writeOverExpected, type VersionRows } from "./database-guarded-write";
import { written, type WriteResult } from "./write";

// The database side of the Team page's visual layer (issue #283): the
// editor's store and the public read /about/the-team makes. The layer is one
// document, so the store holds one item at most, kept as one row per
// version in `team_page_layer_versions` (migration 0034), each with its
// layout of page seats beside it (migration 0076, issue #850,
// lib/about/team-page-stored.ts). Writes touch that
// table alone, through runAuditQuery or runAuditBatch so the audit trigger
// logs who made them, then refresh the public read
// (.patterns/audited-mutations.md).

export const TEAM_PAGE_LAYER_CACHE_TAG = "team-page-layer";

/** The one document's id and place: the store keeps nothing else. */
const DOCUMENT = { id: 1, siteOrder: 1 } as const;

/** Postgres' "undefined_table": the layer's migration has not run on this database yet. */
const UNDEFINED_TABLE = "42P01";

/** Postgres' "undefined_column": migration 0076, which adds `team_page_layer_versions.layout`, has not run on this database yet. */
const UNDEFINED_COLUMN = "42703";

function hasCode(error: unknown, code: string): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === code) return true;
  }
  return false;
}

/**
 * Every stored version's row. Before migration 0076 has run there is no
 * `layout` column: each row reads with no layout, so it draws the layout its
 * layer snapshots to, whichever of the code and the migration lands first.
 */
async function layerRows(): Promise<readonly { version: VersionKind; layer: unknown; layout: unknown }[]> {
  const db = getDb();
  try {
    return await db.select().from(teamPageLayerVersions);
  } catch (error) {
    if (!hasCode(error, UNDEFINED_COLUMN)) throw error;
    const rows = await db.select({ version: teamPageLayerVersions.version, layer: teamPageLayerVersions.layer }).from(teamPageLayerVersions);
    return rows.map((row) => ({ ...row, layout: null }));
  }
}

/**
 * The layer document, each version with its layout, or none before the first
 * save. A row whose layer no write of this code leaves is skipped; a group
 * photo it uploaded is one in this deployment's public store (issue #510). A
 * row with no layout yet reads as none (`storedTeamPageOfRow`).
 */
export async function readTeamPageLayer(): Promise<ContentItem<StoredTeamPage>[]> {
  const rows = await layerRows();
  const owns = ownsTeamPageUpload(ownPublicStoreHost());
  const versions = rows.flatMap((row): { kind: VersionKind; content: StoredTeamPage }[] => {
    const stored = storedTeamPageOfRow(row, owns);
    return stored === null ? [] : [{ kind: row.version, content: stored }];
  });
  const version = versionedFromRows(versions);
  return version === null ? [] : [{ ...DOCUMENT, version }];
}

/**
 * The layer document as /about/the-team reads it, cached until a layer write
 * refreshes it; none while this database has no layer table yet, so the page
 * shows the roles build alone until the migration runs.
 */
export async function cachedTeamPageLayer(): Promise<ContentItem<StoredTeamPage>[]> {
  "use cache";

  cacheTag(TEAM_PAGE_LAYER_CACHE_TAG);
  cacheLife("weeks");

  try {
    return await readTeamPageLayer();
  } catch (error) {
    if (hasCode(error, UNDEFINED_TABLE)) return [];
    throw error;
  }
}

/**
 * The writes that make the document's rows exactly `version`'s, each layer
 * with its layout in the same row, for a batch (one transaction) that may
 * hold other writes too.
 */
export function layerVersionWrites(db: ReturnType<typeof getDb>, version: Versioned<StoredTeamPage>) {
  const values = versionRows(version).map(({ kind, content }) => ({
    version: kind,
    layer: content.layer,
    layout: content.layout,
    updatedAt: new Date().toISOString(),
  }));
  return [db.delete(teamPageLayerVersions), db.insert(teamPageLayerVersions).values(values)] as const;
}

/** The document's rows, for a write that must find them as it read them (./database-guarded-write.ts). */
export const LAYER_ROWS: VersionRows = { table: teamPageLayerVersions, id: teamPageLayerVersions.id, where: undefined };

/** The document's rows become exactly `version`'s, while they still hold `expected` (none before the first save). */
async function writeVersions(version: Versioned<StoredTeamPage>, expected: Versioned<StoredTeamPage> | null): Promise<WriteResult<ContentItem<StoredTeamPage>>> {
  const landed = await writeOverExpected(LAYER_ROWS, async () => (await readTeamPageLayer())[0] ?? null, expected, (db) => layerVersionWrites(db, version));
  if (!landed.ok) return landed;
  updateTag(TEAM_PAGE_LAYER_CACHE_TAG);
  return written({ ...DOCUMENT, version });
}

export const databaseTeamPageLayerStore: ContentStore<StoredTeamPage> = {
  list: readTeamPageLayer,
  create: (version) => writeVersions(version, null),
  update: (_id, version, expected) => writeVersions(version, expected),
  async remove() {
    await runAuditQuery((db) => db.delete(teamPageLayerVersions));
    updateTag(TEAM_PAGE_LAYER_CACHE_TAG);
    return written(null);
  },
  // One document has no order to change.
  setOrder: async () => written(null),
};
