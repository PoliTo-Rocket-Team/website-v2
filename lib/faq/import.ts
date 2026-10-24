import { faqs as record, type Faq } from "@/lib/apply/page";
import type { ContentItem } from "@/lib/content/versioned";
import type { FaqVersion } from "./faq";

// Carrying the questions of lib/apply/page.ts into the database (issue
// #258): each one published, in the record's order. Migration
// drizzle/0025_faqs_audit_and_import.sql holds exactly the SQL
// `faqImportSql` writes, which lib/faq/faq.test.ts checks; the database
// dates each version when the migration runs. The tests start from the same
// items.

/** The record's questions as stored items: ids and site order from 1, each published with no draft, dated `updatedAt`. */
export function importedFaqs(updatedAt: string, list: readonly Faq[] = record): ContentItem<FaqVersion>[] {
  return list.map((faq, i) => ({
    id: i + 1,
    siteOrder: i + 1,
    version: { state: "published", published: { ...faq, updatedAt }, draft: null },
  }));
}

/** A SQL string literal, its quotes doubled. */
function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * One statement per question: its row in `faqs` at its site order, and its
 * published version in `faq_versions`, written in one go so the version finds
 * its question's new id.
 */
export function faqImportSql(list: readonly Faq[] = record): string {
  return list
    .map((faq, i) =>
      [
        `WITH "faq" AS (INSERT INTO "faqs" ("site_order") VALUES (${i + 1}) RETURNING "id")`,
        `INSERT INTO "faq_versions" ("faq_id", "version", "question", "answer")`,
        `SELECT "id", 'published', ${literal(faq.question)}, ARRAY[${faq.answer.map(literal).join(", ")}]::text[] FROM "faq";`,
      ].join("\n"),
    )
    .join("\n--> statement-breakpoint\n");
}
