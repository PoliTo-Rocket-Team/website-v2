import { advisorSeed, type AdvisorItem } from "./advisors";
import { team } from "./team";

// Carrying today's advisors (lib/about/team.ts) into the store (issue #286):
// each published with no draft, in the record's order and standing.
// Migration drizzle/0035_team_page_advisors.sql holds exactly the SQL
// `advisorImportSql` writes, which lib/about/advisors.test.ts checks, and the
// tests start from the same items.

/** The advisors as the store starts: today's, published. */
export function importedAdvisors(): AdvisorItem[] {
  return advisorSeed(team.advisors.people);
}

const quoted = (text: string) => `'${text.replaceAll("'", "''")}'`;

/** The import: one advisor row per item with its site order, then its published version. */
export function advisorImportSql(items: readonly AdvisorItem[] = importedAdvisors()): string {
  const advisors = items.map((item) => `(${item.id}, ${item.siteOrder})`).join(",\n");
  const versions = items
    .map((item) => {
      if (item.version.state !== "published" || item.version.draft !== null) throw new Error("the import carries published advisors only");
      return `(${item.id}, 'published', ${quoted(JSON.stringify(item.version.published))}::jsonb)`;
    })
    .join(",\n");
  return [
    `INSERT INTO "team_page_advisors" ("id", "site_order") VALUES\n${advisors};`,
    `SELECT setval(pg_get_serial_sequence('"team_page_advisors"', 'id'), (SELECT max("id") FROM "team_page_advisors"));`,
    `INSERT INTO "team_page_advisor_versions" ("advisor_id", "version", "advisor") VALUES\n${versions};`,
  ].join("\n--> statement-breakpoint\n");
}
