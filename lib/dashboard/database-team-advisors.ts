import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { alumniEntries, teamPageAdvisors, teamPageAdvisorVersions } from "@/db/schema";
import { isAdvisorVersion, publicAdvisors, type AdvisorItem, type AdvisorStore, type AdvisorVersion, type AdvisorWrite } from "@/lib/about/advisors";
import type { Advisor } from "@/lib/about/types";
import { versionedFromRows, versionRows, type Versioned, type VersionKind } from "@/lib/content/versioned";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { ALUMNI_CACHE_TAG } from "./database-alumni";
import { written } from "./write";

// The database side of the Team page's advisors (issue #286): the editor's
// store and the public read /about/the-team makes. Each advisor is a
// `team_page_advisors` row with one `team_page_advisor_versions` row per
// version (migration 0035). Writes go through runAuditQuery or runAuditBatch
// so the audit triggers log who made them, then refresh the reads
// (.patterns/audited-mutations.md). They touch those two tables, and End
// advising one `alumni_entries` row besides: never a role, division,
// department, scope or member.

export const TEAM_ADVISORS_CACHE_TAG = "team-page-advisors";

/** Postgres' "undefined_table": the advisors' migration has not run on this database yet. */
const UNDEFINED_TABLE = "42P01";

function isUndefinedTable(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === UNDEFINED_TABLE) return true;
  }
  return false;
}

/** Every advisor with their versions; a version no write of this code leaves is skipped. */
export async function readAdvisorItems(): Promise<AdvisorItem[]> {
  const rows = await getDb()
    .select({ id: teamPageAdvisors.id, siteOrder: teamPageAdvisors.siteOrder, version: teamPageAdvisorVersions.version, advisor: teamPageAdvisorVersions.advisor })
    .from(teamPageAdvisors)
    .innerJoin(teamPageAdvisorVersions, eq(teamPageAdvisorVersions.advisorId, teamPageAdvisors.id))
    .orderBy(asc(teamPageAdvisors.siteOrder), asc(teamPageAdvisors.id));
  const byId = new Map<number, { siteOrder: number; rows: { kind: VersionKind; content: AdvisorVersion }[] }>();
  for (const row of rows) {
    const entry = byId.get(row.id) ?? { siteOrder: row.siteOrder, rows: [] };
    if (isAdvisorVersion(row.advisor)) entry.rows.push({ kind: row.version, content: row.advisor });
    byId.set(row.id, entry);
  }
  return [...byId].flatMap(([id, entry]) => {
    const version = versionedFromRows(entry.rows);
    return version === null ? [] : [{ id, siteOrder: entry.siteOrder, version }];
  });
}

/**
 * The advisors /about/the-team shows, cached until an advisor write refreshes
 * it; null while this database has no advisor tables yet, so the page keeps
 * the hand-typed record's advisors until the migration runs.
 */
export async function cachedPublishedAdvisors(): Promise<Advisor[] | null> {
  "use cache";

  cacheTag(TEAM_ADVISORS_CACHE_TAG);
  cacheLife("weeks");

  try {
    return publicAdvisors(await readAdvisorItems());
  } catch (error) {
    if (isUndefinedTable(error)) return null;
    throw error;
  }
}

function versionValues(advisorId: number, version: Versioned<AdvisorVersion>) {
  const updatedAt = new Date().toISOString();
  return versionRows(version).map(({ kind, content }) => ({ advisorId, version: kind, advisor: content, updatedAt }));
}

type Db = ReturnType<typeof getDb>;

/** A new advisor at `siteOrder` with its one version, the new id read back. */
function createAdvisor(db: Db, version: Versioned<AdvisorVersion>, siteOrder: number) {
  const [only, ...more] = versionRows(version);
  // A new advisor holds one version: a draft, or what was published at once.
  if (more.length > 0) throw new Error("a new advisor holds one version");
  return db.execute<{ advisor_id: number }>(sql`
    WITH "advisor" AS (INSERT INTO ${teamPageAdvisors} ("site_order") VALUES (${siteOrder}) RETURNING "id")
    INSERT INTO ${teamPageAdvisorVersions} ("advisor_id", "version", "advisor")
    SELECT "id", ${only.kind}::content_version, ${JSON.stringify(only.content)}::jsonb
    FROM "advisor"
    RETURNING "advisor_id"`);
}

/** An advisor's version rows become exactly `version`'s. */
function updateAdvisor(db: Db, id: number, version: Versioned<AdvisorVersion>) {
  return [
    db.delete(teamPageAdvisorVersions).where(eq(teamPageAdvisorVersions.advisorId, id)),
    db.insert(teamPageAdvisorVersions).values(versionValues(id, version)),
  ] as const;
}

/** Every write of a Save draft or Publish, for one batch (one transaction), which may hold other writes too. */
export function advisorWriteQueries(db: Db, writes: readonly AdvisorWrite[]): BatchItem<"pg">[] {
  return writes.flatMap((write): BatchItem<"pg">[] =>
    write.kind === "create" ? [createAdvisor(db, write.version, write.siteOrder)] : [...updateAdvisor(db, write.id, write.version)],
  );
}

export const databaseAdvisorStore: AdvisorStore = {
  list: readAdvisorItems,

  async create(version, siteOrder) {
    const created = await runAuditQuery((db) => createAdvisor(db, version, siteOrder));
    updateTag(TEAM_ADVISORS_CACHE_TAG);
    return written({ id: Number(created.rows[0].advisor_id), siteOrder, version });
  },

  async update(id, version) {
    const before = (await readAdvisorItems()).find((item) => item.id === id) ?? null;
    await runAuditBatch((db) => [...updateAdvisor(db, id, version)]);
    updateTag(TEAM_ADVISORS_CACHE_TAG);
    return written({ id, siteOrder: before?.siteOrder ?? 0, version });
  },

  async saveAll(writes) {
    if (writes.length === 0) return written(null);
    // One batch is one transaction: a failing write leaves every advisor as it was.
    await runAuditBatch((db) => {
      const [first, ...rest] = advisorWriteQueries(db, writes);
      return [first, ...rest];
    });
    updateTag(TEAM_ADVISORS_CACHE_TAG);
    return written(null);
  },

  async remove(id) {
    // Its versions go with it (ON DELETE CASCADE).
    await runAuditQuery((db) => db.delete(teamPageAdvisors).where(eq(teamPageAdvisors.id, id)));
    updateTag(TEAM_ADVISORS_CACHE_TAG);
    return written(null);
  },

  async setOrder(slots) {
    if (slots.length === 0) return written(null);
    const [first, ...rest] = slots;
    const update = (db: ReturnType<typeof getDb>, slot: (typeof slots)[number]) =>
      db.update(teamPageAdvisors).set({ siteOrder: slot.siteOrder }).where(eq(teamPageAdvisors.id, slot.id));
    await runAuditBatch((db) => [update(db, first), ...rest.map((slot) => update(db, slot))]);
    updateTag(TEAM_ADVISORS_CACHE_TAG);
    return written(null);
  },

  async endAdvising(id, { name, role, from, to, photo }) {
    // Off the Team page and onto the Alumni page in one batch, so neither page shows them twice or not at all.
    await runAuditBatch((db) => [
      db.delete(teamPageAdvisors).where(eq(teamPageAdvisors.id, id)),
      db.insert(alumniEntries).values({ kind: "advisor", recordName: name, advisorRole: role, advisorFrom: from, advisorTo: to, photo }),
    ]);
    updateTag(TEAM_ADVISORS_CACHE_TAG);
    updateTag(ALUMNI_CACHE_TAG);
    return written(null);
  },
};
