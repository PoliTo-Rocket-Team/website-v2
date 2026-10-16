import { contentEditor, type ContentEditor, type ContentStore } from "@/lib/content/editor";
import { maySiteContent, SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import { textLength } from "@/lib/content/text";
import { publicItems, type ContentItem, type PublishStep, type Versioned } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import type { OutreachContent, OutreachFeature, OutreachPost, OutreachTag } from "./outreach-types";

// The Outreach content as the dashboard keeps it (issue #287): the posts, each
// a content item with a published version and an optional draft
// (lib/content/), the featured summit with the same two versions, and the
// tag list. Each side of the dashboard data interface brings an
// `OutreachStore`: the database (lib/dashboard/database-outreach.ts), or the
// dummy data on previews and in test-developer sessions
// (lib/dummy-data/outreach.ts). The editor puts every write behind the
// site-content gate and keeps a post's tags to the tag list.

/**
 * The summit's versions. It is always published (the import publishes it
 * and no step unpublishes it), with an optional draft beside it.
 */
export type SummitVersions = Extract<Versioned<OutreachFeature>, { state: "published" }>;

/** The summit's versions after Save draft or Publish: as `afterStep` (lib/content/versioned.ts), and never unpublished. */
export function summitAfterStep(current: SummitVersions, content: OutreachFeature, step: PublishStep): SummitVersions {
  return step === "publish"
    ? { state: "published", published: content, draft: null }
    : { state: "published", published: current.published, draft: content };
}

export interface OutreachStore {
  readonly posts: ContentStore<OutreachPost>;
  summit(): Promise<SummitVersions>;
  saveSummit(versions: SummitVersions): Promise<WriteResult<SummitVersions>>;
  /** The tag list, in its order. */
  tags(): Promise<readonly OutreachTag[]>;
  /** A new tag at the end of the list; never the award one. */
  addTag(name: string): Promise<WriteResult<OutreachTag>>;
}

/** Everything a store holds, as the public read and the import see it. */
export type StoredOutreach = {
  readonly posts: readonly ContentItem<OutreachPost>[];
  readonly summit: SummitVersions;
  readonly tags: readonly OutreachTag[];
};

/** What the public pages show: the published posts in site order, the published summit and the tags. A post with only a draft is not there. */
export function publicOutreach(stored: StoredOutreach): OutreachContent {
  return { feature: stored.summit.published, posts: publicItems(stored.posts), tags: stored.tags };
}

/** The longest tag name the list takes; the `outreach_tags` table checks the same. */
export const OUTREACH_TAG_MAX = 32;

/** A new tag's name, trimmed, or why the list cannot take it. Names are compared without case, so "award" is Award. */
export function checkNewTag(name: string, tags: readonly OutreachTag[]): WriteResult<string> {
  const trimmed = name.trim();
  if (trimmed === "") return refused("Write the tag.");
  if (textLength(trimmed) > OUTREACH_TAG_MAX) return refused(`${textLength(trimmed)} characters; the limit is ${OUTREACH_TAG_MAX}.`);
  const same = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  return same === undefined ? written(trimmed) : refused(`${same.name} is already a tag.`);
}

/** The post, or why not: every tag it carries must be on the tag list. */
export function checkPostTags(post: OutreachPost, tags: readonly OutreachTag[]): WriteResult<OutreachPost> {
  const known = new Set(tags.map((t) => t.name));
  const unknown = post.tags.find((name) => !known.has(name));
  return unknown === undefined ? written(post) : refused(`${unknown} is not a tag. Add it to the tag list first.`);
}

export interface OutreachEditor {
  /** The posts through the shared content editor; a save whose post carries a tag off the list is refused. */
  readonly posts: ContentEditor<OutreachPost>;
  /** The summit's versions; null for a viewer the gate refuses. */
  summit(): Promise<SummitVersions | null>;
  /** Save draft or Publish on the summit. `prepare` gets the version the panel opened on, once the gate let the viewer through. */
  saveSummit(
    step: PublishStep,
    prepare: (current: OutreachFeature) => Promise<WriteResult<OutreachFeature>>,
  ): Promise<WriteResult<SummitVersions>>;
  /** The tag list; null for a viewer the gate refuses. */
  tags(): Promise<readonly OutreachTag[] | null>;
  addTag(name: string): Promise<WriteResult<OutreachTag>>;
}

export function outreachEditor(viewer: ViewerStanding, store: OutreachStore): OutreachEditor {
  const allowed = maySiteContent(viewer);
  const posts = contentEditor(viewer, store.posts);
  return {
    posts: {
      ...posts,
      save: (id, step, prepare) =>
        posts.save(id, step, async (current) => {
          const post = await prepare(current);
          return post.ok ? checkPostTags(post.value, await store.tags()) : post;
        }),
    },

    summit: async () => (allowed ? store.summit() : null),

    async saveSummit(step, prepare) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const current = await store.summit();
      const content = await prepare(current.draft ?? current.published);
      return content.ok ? store.saveSummit(summitAfterStep(current, content.value, step)) : content;
    },

    tags: async () => (allowed ? store.tags() : null),

    async addTag(name) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const checked = checkNewTag(name, await store.tags());
      return checked.ok ? store.addTag(checked.value) : checked;
    },
  };
}
