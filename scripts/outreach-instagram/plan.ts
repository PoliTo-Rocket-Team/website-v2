import type { NonEmpty } from "@/lib/about/alumni-types";
import { editorVersion, publicVersion } from "@/lib/content/versioned";
import { slugOf } from "@/lib/outreach";
import { checkNewTag, checkPostAddress, checkPostTags } from "@/lib/outreach-editor";
import { outreachPostOf } from "@/lib/outreach-rows";
import { titleOf, type BodyBlock, type OutreachPost, type OutreachTag, type PhotoSrc, type PostGalleryPhoto, type PostItem } from "@/lib/outreach-types";
import { fingerprintOf, type Ledger } from "./ledger";
import type { Snapshot } from "./snapshot";
import type { ExistingPost, NewPost, Source, SourcePhoto } from "./source";

// What the import will write (issue #886), worked out from the source, the
// ledger and what the database holds, before any photo is uploaded. It never
// touches a published version, and never a draft it did not write:
//
// - An existing post gets a draft: its published version with the longer
//   body, and with the carousel photos added to its gallery after any it has.
//   The schema holds one published and one draft row per post
//   (`outreach_post_versions_post_version_unique`). A post with no draft gets
//   a new one. A post whose draft the ledger names, unchanged since, has that
//   draft updated. A post holding any other draft is skipped: writing would
//   overwrite someone else's draft.
// - A post Instagram has and the site does not is a post that holds a draft
//   only, with no channel: the export gives no post links. Its first gallery
//   photo is also its cover. The first run adds it after every stored post in
//   the site order; a later run finds it through the ledger and updates its
//   draft, so no post is added twice. Once the owner has published it or
//   changed its draft, the import leaves it alone.
// - A tag the new posts need that the list lacks is added at the list's end.
//
// The owner reads the drafts in the dashboard and publishes each one there.

export type SkipKind = "no-post" | "several-posts" | "has-draft" | "changed-since" | "address-taken" | "unknown-tag";

export type Skip = { readonly kind: SkipKind; readonly title: string; readonly detail?: string };

/** A draft for a stored post: a new one, or the one an earlier run wrote, replaced. */
export type DraftStep = {
  readonly postId: number;
  /** What the post shows now; the draft starts from it. */
  readonly published: OutreachPost;
  readonly entry: ExistingPost;
  readonly replaces: boolean;
};

/** Where a new post's draft goes: a post added at its place in the site order, or the draft-only post an earlier run added. */
export type PostTarget = { readonly kind: "add"; readonly siteOrder: number } | { readonly kind: "reuse"; readonly postId: number };

export type PostStep = { readonly target: PostTarget; readonly entry: NewPost };

export type Plan = {
  readonly drafts: readonly DraftStep[];
  readonly posts: readonly PostStep[];
  /** The source's new tags the list lacks, in source order. */
  readonly newTags: readonly string[];
  readonly skipped: readonly Skip[];
};

/** Whether the ledger names this draft on this post as one an earlier run wrote, unchanged since. */
function written(ledger: Ledger, key: string, postId: number, draft: Parameters<typeof fingerprintOf>[0]): boolean {
  const entry = ledger.get(key);
  return entry !== undefined && entry.postId === postId && entry.fingerprint === fingerprintOf(draft);
}

function draftStep(entry: ExistingPost, snapshot: Snapshot, ledger: Ledger): DraftStep | Skip {
  const holders = snapshot.posts.filter((item) => publicVersion(item.version)?.title === entry.title);
  if (holders.length === 0) return { kind: "no-post", title: entry.title };
  if (holders.length > 1) return { kind: "several-posts", title: entry.title, detail: `posts ${holders.map((h) => h.id).join(", ")}` };
  const [item] = holders;
  if (item.version.state !== "published") throw new Error("a post with a published title is published");
  const { draft, published } = item.version;
  if (draft === null) return { postId: item.id, published, entry, replaces: false };
  if (written(ledger, entry.key, item.id, draft)) return { postId: item.id, published, entry, replaces: true };
  return { kind: "has-draft", title: entry.title, detail: `post ${item.id}` };
}

/** The post an earlier run added for this key, when the ledger names one still stored. */
function addedBefore(entry: NewPost, snapshot: Snapshot, ledger: Ledger): PostItem | null {
  const known = ledger.get(entry.key);
  return known === undefined ? null : (snapshot.posts.find((item) => item.id === known.postId) ?? null);
}

const isSkip = (step: object): step is Skip => "kind" in step;

/** The source's new tags the list lacks; throws when one differs from a listed tag only in case. */
function tagsToAdd(source: Source, list: readonly OutreachTag[]): string[] {
  return source.newTags.filter((name) => {
    if (list.some((t) => t.name === name)) return false;
    const checked = checkNewTag(name, list);
    if (!checked.ok) throw new Error(`The source's new tag "${name}": ${checked.error}`);
    return true;
  });
}

