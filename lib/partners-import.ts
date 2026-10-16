import type { ContentItem } from "@/lib/content/versioned";
import { partners as record, type Partner } from "./partners";
import { partnerColumns, type PartnerColumns } from "./partners-rows";

// Carrying the partners of lib/partners.ts into the database (issue #256):
// each one published, in the record's order, with its tier, texts and logo.
// Migration drizzle/0023_partners_audit_and_import.sql holds exactly the SQL
// `partnerImportSql` writes, which partners-editor.test.ts checks, and the
// dummy data (previews) starts from the same items.

/** The record's partners as stored items: ids and site order from 1, each published with no draft. */
export function importedPartners(list: readonly Partner[] = record): ContentItem<Partner>[] {
  return list.map((partner, i) => ({
    id: i + 1,
    siteOrder: i + 1,
    version: { state: "published", published: partner, draft: null },
  }));
}

const COLUMN_NAMES: Readonly<Record<keyof PartnerColumns, string>> = {
  name: "name",
  tier: "tier",
  logoUrl: "logo_url",
  logoWidth: "logo_width",
  logoHeight: "logo_height",
  logoKind: "logo_kind",
  logoDark: "logo_dark",
  website: "website",
  oneLiner: "one_liner",
  about: "about",
  support: "support",
};

/** A SQL literal: strings quoted with their quotes doubled, numbers and booleans as they are. */
function literal(value: string | number | boolean | null): string {
  if (value === null) return "NULL";
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  return String(value);
}

/**
 * One statement per partner: its row in `partners` at its site order, and its
 * published version in `partner_versions`, written in one go so the version
 * finds its partner's new id.
 */
export function partnerImportSql(list: readonly Partner[] = record): string {
  const keys = Object.keys(COLUMN_NAMES) as (keyof PartnerColumns)[];
  const names = keys.map((k) => `"${COLUMN_NAMES[k]}"`).join(", ");
  return importedPartners(list)
    .map((item) => {
      if (item.version.state !== "published") throw new Error("the import publishes every partner");
      const columns = partnerColumns(item.version.published);
      const values = keys.map((k) => literal(columns[k])).join(", ");
      return [
        `WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (${item.siteOrder}) RETURNING "id")`,
        `INSERT INTO "partner_versions" ("partner_id", "version", ${names})`,
        `SELECT "id", 'published', ${values} FROM "partner";`,
      ].join("\n");
    })
    .join("\n--> statement-breakpoint\n");
}
