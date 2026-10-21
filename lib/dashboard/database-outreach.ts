import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { outreachPosts, outreachPostTags, outreachPostVersions, outreachTags } from "@/db/schema";
import { versionRows, type VersionKind } from "@/lib/content/versioned";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { publicOutreach, type OutreachStore, type StoredOutreach } from "@/lib/outreach-editor";
import { featuredIdsOf, featuring, freeFeaturedSlot, isFeatured, type FeaturedIds, type FeaturedSlot } from "@/lib/outreach-featured";
import { publicStorePhotoFiles, type PhotoFiles } from "@/lib/outreach-photos";
import { draftFromColumns, postColumns, postFromColumns } from "@/lib/outreach-rows";
import type { OutreachContent, OutreachDraft, OutreachTag, PostItem, PostStore, PostVersions } from "@/lib/outreach-types";
import { deletePublicFile, ownPublicStoreHost, uploadPublicFile } from "@/lib/storage/public-store";
import { written } from "./write";

// The database side of the Outreach content (issue #287): the editor's store
// and the public read /outreach and its post pages make. Writes go through
// runAuditQuery or runAuditBatch, so the audit triggers of migration 0032 log
// who made them, then refresh the public read (.patterns/audited-mutations.md).
// Uploaded post photos live in the public Blob store (issue #291); the
// editor frees the files no post shows any more (lib/outreach-photos.ts).

export const OUTREACH_CACHE_TAG = "outreach";

/** Postgres' "undefined_table": the outreach migration has not run on this database yet. */
const UNDEFINED_TABLE = "42P01";

/** Postgres' "undefined_column": migration 0048, which adds `outreach_posts.featured_slot`, has not run on this database yet. */
const UNDEFINED_COLUMN = "42703";

function hasCode(error: unknown, code: string): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === code) return true;
  }
  return false;
}

const isUndefinedTable = (error: unknown) => hasCode(error, UNDEFINED_TABLE);

/** A featured post and the slot it holds (issue #496). */
type FeaturedRow = { readonly id: number; readonly slot: FeaturedSlot };

/**
 * The featured posts and their slots, slot 1 first (issue #496). Before
 * migration 0048 has run there is no `featured_slot` column: the post pinned
 * then (migration 0044) reads as the one featured post, so the pages show
 * what they showed before, whichever of the code and the migration lands
 * first.
 */
async function readFeaturedRows(): Promise<readonly FeaturedRow[]> {
  const db = getDb();
  try {
    const rows = await db
      .select({ id: outreachPosts.id, slot: outreachPosts.featuredSlot })
      .from(outreachPosts)
      .where(isNotNull(outreachPosts.featuredSlot))
      .orderBy(asc(outreachPosts.featuredSlot));
    return rows.map((row) => ({ id: row.id, slot: row.slot as FeaturedSlot }));
  } catch (error) {
    if (!hasCode(error, UNDEFINED_COLUMN)) throw error;
    const pinned = await db.execute<{ id: number }>(sql`SELECT "id" FROM "outreach_posts" WHERE "pinned"`);
    return pinned.rows.map((row) => ({ id: Number(row.id), slot: 1 }));
  }
}

/** The featured posts' ids; the two slots keep them to two, and a store that holds more is refused, never shown. */
function featuredOf(rows: readonly FeaturedRow[]): FeaturedIds {
  const ids = featuredIdsOf(rows.map((row) => row.id));
  if (ids === null) throw new Error("more than two outreach posts are featured");
  return ids;
}

