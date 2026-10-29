import "server-only";

import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { partners, partnerVersions } from "@/db/schema";
import type { ContentStore } from "@/lib/content/editor";
import { publicItems, versionedFromRows, versionRows, type ContentItem, type Versioned } from "@/lib/content/versioned";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import type { Partner } from "@/lib/partners";
import type { LogoFiles } from "@/lib/partners-editor";
import { partnerColumns, partnerFromColumns } from "@/lib/partners-rows";
import { referencedPublicFiles, type ReferencedFiles } from "@/lib/storage/public-references";
import { uploadPublicFile } from "@/lib/storage/public-store";
import { parsePublicPathname, publicPathname } from "@/lib/storage/pathname";
import { deleteUnreferencedAfter } from "@/lib/storage/unreferenced-delete";
import { writeOverExpected } from "./database-guarded-write";
import { written } from "./write";

// The database side of the partners (issue #256): the editor's store, the
// public read /partners and the home logo strip share, and the logo files in
// the public Blob store. Writes go through runAuditQuery or runAuditBatch, so
// the audit triggers of migration 0023 log who made them, then refresh the
// public read (.patterns/audited-mutations.md).

export const PARTNERS_CACHE_TAG = "partners";

/** Postgres' "undefined_table": the partners migration has not run on this database yet. */
const UNDEFINED_TABLE = "42P01";

function isUndefinedTable(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === UNDEFINED_TABLE) return true;
  }
  return false;
}

/** Every partner with its versions, in site order. */
export async function readPartnerItems(): Promise<ContentItem<Partner>[]> {
  const rows = await getDb()
    .select({ id: partners.id, siteOrder: partners.siteOrder, version: partnerVersions })
    .from(partners)
    .innerJoin(partnerVersions, eq(partnerVersions.partnerId, partners.id))
    .orderBy(asc(partners.siteOrder), asc(partners.id));
  const byId = new Map<number, { siteOrder: number; rows: { kind: "published" | "draft"; content: Partner }[] }>();
  for (const row of rows) {
    const entry = byId.get(row.id) ?? { siteOrder: row.siteOrder, rows: [] };
    entry.rows.push({ kind: row.version.version, content: partnerFromColumns(row.version) });
    byId.set(row.id, entry);
  }
  return [...byId].flatMap(([id, entry]) => {
    const version = versionedFromRows(entry.rows);
    return version === null ? [] : [{ id, siteOrder: entry.siteOrder, version }];
  });
}

/**
 * The published partners in site order, cached until a partner write
 * refreshes it; null while this database has no partners table yet, so the
 * pages keep showing the record until the migration runs.
 */
export async function cachedPublishedPartners(): Promise<Partner[] | null> {
  "use cache";

  cacheTag(PARTNERS_CACHE_TAG);
  cacheLife("weeks");

  try {
    return publicItems(await readPartnerItems());
  } catch (error) {
    if (isUndefinedTable(error)) return null;
    throw error;
  }
}

/** The logo files an item's versions point at. */
function logosOf(version: Versioned<Partner> | null): Set<string> {
  return new Set(version === null ? [] : versionRows(version).map((row) => row.content.logo.src));
}

/**
 * The stored logo files `before` pointed at that `after` no longer does. A
 * logo of the record (public/design/sponsors/) is no stored file and is never
 * deleted.
 */
export function unusedLogoFiles(before: Versioned<Partner> | null, after: Versioned<Partner> | null) {
  const kept = logosOf(after);
  return [...logosOf(before)].flatMap((src) => {
    if (kept.has(src)) return [];
    const pathname = storedLogoPathname(src);
    return pathname === null ? [] : [pathname];
  });
}

/** The public-store pathname of an uploaded logo's URL; null for anything else. */
function storedLogoPathname(src: string) {
  try {
    const pathname = parsePublicPathname(new URL(src).pathname.slice(1));
    return pathname !== null && pathname.startsWith("logos/") ? pathname : null;
  } catch {
    return null;
  }
}

