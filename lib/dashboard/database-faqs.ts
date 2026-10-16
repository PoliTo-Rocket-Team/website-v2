import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { faqs, faqVersions } from "@/db/schema";
import type { Faq } from "@/lib/apply/page";
import type { ContentStore } from "@/lib/content/editor";
import { versionedFromRows, versionRows, type ContentItem, type Versioned, type VersionKind } from "@/lib/content/versioned";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { answerOf, publicFaqs, type FaqVersion } from "@/lib/faq/faq";
import { written } from "./write";

// The database side of the questions on /apply (issue #258): the editor's
// store and the public read /apply makes. Writes go through runAuditQuery or
// runAuditBatch, so the audit triggers of migration 0025 log who made them,
// then refresh the public read (.patterns/audited-mutations.md).

export const FAQS_CACHE_TAG = "faqs";

/** Postgres' "undefined_table": the FAQ migration has not run on this database yet. */
const UNDEFINED_TABLE = "42P01";

function isUndefinedTable(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === UNDEFINED_TABLE) return true;
  }
  return false;
}

/** A `faq_versions` row as a version; the table's checks keep a question and one paragraph at least. */
function versionOf(row: typeof faqVersions.$inferSelect): FaqVersion {
  const answer = answerOf(row.answer);
  if (answer === null) throw new Error(`question ${row.faqId} has an answer with no paragraph`);
  return { question: row.question, answer, updatedAt: new Date(row.updatedAt).toISOString() };
}

/** Every question with its versions, in site order. */
export async function readFaqItems(): Promise<ContentItem<FaqVersion>[]> {
  const rows = await getDb()
    .select({ id: faqs.id, siteOrder: faqs.siteOrder, version: faqVersions })
    .from(faqs)
    .innerJoin(faqVersions, eq(faqVersions.faqId, faqs.id))
    .orderBy(asc(faqs.siteOrder), asc(faqs.id));
  const byId = new Map<number, { siteOrder: number; rows: { kind: VersionKind; content: FaqVersion }[] }>();
  for (const row of rows) {
    const entry = byId.get(row.id) ?? { siteOrder: row.siteOrder, rows: [] };
    entry.rows.push({ kind: row.version.version, content: versionOf(row.version) });
    byId.set(row.id, entry);
  }
  return [...byId].flatMap(([id, entry]) => {
    const version = versionedFromRows(entry.rows);
    return version === null ? [] : [{ id, siteOrder: entry.siteOrder, version }];
  });
}

/**
 * The published questions in site order, cached until a question write
 * refreshes it; null while this database has no FAQ tables yet, so /apply
 * keeps showing the record until the migration runs.
 */
export async function cachedPublishedFaqs(): Promise<Faq[] | null> {
  "use cache";

  cacheTag(FAQS_CACHE_TAG);
  cacheLife("weeks");

  try {
    return publicFaqs(await readFaqItems());
  } catch (error) {
    if (isUndefinedTable(error)) return null;
    throw error;
  }
}

function versionValues(faqId: number, version: Versioned<FaqVersion>) {
  return versionRows(version).map(({ kind, content }) => ({
    faqId,
    version: kind,
    question: content.question,
    answer: [...content.answer],
    updatedAt: content.updatedAt,
  }));
}

export const databaseFaqStore: ContentStore<FaqVersion> = {
  list: readFaqItems,

  async create(version, siteOrder) {
    const [only, ...more] = versionRows(version);
    // A new item holds one version: a draft, or what was published at once.
    if (more.length > 0) throw new Error("a new question holds one version");
    const { question, answer, updatedAt } = only.content;
    const created = await runAuditQuery((db) =>
      db.execute<{ faq_id: number }>(sql`
        WITH "faq" AS (INSERT INTO ${faqs} ("site_order") VALUES (${siteOrder}) RETURNING "id")
        INSERT INTO ${faqVersions} ("faq_id", "version", "question", "answer", "updated_at")
        SELECT "id", ${only.kind}::content_version, ${question}, ARRAY[${sql.join(
          answer.map((paragraph) => sql`${paragraph}`),
          sql`, `,
        )}]::text[], ${updatedAt}::timestamptz
        FROM "faq"
        RETURNING "faq_id"`),
    );
    updateTag(FAQS_CACHE_TAG);
    return written({ id: Number(created.rows[0].faq_id), siteOrder, version });
  },

  async update(id, version) {
    const before = (await readFaqItems()).find((item) => item.id === id) ?? null;
    await runAuditBatch((db) => [
      db.delete(faqVersions).where(eq(faqVersions.faqId, id)),
      db.insert(faqVersions).values(versionValues(id, version)),
    ]);
    updateTag(FAQS_CACHE_TAG);
    return written({ id, siteOrder: before?.siteOrder ?? 0, version });
  },

  async remove(id) {
    // Its versions go with it (ON DELETE CASCADE).
    await runAuditQuery((db) => db.delete(faqs).where(eq(faqs.id, id)));
    updateTag(FAQS_CACHE_TAG);
    return written(null);
  },

  async setOrder(slots) {
    if (slots.length === 0) return written(null);
    const [first, ...rest] = slots;
    const update = (db: ReturnType<typeof getDb>, slot: (typeof slots)[number]) =>
      db.update(faqs).set({ siteOrder: slot.siteOrder }).where(eq(faqs.id, slot.id));
    await runAuditBatch((db) => [update(db, first), ...rest.map((slot) => update(db, slot))]);
    updateTag(FAQS_CACHE_TAG);
    return written(null);
  },
};
