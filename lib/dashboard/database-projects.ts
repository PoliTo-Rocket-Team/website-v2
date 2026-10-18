import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { logs, projects, projectVersions, users } from "@/db/schema";
import type { ContentStore } from "@/lib/content/editor";
import { publicItems, versionedFromRows, versionRows, type ContentItem, type Versioned, type VersionKind } from "@/lib/content/versioned";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { storedProjectRecord } from "@/lib/project-content/check";
import type { EditStamp } from "@/lib/project-content/edited";
import type { ProjectRecord } from "@/lib/project-content/record";
import { publicStorePanelPhotos, type PhotoFiles } from "@/lib/outreach-photos";
import { deletePublicFile, ownPublicStoreHost, uploadPublicFile } from "@/lib/storage/public-store";
import { written } from "./write";

// The database side of the projects (issue #295): the store a projects editor
// writes through, and the public read the project pages, the home Projects
// section and /projects make. Writes go through runAuditQuery or
// runAuditBatch, so the audit triggers of migration 0037 log who made them,
// then refresh the public read (.patterns/audited-mutations.md).

export const PROJECTS_CACHE_TAG = "projects";

/** Postgres' "undefined_table": the projects migration has not run on this database yet. */
const UNDEFINED_TABLE = "42P01";

function isUndefinedTable(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === UNDEFINED_TABLE) return true;
  }
  return false;
}

/**
 * A `project_versions` row's record; only this code writes the column, so one
 * that is not a record is a fault. A retired key an older save left in it is
 * dropped (`storedProjectRecord`).
 */
function recordOf(row: typeof projectVersions.$inferSelect): ProjectRecord {
  const record = storedProjectRecord(row.content);
  if (record === null) throw new Error(`project ${row.projectId} holds a ${row.version} version that is not a project record`);
  return record;
}

/** Every project with its versions, in site order. */
export async function readProjectItems(): Promise<ContentItem<ProjectRecord>[]> {
  const rows = await getDb()
    .select({ id: projects.id, siteOrder: projects.siteOrder, version: projectVersions })
    .from(projects)
    .innerJoin(projectVersions, eq(projectVersions.projectId, projects.id))
    .orderBy(asc(projects.siteOrder), asc(projects.id));
  const byId = new Map<number, { siteOrder: number; rows: { kind: VersionKind; content: ProjectRecord }[] }>();
  for (const row of rows) {
    const entry = byId.get(row.id) ?? { siteOrder: row.siteOrder, rows: [] };
    entry.rows.push({ kind: row.version.version, content: recordOf(row.version) });
    byId.set(row.id, entry);
  }
  return [...byId].flatMap(([id, entry]) => {
    const version = versionedFromRows(entry.rows);
    return version === null ? [] : [{ id, siteOrder: entry.siteOrder, version }];
  });
}

/**
 * The published projects in site order, cached until a project write
 * refreshes it; null while this database has no projects tables yet, so the
 * public pages keep showing the import until the migration runs.
 */
export async function cachedPublishedProjects(): Promise<ProjectRecord[] | null> {
  "use cache";

  cacheTag(PROJECTS_CACHE_TAG);
  cacheLife("weeks");

  try {
    return publicItems(await readProjectItems());
  } catch (error) {
    if (isUndefinedTable(error)) return null;
    throw error;
  }
}

/**
 * When each project's versions were last written and by whom (board 75's
 * "edited by" line, issue #297), read off the audit log that every write
 * here leaves. Moving a card writes `projects`, not its versions, so it is
 * not an edit. Someone whose account was anonymized is named by no one.
 */
export async function readProjectStamps(): Promise<ReadonlyMap<number, EditStamp>> {
  const projectId = sql<string>`${logs.newData} ->> 'project_id'`;
  const rows = await getDb()
    .selectDistinctOn([projectId], {
      projectId,
      at: logs.changedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      anonymizedAt: users.anonymizedAt,
    })
    .from(logs)
    .leftJoin(users, eq(users.id, logs.changedBy))
    .where(and(eq(logs.schemaName, "public"), eq(logs.tableName, "project_versions"), inArray(logs.operation, ["INSERT", "UPDATE"])))
    .orderBy(projectId, desc(logs.changedAt));
  return new Map(
    rows.flatMap((row) => {
      const id = Number(row.projectId);
      if (!Number.isSafeInteger(id)) return [];
      const name = row.anonymizedAt === null ? [row.firstName, row.lastName].filter(Boolean).join(" ") : "";
      return [[id, { at: new Date(row.at).toISOString(), by: name === "" ? null : name }] as const];
    }),
  );
}

function versionValues(projectId: number, version: Versioned<ProjectRecord>) {
  return versionRows(version).map(({ kind, content }) => ({ projectId, version: kind, content }));
}

export const databaseProjectStore: ContentStore<ProjectRecord> = {
  list: readProjectItems,

  async create(version, siteOrder) {
    const [only, ...more] = versionRows(version);
    // A new item holds one version: a draft, or what was published at once.
    if (more.length > 0) throw new Error("a new project holds one version");
    const created = await runAuditQuery((db) =>
      db.execute<{ project_id: number }>(sql`
        WITH "project" AS (INSERT INTO ${projects} ("site_order") VALUES (${siteOrder}) RETURNING "id")
        INSERT INTO ${projectVersions} ("project_id", "version", "content")
        SELECT "id", ${only.kind}::content_version, ${JSON.stringify(only.content)}::jsonb
        FROM "project"
        RETURNING "project_id"`),
    );
    updateTag(PROJECTS_CACHE_TAG);
    return written({ id: Number(created.rows[0].project_id), siteOrder, version });
  },

  async update(id, version) {
    const before = (await readProjectItems()).find((item) => item.id === id) ?? null;
    await runAuditBatch((db) => [
      db.delete(projectVersions).where(eq(projectVersions.projectId, id)),
      db.insert(projectVersions).values(versionValues(id, version)),
    ]);
    updateTag(PROJECTS_CACHE_TAG);
    return written({ id, siteOrder: before?.siteOrder ?? 0, version });
  },

  async remove(id) {
    // Its versions go with it (ON DELETE CASCADE).
    await runAuditQuery((db) => db.delete(projects).where(eq(projects.id, id)));
    updateTag(PROJECTS_CACHE_TAG);
    return written(null);
  },

  async setOrder(slots) {
    if (slots.length === 0) return written(null);
    const [first, ...rest] = slots;
    const update = (db: ReturnType<typeof getDb>, slot: (typeof slots)[number]) =>
      db.update(projects).set({ siteOrder: slot.siteOrder }).where(eq(projects.id, slot.id));
    await runAuditBatch((db) => [update(db, first), ...rest.map((slot) => update(db, slot))]);
    updateTag(PROJECTS_CACHE_TAG);
    return written(null);
  },
};

/** Uploaded launch and gallery photos in this deployment's public Blob store, under `project-photos/`, each under a new name (issue #299). */
export function blobProjectPhotoFiles(): PhotoFiles {
  return publicStorePanelPhotos("project-photo", ownPublicStoreHost(), { upload: uploadPublicFile, remove: deletePublicFile }, randomUUID);
}
