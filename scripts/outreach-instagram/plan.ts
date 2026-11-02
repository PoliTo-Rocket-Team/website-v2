import type { NonEmpty } from "@/lib/about/alumni-types";
import { editorVersion, publicVersion } from "@/lib/content/versioned";
import { slugOf } from "@/lib/outreach";
import { checkPostAddress, checkPostTags } from "@/lib/outreach-editor";
import { outreachPostOf } from "@/lib/outreach-rows";
import { titleOf, type BodyBlock, type OutreachPost, type PhotoSrc, type PostGalleryPhoto } from "@/lib/outreach-types";
import type { Snapshot } from "./snapshot";
import type { ExistingPost, NewPost, Source, SourcePhoto } from "./source";

// What the import will write (issue #886), worked out from the source and
// what the database holds, before any photo is uploaded. It only inserts:
//
// - An existing post gets a new draft: its published version with the
//   longer body, and with the carousel photos added to its gallery after any
//   it has. The schema holds one published and one draft row per post
//   (`outreach_post_versions_post_version_unique`), so a post that already
//   has a draft is skipped: a new one would overwrite it. Its published row,
//   date and channels stay as they are.
// - A post Instagram has and the site does not is added as a new post that
//   holds a draft only, after every stored post in the site order, with no
//   channel: the export gives no post links. Its first gallery photo is also
//   its cover.
//
// The owner reads the drafts in the dashboard and publishes each one there.

export type SkipKind = "no-post" | "several-posts" | "has-draft" | "address-taken" | "unknown-tag";

export type Skip = { readonly kind: SkipKind; readonly title: string; readonly detail?: string };

/** A new draft for a stored post. */
export type DraftStep = {
  readonly postId: number;
  /** What the post shows now; the draft starts from it. */
  readonly published: OutreachPost;
  readonly entry: ExistingPost;
};

/** A new post, at its place in the site order. */
export type NewStep = { readonly siteOrder: number; readonly entry: NewPost };

export type Plan = {
  readonly drafts: readonly DraftStep[];
  readonly added: readonly NewStep[];
  readonly skipped: readonly Skip[];
};

function draftStep(entry: ExistingPost, snapshot: Snapshot): DraftStep | Skip {
  const holders = snapshot.posts.filter((item) => publicVersion(item.version)?.title === entry.title);
  if (holders.length === 0) return { kind: "no-post", title: entry.title };
  if (holders.length > 1) return { kind: "several-posts", title: entry.title, detail: `posts ${holders.map((h) => h.id).join(", ")}` };
  const [item] = holders;
  if (item.version.state !== "published") throw new Error("a post with a published title is published");
  if (item.version.draft !== null) return { kind: "has-draft", title: entry.title, detail: `post ${item.id}` };
  return { postId: item.id, published: item.version.published, entry };
}

const isSkip = (step: object): step is Skip => "kind" in step;

/** The plan: each source post as a step or a skip, in source order. */
export function planImport(source: Source, snapshot: Snapshot): Plan {
  const drafts: DraftStep[] = [];
  const added: NewStep[] = [];
  const skipped: Skip[] = [];
  for (const entry of source.existing) {
    const step = draftStep(entry, snapshot);
    if (isSkip(step)) skipped.push(step);
    else drafts.push(step);
  }
  const known = new Set(snapshot.tags.map((t) => t.name));
  const newSlugs = new Set<string>();
  let siteOrder = snapshot.lastSiteOrder;
  for (const entry of source.added) {
    const unknown = entry.tags.find((tag) => !known.has(tag));
    if (unknown !== undefined) {
      skipped.push({ kind: "unknown-tag", title: entry.title, detail: unknown });
      continue;
    }
    const address = checkPostAddress(entry, null, snapshot.posts);
    if (!address.ok || newSlugs.has(slugOf(entry))) {
      const holder = snapshot.posts.find((item) => slugOf(editorVersion(item.version)) === slugOf(entry));
      skipped.push({ kind: "address-taken", title: entry.title, detail: `/outreach/${slugOf(entry)}${holder === undefined ? "" : `, held by "${titleOf(editorVersion(holder.version))}"`}` });
      continue;
    }
    newSlugs.add(slugOf(entry));
    added.push({ siteOrder: ++siteOrder, entry });
  }
  return { drafts, added, skipped };
}

/** The photo files the plan's steps carry, once each, in the order they first appear. */
export function planFiles(plan: Plan): string[] {
  return [...new Set([...plan.drafts.map((d) => d.entry), ...plan.added.map((a) => a.entry)].flatMap((e) => e.gallery.map((p) => p.file)))];
}

/** What a plan stands for: two plans with one key write the same rows. */
export function planKey(plan: Plan): string {
  return JSON.stringify([plan.drafts.map((d) => [d.postId, d.entry.title]), plan.added.map((a) => [a.siteOrder, a.entry.title])]);
}

/** A plan's steps with every photo stored: the versions the write inserts. */
export type Built = {
  readonly drafts: readonly { readonly postId: number; readonly draft: OutreachPost }[];
  readonly added: readonly { readonly siteOrder: number; readonly draft: OutreachPost }[];
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

/** The new draft of a stored post: what it shows now, with the longer body and the carousel photos after its own gallery's. */
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
  return {
    drafts: plan.drafts.map((d) => ({ postId: d.postId, draft: draftOf(d.published, d.entry.body, photosOf(d.entry.gallery)) })),
    added: plan.added.map((a) => {
      const draft = newPostOf(a.entry, photosOf(a.entry.gallery));
      const tags = checkPostTags(draft, snapshot.tags);
      if (!tags.ok) throw new Error(`"${a.entry.title}": ${tags.error}`);
      return { siteOrder: a.siteOrder, draft };
    }),
  };
}
