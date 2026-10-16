import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { outreachPosts, outreachPostTags, outreachPostVersions, outreachSummitVersions, outreachTags } from "@/db/schema";
import type { ContentStore } from "@/lib/content/editor";
import { versionedFromRows, versionRows, type ContentItem, type Versioned, type VersionKind } from "@/lib/content/versioned";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { publicOutreach, type OutreachStore, type StoredOutreach, type SummitVersions } from "@/lib/outreach-editor";
import { postColumns, postFromColumns, summitColumns, summitFromColumns } from "@/lib/outreach-rows";
import type { OutreachContent, OutreachFeature, OutreachPost, OutreachTag } from "@/lib/outreach-types";
import { written } from "./write";

// The database side of the Outreach content (issue #287): the editor's store
// and the public read /outreach and its post pages make. Writes go through
// runAuditQuery or runAuditBatch, so the audit triggers of migration 0028 log
// who made them, then refresh the public read (.patterns/audited-mutations.md).

export const OUTREACH_CACHE_TAG = "outreach";

/** Postgres' "undefined_table": the outreach migration has not run on this database yet. */
const UNDEFINED_TABLE = "42P01";

function isUndefinedTable(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === UNDEFINED_TABLE) return true;
  }
  return false;
}

/** Everything stored, read in one round trip: the posts with their versions in site order, the summit and the tag list. */
export async function readStoredOutreach(): Promise<StoredOutreach> {
  const db = getDb();
  const [versionRowsRead, tagRows, summitRows, tagList] = await db.batch([
    db
      .select({ id: outreachPosts.id, siteOrder: outreachPosts.siteOrder, version: outreachPostVersions })
      .from(outreachPosts)
      .innerJoin(outreachPostVersions, eq(outreachPostVersions.postId, outreachPosts.id))
      .orderBy(asc(outreachPosts.siteOrder), asc(outreachPosts.id)),
    db.select().from(outreachPostTags).orderBy(asc(outreachPostTags.position)),
    db.select().from(outreachSummitVersions),
    db.select().from(outreachTags).orderBy(asc(outreachTags.listOrder), asc(outreachTags.id)),
  ]);

  const tagsOf = new Map<string, string[]>();
  for (const row of tagRows) {
    const key = `${row.postId}:${row.version}`;
    tagsOf.set(key, [...(tagsOf.get(key) ?? []), row.tagName]);
  }
  const byId = new Map<number, { siteOrder: number; rows: { kind: VersionKind; content: OutreachPost }[] }>();
  for (const row of versionRowsRead) {
    const entry = byId.get(row.id) ?? { siteOrder: row.siteOrder, rows: [] };
    const tags = tagsOf.get(`${row.id}:${row.version.version}`) ?? [];
    entry.rows.push({ kind: row.version.version, content: postFromColumns(row.version, tags) });
    byId.set(row.id, entry);
  }
  const posts = [...byId].flatMap(([id, entry]): ContentItem<OutreachPost>[] => {
    const version = versionedFromRows(entry.rows);
    return version === null ? [] : [{ id, siteOrder: entry.siteOrder, version }];
  });

  const summit = versionedFromRows(summitRows.map((row) => ({ kind: row.version, content: summitFromColumns(row) })));
  // The import publishes the summit, and no write unpublishes it.
  if (summit === null || summit.state !== "published") throw new Error("the outreach summit has no published version");

  return { posts, summit, tags: tagList.map((row): OutreachTag => ({ name: row.name, award: row.award })) };
}

/**
 * What /outreach and its post pages show, cached until an outreach write
 * refreshes it; null while this database has no outreach tables yet, so the
 * pages keep showing the record until the migration runs.
 */
export async function cachedPublishedOutreach(): Promise<OutreachContent | null> {
  "use cache";

  cacheTag(OUTREACH_CACHE_TAG);
  cacheLife("weeks");

  try {
    return publicOutreach(await readStoredOutreach());
  } catch (error) {
    if (isUndefinedTable(error)) return null;
    throw error;
  }
}