/** The plan: each source post as a step or a skip, in source order. */
export function planImport(source: Source, snapshot: Snapshot, ledger: Ledger): Plan {
  const drafts: DraftStep[] = [];
  const posts: PostStep[] = [];
  const skipped: Skip[] = [];
  for (const entry of source.existing) {
    const step = draftStep(entry, snapshot, ledger);
    if (isSkip(step)) skipped.push(step);
    else drafts.push(step);
  }
  const newTags = tagsToAdd(source, snapshot.tags);
  const known = new Set([...snapshot.tags.map((t) => t.name), ...newTags]);
  const newSlugs = new Set<string>();
  let siteOrder = snapshot.lastSiteOrder;
  for (const entry of source.added) {
    const unknown = entry.tags.find((tag) => !known.has(tag));
    if (unknown !== undefined) {
      skipped.push({ kind: "unknown-tag", title: entry.title, detail: unknown });
      continue;
    }
    const before = addedBefore(entry, snapshot, ledger);
    if (before !== null && !(before.version.state === "draft" && written(ledger, entry.key, before.id, before.version.draft))) {
      skipped.push({ kind: "changed-since", title: entry.title, detail: `post ${before.id}` });
      continue;
    }
    const address = checkPostAddress(entry, before?.id ?? null, snapshot.posts);
    if (!address.ok || newSlugs.has(slugOf(entry))) {
      const holder = snapshot.posts.find((item) => item.id !== before?.id && slugOf(editorVersion(item.version)) === slugOf(entry));
      skipped.push({ kind: "address-taken", title: entry.title, detail: `/outreach/${slugOf(entry)}${holder === undefined ? "" : `, held by "${titleOf(editorVersion(holder.version))}"`}` });
      continue;
    }
    newSlugs.add(slugOf(entry));
    posts.push({ target: before === null ? { kind: "add", siteOrder: ++siteOrder } : { kind: "reuse", postId: before.id }, entry });
  }
  return { drafts, posts, newTags, skipped };
}

/** The photo files the plan's steps carry, once each, in the order they first appear. */
export function planFiles(plan: Plan): string[] {
  return [...new Set([...plan.drafts.map((d) => d.entry), ...plan.posts.map((p) => p.entry)].flatMap((e) => e.gallery.map((p) => p.file)))];
}

/** What a plan stands for: two plans with one key write the same rows. */
export function planKey(plan: Plan): string {
  return JSON.stringify([plan.drafts.map((d) => [d.postId, d.replaces, d.entry.key]), plan.posts.map((p) => [p.target, p.entry.key]), plan.newTags]);
}

/** A plan's steps with every photo stored: the versions the write inserts or replaces. */
export type Built = {
  readonly newTags: readonly string[];
  readonly drafts: readonly { readonly key: string; readonly postId: number; readonly replaces: boolean; readonly draft: OutreachPost }[];
  readonly posts: readonly { readonly key: string; readonly target: PostTarget; readonly draft: OutreachPost }[];
};

function galleryPhoto(photo: SourcePhoto, srcOf: (file: string) => PhotoSrc): PostGalleryPhoto {
  return { src: srcOf(photo.file), alt: photo.alt, ...(photo.caption !== undefined && { caption: photo.caption }) };
}

/** `value` as a whole post, or the import fails: every version it writes is one the editor could publish. */
function wholePost(value: unknown, title: string): OutreachPost {
  const post = outreachPostOf(value);
  if (post === null) throw new Error(`the version planned for "${title}" is not a whole post`);
  return post;
}

/** The draft of a stored post: what it shows now, with the longer body and the carousel photos after its own gallery's. */
export function draftOf(published: OutreachPost, body: NonEmpty<BodyBlock>, photos: NonEmpty<PostGalleryPhoto>): OutreachPost {
  const items: NonEmpty<PostGalleryPhoto> = [...(published.gallery?.items ?? []), ...photos] as unknown as NonEmpty<PostGalleryPhoto>;
  return wholePost({ ...published, body, gallery: { items } }, published.title);
}

/** A new post's draft: its fields, its first gallery photo as its cover, and no channel. */
export function newPostOf(entry: NewPost, photos: NonEmpty<PostGalleryPhoto>): OutreachPost {
  const cover = { src: photos[0].src, alt: photos[0].alt };
  return wholePost(
    {
      title: entry.title,
      date: entry.date,
      place: entry.place,
      tags: entry.tags,
      summary: entry.summary,
      lead: entry.lead,
      body: entry.body,
      photos: [cover],
      channels: {},
      gallery: { items: photos },
    },
    entry.title,
  );
}

/** The plan with each photo at the URL it was stored at. */
export function buildPlan(plan: Plan, snapshot: Snapshot, srcOf: (file: string) => PhotoSrc): Built {
  const photosOf = (gallery: NonEmpty<SourcePhoto>) => gallery.map((p) => galleryPhoto(p, srcOf)) as unknown as NonEmpty<PostGalleryPhoto>;
  const tags: OutreachTag[] = [...snapshot.tags, ...plan.newTags.map((name) => ({ name, award: false }))];
  return {
    newTags: plan.newTags,
    drafts: plan.drafts.map((d) => ({ key: d.entry.key, postId: d.postId, replaces: d.replaces, draft: draftOf(d.published, d.entry.body, photosOf(d.entry.gallery)) })),
    posts: plan.posts.map((p) => {
      const draft = newPostOf(p.entry, photosOf(p.entry.gallery));
      const checked = checkPostTags(draft, tags);
      if (!checked.ok) throw new Error(`"${p.entry.title}": ${checked.error}`);
      return { key: p.entry.key, target: p.target, draft };
    }),
  };
}
