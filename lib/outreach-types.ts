import type { NonEmpty } from "./about/alumni-types";
import type { Copy } from "./projects";

// The Outreach page (/outreach) and its post pages (/outreach/<slug>) as
// data, drawn by components/outreach/. The dashboard edits the summit, the
// posts and the tags (issue #287), so every field is a plain value a form can
// fill. A fact a post does not have is an absent key, never an empty string.

/** A day, written YYYY-MM-DD. */
export type IsoDate = `${number}-${number}-${number}`;

/** A photo in public/outreach/, given as its path from the site root. */
export type OutreachPhoto = { src: `/outreach/${string}`; alt: string };

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

export type ChannelName = "instagram" | "linkedin";

/** The channels a post was shared on: one or both, never none. */
export type Channels =
  | { instagram: Channel; linkedin?: Channel }
  | { instagram?: Channel; linkedin: Channel };

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
  /** In any order; the page shows them newest first. */
  posts: readonly OutreachPost[];
  tags: readonly OutreachTag[];
};
