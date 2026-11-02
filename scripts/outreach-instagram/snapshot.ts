import { asc, eq, max } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { outreachPosts, outreachPostTags, outreachPostVersions, outreachTags } from "@/db/schema";
import type * as schema from "@/db/schema";
import { draftFromColumns, postFromColumns } from "@/lib/outreach-rows";
import type { OutreachTag, PostItem, PostVersions } from "@/lib/outreach-types";

// What the import reads before it plans (issue #886): every stored post with
// its versions, as the dashboard's own read makes them
// (lib/dashboard/database-outreach.ts, `readStoredOutreach`), the tag list,
// and the last places in the site order and the tag list. Only selects.

export type ImportDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export type Snapshot = {
  readonly posts: readonly PostItem[];
  readonly tags: readonly OutreachTag[];
  /** The highest site order a post holds; 0 with no post. */
  readonly lastSiteOrder: number;
  /** The highest place a tag holds in the tag list; 0 with no tag. */
  readonly lastTagOrder: number;
};

export async function readSnapshot(db: ImportDb): Promise<Snapshot> {
  const versionRows = await db
    .select({ id: outreachPosts.id, siteOrder: outreachPosts.siteOrder, version: outreachPostVersions })
    .from(outreachPosts)
    .innerJoin(outreachPostVersions, eq(outreachPostVersions.postId, outreachPosts.id))
    .orderBy(asc(outreachPosts.siteOrder), asc(outreachPosts.id));
  const tagRows = await db.select().from(outreachPostTags).orderBy(asc(outreachPostTags.position));
  const tagList = await db.select().from(outreachTags).orderBy(asc(outreachTags.listOrder), asc(outreachTags.id));
  const [last] = await db.select({ siteOrder: max(outreachPosts.siteOrder) }).from(outreachPosts);

  const tagsOf = new Map<string, string[]>();
  for (const row of tagRows) {
    const key = `${row.postId}:${row.version}`;
    tagsOf.set(key, [...(tagsOf.get(key) ?? []), row.tagName]);
  }
  type Row = (typeof versionRows)[number]["version"];
  const byId = new Map<number, { siteOrder: number; rows: Row[] }>();
  for (const row of versionRows) {
    const entry = byId.get(row.id) ?? { siteOrder: row.siteOrder, rows: [] };
    entry.rows.push(row.version);
    byId.set(row.id, entry);
  }
  const posts = [...byId].flatMap(([id, entry]): PostItem[] => {
    const tags = (row: Row) => tagsOf.get(`${id}:${row.version}`) ?? [];
    const published = entry.rows.find((row) => row.version === "published");
    const draft = entry.rows.find((row) => row.version === "draft");
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
    lastSiteOrder: last?.siteOrder ?? 0,
    lastTagOrder: tagList.reduce((top, row) => Math.max(top, row.listOrder), 0),
  };
}