/** Everything stored: the posts with their versions in site order and the tag list in one batch, then the featured posts in a second read. */
export async function readStoredOutreach(): Promise<StoredOutreach> {
  const db = getDb();
  const [versionRowsRead, tagRows, tagList] = await db.batch([
    db
      .select({ id: outreachPosts.id, siteOrder: outreachPosts.siteOrder, version: outreachPostVersions })
      .from(outreachPosts)
      .innerJoin(outreachPostVersions, eq(outreachPostVersions.postId, outreachPosts.id))
      .orderBy(asc(outreachPosts.siteOrder), asc(outreachPosts.id)),
    db.select().from(outreachPostTags).orderBy(asc(outreachPostTags.position)),
    db.select().from(outreachTags).orderBy(asc(outreachTags.listOrder), asc(outreachTags.id)),
  ]);

  const tagsOf = new Map<string, string[]>();
  for (const row of tagRows) {
    const key = `${row.postId}:${row.version}`;
    tagsOf.set(key, [...(tagsOf.get(key) ?? []), row.tagName]);
  }
  type Row = (typeof versionRowsRead)[number]["version"];
  const byId = new Map<number, { siteOrder: number; rows: Row[] }>();
  for (const row of versionRowsRead) {
    const entry = byId.get(row.id) ?? { siteOrder: row.siteOrder, rows: [] };
    entry.rows.push(row.version);
    byId.set(row.id, entry);
  }
  const posts = [...byId].flatMap(([id, entry]): PostItem[] => {
    const tags = (row: Row) => tagsOf.get(`${id}:${row.version}`) ?? [];
    const published = entry.rows.find((row) => row.version === "published");
    const draft = entry.rows.find((row) => row.version === "draft");
    // A live post's draft is whole; only a post never published keeps a draft that is not (`PostVersions`).
    const version: PostVersions | null =
      published !== undefined
        ? {
            state: "published",
            published: postFromColumns(published, tags(published)),
            draft: draft === undefined ? null : postFromColumns(draft, tags(draft)),
          }
        : draft === undefined
          ? null
          : { state: "draft", draft: draftFromColumns(draft, tags(draft)) };
    return version === null ? [] : [{ id, siteOrder: entry.siteOrder, version }];
  });

  return {
    posts,
    tags: tagList.map((row): OutreachTag => ({ name: row.name, award: row.award })),
    featured: featuredOf(await readFeaturedRows()),
  };
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
function versionValues(postId: number, kind: VersionKind, post: OutreachDraft) {
  const c = postColumns(post);
  return {
    version: { postId, version: kind, ...c, body: [...c.body], photos: [...c.photos] },
    tags: post.tags.map((tagName, i) => ({ postId, version: kind, tagName, position: i + 1 })),
  };
}

function versionsValues(postId: number, version: PostVersions) {
  const all = versionRows(version).map((row) => versionValues(postId, row.kind, row.content));
  return { versions: all.map((v) => v.version), tags: all.flatMap((v) => v.tags) };
}

const databasePostStore: PostStore = {
  list: async () => (await readStoredOutreach()).posts,

  async create(version, siteOrder) {
    const [only, ...more] = versionRows(version);
    // A new item holds one version: a draft, or what was published at once.
    if (more.length > 0) throw new Error("a new outreach post holds one version");
    const c = postColumns(only.content);
    const insertPost = sql`
        WITH "post" AS (INSERT INTO ${outreachPosts} ("site_order") VALUES (${siteOrder}) RETURNING "id"),
        "version" AS (
          INSERT INTO ${outreachPostVersions} ("post_id", "version", "title", "date", "place", "summary", "summary_phone", "lead", "body", "photos", "channels", "gallery")
          SELECT "id", ${only.kind}::content_version, ${c.title}, ${c.date}::date, ${c.place}, ${c.summary}, ${c.summaryPhone}, ${c.lead},
            ${json(c.body)}, ${json(c.photos)}, ${json(c.channels)}, ${c.gallery === null ? null : json(c.gallery)}
          FROM "post"
          RETURNING "post_id"
        )`;
    // A new post's draft may have no tag yet (board 74f).
    const tagRows = only.content.tags.map((name, i) => sql`(${name}, ${i + 1}::integer)`);
    const created = await runAuditQuery((db) =>
      db.execute<{ post_id: number }>(
        tagRows.length === 0
          ? sql`${insertPost} SELECT "post_id" FROM "version"`
          : sql`${insertPost}
        INSERT INTO ${outreachPostTags} ("post_id", "version", "tag_name", "position")
        SELECT "post_id", ${only.kind}::content_version, "tag"."name", "tag"."position"
        FROM "version", (VALUES ${sql.join(tagRows, sql`, `)}) AS "tag" ("name", "position")
        RETURNING "post_id"`,
      ),
    );
    updateTag(OUTREACH_CACHE_TAG);
    return written({ id: Number(created.rows[0].post_id), siteOrder, version });
  },

  async update(id, version) {
    const before = (await readStoredOutreach()).posts.find((item) => item.id === id) ?? null;
    const { versions, tags } = versionsValues(id, version);
    // The old versions' tags go with them (ON DELETE CASCADE). A draft may have no tag yet.
    await runAuditBatch((db) => [
      db.delete(outreachPostVersions).where(eq(outreachPostVersions.postId, id)),
      db.insert(outreachPostVersions).values(versions),
      ...(tags.length === 0 ? [] : [db.insert(outreachPostTags).values(tags)]),
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

export const databaseOutreachStore: OutreachStore = {
  posts: databasePostStore,

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

  featured: async () => featuredOf(await readFeaturedRows()),

  // The post takes the free slot. A third is refused here before any write,
  // and the slots' unique index refuses one that races past this read.
  async feature(id) {
    const rows = await readFeaturedRows();
    const current = featuredOf(rows);
    if (isFeatured(current, id)) return written(null);
    const next = featuring(current, id);
    if (!next.ok) return next;
    const slot = freeFeaturedSlot(rows.map((row) => row.slot));
    if (slot === null) throw new Error("no featured slot is free under two featured posts");
    await runAuditQuery((db) =>
      db
        .update(outreachPosts)
        .set({ featuredSlot: slot })
        .where(and(eq(outreachPosts.id, id), isNull(outreachPosts.featuredSlot))),
    );
    updateTag(OUTREACH_CACHE_TAG);
    return written(null);
  },

  async unfeature(id) {
    await runAuditQuery((db) => db.update(outreachPosts).set({ featuredSlot: null }).where(eq(outreachPosts.id, id)));
    updateTag(OUTREACH_CACHE_TAG);
    return written(null);
  },
};

/** Uploaded post photos in this deployment's public Blob store, under `post-photos/`, each under a new name. */
export function blobPhotoFiles(): PhotoFiles {
  return publicStorePhotoFiles(ownPublicStoreHost(), { upload: uploadPublicFile, remove: deletePublicFile }, randomUUID);
}