const json = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`;

/** A version's row and its tag rows, for a post whose id is known. */
function versionValues(postId: number, kind: VersionKind, post: OutreachPost) {
  const c = postColumns(post);
  return {
    version: { postId, version: kind, ...c, body: [...c.body], photos: [...c.photos] },
    tags: post.tags.map((tagName, i) => ({ postId, version: kind, tagName, position: i + 1 })),
  };
}

function versionsValues(postId: number, version: Versioned<OutreachPost>) {
  const all = versionRows(version).map((row) => versionValues(postId, row.kind, row.content));
  return { versions: all.map((v) => v.version), tags: all.flatMap((v) => v.tags) };
}

const databasePostStore: ContentStore<OutreachPost> = {
  list: async () => (await readStoredOutreach()).posts,

  async create(version, siteOrder) {
    const [only, ...more] = versionRows(version);
    // A new item holds one version: a draft, or what was published at once.
    if (more.length > 0) throw new Error("a new outreach post holds one version");
    const c = postColumns(only.content);
    const tags = sql.join(
      only.content.tags.map((name, i) => sql`(${name}, ${i + 1}::integer)`),
      sql`, `,
    );
    const created = await runAuditQuery((db) =>
      db.execute<{ post_id: number }>(sql`
        WITH "post" AS (INSERT INTO ${outreachPosts} ("site_order") VALUES (${siteOrder}) RETURNING "id"),
        "version" AS (
          INSERT INTO ${outreachPostVersions} ("post_id", "version", "title", "date", "place", "summary", "summary_phone", "lead", "body", "photos", "channels")
          SELECT "id", ${only.kind}::content_version, ${c.title}, ${c.date}::date, ${c.place}, ${c.summary}, ${c.summaryPhone}, ${c.lead},
            ${json(c.body)}, ${json(c.photos)}, ${json(c.channels)}
          FROM "post"
          RETURNING "post_id"
        )
        INSERT INTO ${outreachPostTags} ("post_id", "version", "tag_name", "position")
        SELECT "post_id", ${only.kind}::content_version, "tag"."name", "tag"."position"
        FROM "version", (VALUES ${tags}) AS "tag" ("name", "position")
        RETURNING "post_id"`),
    );
    updateTag(OUTREACH_CACHE_TAG);
    return written({ id: Number(created.rows[0].post_id), siteOrder, version });
  },

  async update(id, version) {
    const before = (await readStoredOutreach()).posts.find((item) => item.id === id) ?? null;
    const { versions, tags } = versionsValues(id, version);
    // The old versions' tags go with them (ON DELETE CASCADE).
    await runAuditBatch((db) => [
      db.delete(outreachPostVersions).where(eq(outreachPostVersions.postId, id)),
      db.insert(outreachPostVersions).values(versions),
      db.insert(outreachPostTags).values(tags),
    ]);
    updateTag(OUTREACH_CACHE_TAG);
    return written({ id, siteOrder: before?.siteOrder ?? 0, version });
  },

  async remove(id) {
    // Its versions and their tags go with it (ON DELETE CASCADE).
    await runAuditQuery((db) => db.delete(outreachPosts).where(eq(outreachPosts.id, id)));
    updateTag(OUTREACH_CACHE_TAG);
    return written(null);
  },

  async setOrder(slots) {
    if (slots.length === 0) return written(null);
    const [first, ...rest] = slots;
    const update = (db: ReturnType<typeof getDb>, slot: (typeof slots)[number]) =>
      db.update(outreachPosts).set({ siteOrder: slot.siteOrder }).where(eq(outreachPosts.id, slot.id));
    await runAuditBatch((db) => [update(db, first), ...rest.map((slot) => update(db, slot))]);
    updateTag(OUTREACH_CACHE_TAG);
    return written(null);
  },
};

function summitValues(kind: VersionKind, feature: OutreachFeature) {
  const c = summitColumns(feature);
  return { version: kind, ...c, editions: [...c.editions] };
}

export const databaseOutreachStore: OutreachStore = {
  posts: databasePostStore,

  summit: async () => (await readStoredOutreach()).summit,

  async saveSummit(versions: SummitVersions) {
    const [first, ...rest] = versionRows(versions).map((row) => summitValues(row.kind, row.content));
    await runAuditBatch((db) => [
      db.delete(outreachSummitVersions),
      db.insert(outreachSummitVersions).values([first, ...rest]),
    ]);
    updateTag(OUTREACH_CACHE_TAG);
    return written(versions);
  },

  tags: async () => (await readStoredOutreach()).tags,

  async addTag(name) {
    await runAuditQuery((db) =>
      db.insert(outreachTags).values({
        name,
        award: false,
        listOrder: sql`(SELECT COALESCE(MAX("list_order"), 0) + 1 FROM ${outreachTags})`,
      }),
    );
    updateTag(OUTREACH_CACHE_TAG);
    return written({ name, award: false });
  },
};
