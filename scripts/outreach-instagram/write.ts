import { and, eq } from "drizzle-orm";
import { outreachPosts, outreachPostTags, outreachPostVersions, outreachTags } from "@/db/schema";
import { postColumns } from "@/lib/outreach-rows";
import type { OutreachPost } from "@/lib/outreach-types";
import type { Built } from "./plan";
import type { ImportDb } from "./snapshot";

// Writes a built plan (issue #886) in the caller's transaction. It adds the
// new tags at the end of the tag list; gives a stored post a draft row and
// its tag rows; adds a new post's `outreach_posts` row, then the same; and
// replaces a draft an earlier run wrote: that row's fields, and its tag rows.
// It never touches a published row, and the plan never names a draft the
// import did not write. A draft another save stored since the plan read the
// post fails the insert on the one-draft-per-post key, so the transaction
// writes nothing.

export type Written = { readonly drafts: number; readonly redrafts: number; readonly added: number; readonly tags: number };

type Tx = Parameters<Parameters<ImportDb["transaction"]>[0]>[0];

async function insertTags(tx: Tx, postId: number, post: OutreachPost): Promise<void> {
  await tx.insert(outreachPostTags).values(post.tags.map((tagName, i) => ({ postId, version: "draft" as const, tagName, position: i + 1 })));
}

async function insertDraft(tx: Tx, postId: number, post: OutreachPost): Promise<void> {
  const c = postColumns(post);
  await tx.insert(outreachPostVersions).values({ postId, version: "draft", ...c, body: [...c.body], photos: [...c.photos] });
  await insertTags(tx, postId, post);
}

/** Replaces the draft an earlier run wrote on this post: its fields, then its tags. */
async function replaceDraft(tx: Tx, postId: number, post: OutreachPost): Promise<void> {
  const c = postColumns(post);
  const draftOf = and(eq(outreachPostVersions.postId, postId), eq(outreachPostVersions.version, "draft"));
  const replaced = await tx
    .update(outreachPostVersions)
    .set({ ...c, body: [...c.body], photos: [...c.photos], updatedAt: new Date().toISOString() })
    .where(draftOf)
    .returning({ id: outreachPostVersions.id });
  if (replaced.length !== 1) throw new Error(`post ${postId} holds no draft to replace`);
  await tx.delete(outreachPostTags).where(and(eq(outreachPostTags.postId, postId), eq(outreachPostTags.version, "draft")));
  await insertTags(tx, postId, post);
}

/** Writes the plan; answers the post each key's draft is now on, with the counts. */
export async function writePlan(tx: Tx, built: Built, lastTagOrder: number): Promise<{ written: Written; postIds: ReadonlyMap<string, number> }> {
  const postIds = new Map<string, number>();
  if (built.newTags.length > 0) await tx.insert(outreachTags).values(built.newTags.map((name, i) => ({ name, listOrder: lastTagOrder + i + 1 })));
  for (const { key, postId, replaces, draft } of built.drafts) {
    await (replaces ? replaceDraft : insertDraft)(tx, postId, draft);
    postIds.set(key, postId);
  }
  for (const { key, target, draft } of built.posts) {
    if (target.kind === "reuse") {
      await replaceDraft(tx, target.postId, draft);
      postIds.set(key, target.postId);
    } else {
      const [row] = await tx.insert(outreachPosts).values({ siteOrder: target.siteOrder }).returning({ id: outreachPosts.id });
      await insertDraft(tx, row.id, draft);
      postIds.set(key, row.id);
    }
  }
  const redrafts = built.drafts.filter((d) => d.replaces).length + built.posts.filter((p) => p.target.kind === "reuse").length;
  return {
    written: { drafts: built.drafts.length - built.drafts.filter((d) => d.replaces).length, redrafts, added: built.posts.filter((p) => p.target.kind === "add").length, tags: built.newTags.length },
    postIds,
  };
}
