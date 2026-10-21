import { iressStory, outreachRecord } from "./outreach";
import type { StoredOutreach } from "./outreach-editor";
import { postColumns, type OutreachPostColumns } from "./outreach-rows";
import type { OutreachPost, OutreachRecord, PostItem } from "./outreach-types";

// Carrying the Outreach record of lib/outreach.ts into the database (issue
// #287): the tag list with Award as the award tag, and every post in the
// record's order, each published with no draft. The photos stay where they
// are, in public/outreach/. Migration drizzle/0032_outreach_audit_and_import.sql
// holds each statement `outreachImportStatements` writes, which
// lib/outreach-store.test.ts checks. Then the summit's story, published and
// pinned after every record post (issue #392): migration
// drizzle/0044_outreach_pinned_post.sql ends with exactly the SQL
// `pinnedStoryImportSql` writes, and migration 0048 turns that pin into the
// first featured slot (issue #496). The dummy data (previews) and the seed
// start from the same items.

/** The record's posts as stored: ids and site order from 1, each published with no draft. */
function recordItems(record: OutreachRecord): PostItem[] {
  return record.posts.map((post, i) => ({
    id: i + 1,
    siteOrder: i + 1,
    version: { state: "published", published: post, draft: null },
  }));
}

/**
 * What the imports leave stored: the record's posts, then the summit's story
 * after them, published and featured; the tag list.
 */
export function importedOutreach(): StoredOutreach {
  const posts = recordItems(outreachRecord);
  const story: PostItem = {
    id: posts.length + 1,
    siteOrder: posts.length + 1,
    version: { state: "published", published: iressStory, draft: null },
  };
  return {
    posts: [...posts, story],
    tags: outreachRecord.tags,
    featured: [story.id],
  };
}

/** The columns the imports write. They ran before `gallery` existed (migration 0045), and no record post has one. */
const POST_COLUMN_NAMES: Readonly<Record<Exclude<keyof OutreachPostColumns, "gallery">, string>> = {
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

/** A SQL literal: strings quoted with their quotes doubled, numbers and booleans as they are, anything else as JSON. */
function literal(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const quoted = (text: string) => `'${text.replaceAll("'", "''")}'`;
  return typeof value === "string" ? quoted(value) : `${quoted(JSON.stringify(value))}::jsonb`;
}

function namesAndValues<C extends object, K extends keyof C>(names: Readonly<Record<K, string>>, columns: C): { names: string; values: string } {
  const keys = Object.keys(names) as K[];
  return {
    names: keys.map((k) => `"${names[k]}"`).join(", "),
    values: keys.map((k) => literal(columns[k])).join(", "),
  };
}

/**
 * One published post in one statement: `postRow` inserts its row in
 * `outreach_posts` and returns the new id, then its published version and
 * that version's tags follow, written in one go so they find the id.
 */
function publishedPostSql(postRow: string, post: OutreachPost): string {
  if (post.gallery !== undefined) throw new Error("an imported post has no gallery");
  const columns = namesAndValues(POST_COLUMN_NAMES, postColumns(post));
  const postTags = post.tags.map((name, i) => `(${literal(name)}, ${i + 1})`).join(", ");
  return [
    `WITH "post" AS (${postRow} RETURNING "id"),`,
    `"version" AS (INSERT INTO "outreach_post_versions" ("post_id", "version", ${columns.names})`,
    `SELECT "id", 'published', ${columns.values} FROM "post" RETURNING "post_id")`,
    `INSERT INTO "outreach_post_tags" ("post_id", "version", "tag_name", "position")`,
    `SELECT "post_id", 'published', "tag"."name", "tag"."position" FROM "version", (VALUES ${postTags}) AS "tag" ("name", "position");`,
  ].join("\n");
}

/**
 * The tag list in one statement, then one statement per record post at its
 * site order (`publishedPostSql`). Migration 0032 also wrote the summit's
 * published version between the two; the summit left the product (issue
 * #496), and its stored table is kept, read by no code.
 */
export function outreachImportStatements(record: OutreachRecord = outreachRecord): string[] {
  const tags = [
    `INSERT INTO "outreach_tags" ("name", "award", "list_order") VALUES`,
    record.tags.map((tag, i) => `(${literal(tag.name)}, ${tag.award}, ${i + 1})`).join(",\n") + ";",
  ].join("\n");
  const posts = recordItems(record).map((item) => {
    if (item.version.state !== "published" || item.version.draft !== null) throw new Error("the import publishes every post");
    return publishedPostSql(`INSERT INTO "outreach_posts" ("site_order") VALUES (${item.siteOrder})`, item.version.published);
  });
  return [tags, ...posts];
}

/**
 * The summit's story (issue #392) in one statement: published, after every
 * post the database holds, and pinned. It runs once the `pinned` column and
 * its one-pinned index exist, on a database where no post is pinned yet.
 */
export function pinnedStoryImportSql(post: OutreachPost = iressStory): string {
  return publishedPostSql(
    `INSERT INTO "outreach_posts" ("site_order", "pinned") SELECT COALESCE(MAX("site_order"), 0) + 1, true FROM "outreach_posts"`,
    post,
  );
}
