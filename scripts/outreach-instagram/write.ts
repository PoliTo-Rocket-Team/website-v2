import { outreachPosts, outreachPostTags, outreachPostVersions } from "@/db/schema";
import { postColumns } from "@/lib/outreach-rows";
import type { OutreachPost } from "@/lib/outreach-types";
import type { Built } from "./plan";
import type { ImportDb } from "./snapshot";

// Writes a built plan (issue #886) in the caller's transaction: inserts only.
// A stored post gets a draft version row and its tag rows; a new post gets
// its `outreach_posts` row, then the same. A draft another save stored since
// the plan read the post fails the insert on the one-draft-per-post key, so
// the transaction writes nothing. No row is updated or deleted.

export type Written = { readonly drafts: number; readonly added: number };

type Tx = Parameters<Parameters<ImportDb["transaction"]>[0]>[0];

async function insertDraft(tx: Tx, postId: number, post: OutreachPost): Promise<void> {
  const c = postColumns(post);
  await tx.insert(outreachPostVersions).values({ postId, version: "draft", ...c, body: [...c.body], photos: [...c.photos] });
  await tx.insert(outreachPostTags).values(post.tags.map((tagName, i) => ({ postId, version: "draft" as const, tagName, position: i + 1 })));
}

export async function writePlan(tx: Tx, built: Built): Promise<Written> {
  for (const { postId, draft } of built.drafts) await insertDraft(tx, postId, draft);
  for (const { siteOrder, draft } of built.added) {
    const [row] = await tx.insert(outreachPosts).values({ siteOrder }).returning({ id: outreachPosts.id });
    await insertDraft(tx, row.id, draft);
  }
  return { drafts: built.drafts.length, added: built.added.length };
}