/** The rows of a partner's versions, for a write that must find them as it read them (./database-guarded-write.ts). */
const partnerRows = (id: number) => ({ table: partnerVersions, id: partnerVersions.id, where: eq(partnerVersions.partnerId, id) });

function versionValues(partnerId: number, version: Versioned<Partner>) {
  return versionRows(version).map((row) => ({ partnerId, version: row.kind, ...partnerColumns(row.content) }));
}

export const databasePartnerStore: ContentStore<Partner> = {
  list: readPartnerItems,

  async create(version, siteOrder) {
    const [only, ...more] = versionRows(version);
    // A new item holds one version: a draft, or what was published at once.
    if (more.length > 0) throw new Error("a new partner holds one version");
    const c = partnerColumns(only.content);
    const created = await runAuditQuery((db) =>
      db.execute<{ partner_id: number }>(sql`
        WITH "partner" AS (INSERT INTO ${partners} ("site_order") VALUES (${siteOrder}) RETURNING "id")
        INSERT INTO ${partnerVersions} ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
        SELECT "id", ${only.kind}::content_version, ${c.name}, ${c.tier}::partner_tier, ${c.logoUrl}, ${c.logoWidth}::integer, ${c.logoHeight}::integer,
          ${c.logoKind}::partner_logo_kind, ${c.logoDark}::boolean, ${c.website}, ${c.oneLiner}, ${c.about}, ${c.support}
        FROM "partner"
        RETURNING "partner_id"`),
    );
    updateTag(PARTNERS_CACHE_TAG);
    return written({ id: Number(created.rows[0].partner_id), siteOrder, version });
  },

  async update(id, version, expected) {
    // A logo the write leaves unused goes only when no row names it once the write is in (issue #831).
    const unused = unusedLogoFiles(expected, version);
    const landed = await writeOverExpected(
      partnerRows(id),
      async () => (await readPartnerItems()).find((item) => item.id === id) ?? null,
      expected,
      (db) => [
        db.delete(partnerVersions).where(eq(partnerVersions.partnerId, id)),
        db.insert(partnerVersions).values(versionValues(id, version)),
        referencedPublicFiles(db, unused),
      ],
    );
    if (!landed.ok) return landed;
    updateTag(PARTNERS_CACHE_TAG);
    await deleteUnreferencedAfter("partner-logo", unused, landed.value.results.at(-1) as ReferencedFiles);
    return written({ id, siteOrder: landed.value.before?.siteOrder ?? 0, version });
  },

  async remove(id) {
    const before = (await readPartnerItems()).find((item) => item.id === id) ?? null;
    const unused = unusedLogoFiles(before?.version ?? null, null);
    // Its versions go with it (ON DELETE CASCADE).
    const [, referenced] = await runAuditBatch((db) => [db.delete(partners).where(eq(partners.id, id)), referencedPublicFiles(db, unused)]);
    updateTag(PARTNERS_CACHE_TAG);
    await deleteUnreferencedAfter("partner-logo", unused, referenced);
    return written(null);
  },

  async setOrder(slots) {
    if (slots.length === 0) return written(null);
    const [first, ...rest] = slots;
    const update = (db: ReturnType<typeof getDb>, slot: (typeof slots)[number]) =>
      db.update(partners).set({ siteOrder: slot.siteOrder }).where(eq(partners.id, slot.id));
    await runAuditBatch((db) => [update(db, first), ...rest.map((slot) => update(db, slot))]);
    updateTag(PARTNERS_CACHE_TAG);
    return written(null);
  },
};

/** Uploaded logos go to the public Blob store, under `logos/`, each under a new name. */
export const blobLogoFiles: LogoFiles = {
  put: async (logo) => (await uploadPublicFile(publicPathname("logo", `${randomUUID()}.png`), logo.bytes, logo.contentType)).url,
};
