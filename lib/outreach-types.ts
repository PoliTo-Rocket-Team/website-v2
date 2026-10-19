import type { NonEmpty } from "./about/alumni-types";
import type { ContentStore } from "./content/editor";
import type { ContentItem, Versioned } from "./content/versioned";
import type { Copy } from "./projects";

// The Outreach page (/outreach) and its post pages (/outreach/<slug>) as
// data, drawn by components/outreach/. The dashboard edits the summit, the
// posts and the tags (issue #287), so every field is a plain value a form can
// fill. A fact a post does not have is an absent key, never an empty string.

/** A day, written YYYY-MM-DD. */
export type IsoDate = `${number}-${number}-${number}`;

/**
 * Where a post or project photo is: a file of the site in public/outreach/ or
 * public/project-photos/ (issue #371), given as its path from the site root; a
 * file uploaded from the dashboard, at its public
 * Blob store URL (issue #291); or, on a preview, an upload kept nowhere, as a
 * data URL the page shows until the next load (lib/dummy-data/outreach.ts).
 */
export type PhotoSrc = `/outreach/${string}` | `/project-photos/${string}` | `https://${string}` | `data:image/${string}`;

/** A photo with its alt text, which every photo has. */
export type OutreachPhoto = { src: PhotoSrc; alt: string };

/**
 * One tag in the tag list: what kind of event a post is about. Tags are data
 * (issue #287), so the editor can add one. A post carries its tags by name.
 * `award` marks the one tag whose posts the header counts as awards (Award).
 */
export type OutreachTag = { readonly name: string; readonly award: boolean };

/**
 * Where the post was first shared. The caption is the start of the post's
 * text. `account` names whose post it is when another account shared it (the
 * organiser, a sponsor); absent means ours.
 */
export type Channel = { url: string; caption: string; account?: string };

/** Every channel a post can link to, in the order the page and the editor list them (board 74h). */
export const CHANNEL_NAMES = ["instagram", "linkedin", "youtube", "facebook", "x", "tiktok", "other"] as const;

export type ChannelName = (typeof CHANNEL_NAMES)[number];

/** Each channel's name as the editor and the post's cards write it. */
export const CHANNEL_LABELS: Readonly<Record<ChannelName, string>> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  facebook: "Facebook",
  x: "X",
  tiktok: "TikTok",
  other: "Other link",
};

/** The two channels the team always posts on; a post links at least one of them. */
export type MainChannelName = "instagram" | "linkedin";

/** The channels "+ Add another channel" offers beside them (board 74h). */
export type ExtraChannelName = Exclude<ChannelName, MainChannelName>;

/**
 * The channels a post was shared on: Instagram, LinkedIn or both, never
 * neither (the `outreach_post_versions_channels` check holds the same), and
 * any of the extra channels beside them.
 */
export type Channels = ({ instagram: Channel; linkedin?: Channel } | { instagram?: Channel; linkedin: Channel }) &
  Partial<Record<ExtraChannelName, Channel>>;

/** One block of a post's body, drawn in the 760px text column. */
export type BodyBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  /** A boxed fact, such as an award, with its label above it. */
  | { kind: "highlight"; label: string; text: string };

export type OutreachPost = {
  /** The page's address is made from this (`slugOf` in lib/outreach.ts). */
  title: string;
  date: IsoDate;
  /** City and country, when the post says where. */
  place?: string;
  /** Names from the tag list, in the order the post shows them. */
  tags: NonEmpty<string>;
  /** One or two lines on the post's card; the phone text may be shorter. */
  summary: Copy;
  /** The line under the title on the post page. */
  lead: string;
  body: NonEmpty<BodyBlock>;
  /** The first is the card photo and the post's top photo; more make the photo grid. */
  photos: NonEmpty<OutreachPhoto>;
  channels: Channels;
};

/**
 * A post that may not be whole yet: the page the editor sees as they type
 * (boards 74c and 74f), and a new post saved before it is published, since
 * Save draft works at any point (board 74f, issue #292). Its title, lead and
 * summary may be empty; it may have no tag, text block, photo or channel
 * yet; a text block, a photo's alt text or a channel's link may be blank.
 * Every `OutreachPost` is one too. Only a whole `OutreachPost` is published.
 */
export type OutreachDraft = Omit<OutreachPost, "tags" | "body" | "photos" | "channels"> & {
  tags: readonly string[];
  body: readonly BodyBlock[];
  photos: readonly OutreachPhoto[];
  channels: Partial<Record<ChannelName, Channel>>;
};

/** What a draft with no title yet is called on its page, in the list and in its address (board 74f). */
export const UNTITLED_POST = "Untitled post";

/** The title a post goes by: "Untitled post" while a draft has none. */
export function titleOf(post: Pick<OutreachDraft, "title">): string {
  return post.title.trim() || UNTITLED_POST;
}

/** A post's versions: a whole published post with optional whole draft changes, or a never-published draft that may not be whole. */
export type PostVersions = Versioned<OutreachPost, OutreachDraft>;

/** A stored post with its id and place in the site order. */
export type PostItem = ContentItem<OutreachPost, OutreachDraft>;

/** Where the posts are kept: the database, or the dummy data on previews. */
export type PostStore = ContentStore<OutreachPost, OutreachDraft>;

/** One edition of the featured summit. */
export type Edition = { year: number; place: string };

/** The summit the team started, featured above the posts. */
export type OutreachFeature = {
  /** "STARTED BY US · 2023". */
  eyebrow: string;
  title: string;
  story: Copy;
  photo: OutreachPhoto;
  /** Oldest first; the first is the one we started. */
  editions: NonEmpty<Edition>;
};

/**
 * The page's own words. They stay in code: the editor changes the summit and
 * the posts, never the header or the intro.
 */
export type OutreachCopy = {
  description: string;
  header: { eyebrow: string; title: string; intro: string };
  /** Section title over the year filter and the post cards. */
  postsTitle: string;
};

/**
 * What the store keeps and the editor changes (issue #287): the summit, the
 * posts and the tag list. The public pages read the published versions.
 */
export type OutreachContent = {
  feature: OutreachFeature;
  /**
   * The published post pinned to the top of /outreach (issue #392), shown in
   * the Featured card and never in `posts`; null while none is.
   */
  pinned: OutreachPost | null;
  /** Every other published post, in any order; the page shows them newest first. */
  posts: readonly OutreachPost[];
  tags: readonly OutreachTag[];
};

/** The Outreach record of lib/outreach.ts, as the 0032 import carried it in: the summit, the posts and the tags, nothing pinned yet. */
export type OutreachRecord = Omit<OutreachContent, "pinned">;
