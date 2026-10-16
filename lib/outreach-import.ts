import { outreachRecord } from "./outreach";
import type { StoredOutreach } from "./outreach-editor";
import { postColumns, summitColumns, type OutreachPostColumns, type OutreachSummitColumns } from "./outreach-rows";
import type { OutreachContent } from "./outreach-types";

// Carrying the Outreach record of lib/outreach.ts into the database (issue
// #287): the tag list with Award as the award tag, the summit, and every post
// in the record's order, each published with no draft. The photos stay where
// they are, in public/outreach/. Migration
// drizzle/0032_outreach_audit_and_import.sql holds exactly the SQL
// `outreachImportSql` writes, which lib/outreach-store.test.ts checks, and the
// dummy data (previews) starts from the same items.

/** The record as stored: post ids and site order from 1, everything published with no draft. */
export function importedOutreach(record: OutreachContent = outreachRecord): StoredOutreach {
  return {
    posts: record.posts.map((post, i) => ({
      id: i + 1,
      siteOrder: i + 1,
      version: { state: "published", published: post, draft: null },
    })),
    summit: { state: "published", published: record.feature, draft: null },
    tags: record.tags,
  };
}

const POST_COLUMN_NAMES: Readonly<Record<keyof OutreachPostColumns, string>> = {
  title: "title",
  date: "date",
  place: "place",
  summary: "summary",
  summaryPhone: "summary_phone",
  lead: "lead",
  body: "body",
  photos: "photos",
  channels: "channels",
};

const SUMMIT_COLUMN_NAMES: Readonly<Record<keyof OutreachSummitColumns, string>> = {
  eyebrow: "eyebrow",
  title: "title",
  story: "story",
  storyPhone: "story_phone",
  photoSrc: "photo_src",
  photoAlt: "photo_alt",
  editions: "editions",
};

/** A SQL literal: strings quoted with their quotes doubled, numbers and booleans as they are, anything else as JSON. */
function literal(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const quoted = (text: string) => `'${text.replaceAll("'", "''")}'`;
  return typeof value === "string" ? quoted(value) : `${quoted(JSON.stringify(value))}::jsonb`;
}

function namesAndValues<C extends object>(names: Readonly<Record<keyof C, string>>, columns: C): { names: string; values: string } {
  const keys = Object.keys(names) as (keyof C)[];
  return {
    names: keys.map((k) => `"${names[k]}"`).join(", "),
    values: keys.map((k) => literal(columns[k])).join(", "),
  };
}

/**
 * The tag list in one statement, the summit's published version in one, then
 * one statement per post: its row in `outreach_posts` at its site order, its
 * published version, and that version's tags, written in one go so the
 * version and its tags find the post's new id.
 */
export function outreachImportSql(record: OutreachContent = outreachRecord): string {
  const stored = importedOutreach(record);
  const tags = [
    `INSERT INTO "outreach_tags" ("name", "award", "list_order") VALUES`,
    stored.tags.map((tag, i) => `(${literal(tag.name)}, ${tag.award}, ${i + 1})`).join(",\n") + ";",
  ].join("\n");
  const summit = namesAndValues(SUMMIT_COLUMN_NAMES, summitColumns(stored.summit.published));
  const summitSql = [
    `INSERT INTO "outreach_summit_versions" ("version", ${summit.names})`,
    `VALUES ('published', ${summit.values});`,
  ].join("\n");
  const posts = stored.posts.map((item) => {
    if (item.version.state !== "published" || item.version.draft !== null) throw new Error("the import publishes every post");
    const post = item.version.published;
    const columns = namesAndValues(POST_COLUMN_NAMES, postColumns(post));
    const postTags = post.tags.map((name, i) => `(${literal(name)}, ${i + 1})`).join(", ");
    return [
      `WITH "post" AS (INSERT INTO "outreach_posts" ("site_order") VALUES (${item.siteOrder}) RETURNING "id"),`,
      `"version" AS (INSERT INTO "outreach_post_versions" ("post_id", "version", ${columns.names})`,
      `SELECT "id", 'published', ${columns.values} FROM "post" RETURNING "post_id")`,
      `INSERT INTO "outreach_post_tags" ("post_id", "version", "tag_name", "position")`,
      `SELECT "post_id", 'published', "tag"."name", "tag"."position" FROM "version", (VALUES ${postTags}) AS "tag" ("name", "position");`,
    ].join("\n");
  });
  return [tags, summitSql, ...posts].join("\n--> statement-breakpoint\n");
}
