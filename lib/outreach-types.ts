import type { NonEmpty } from "./about/alumni-types";
import type { Copy } from "./projects";

// The Outreach page (/outreach) and its post pages (/outreach/<slug>) as
// data: one record, drawn by components/outreach/. A dashboard will edit it,
// so every field is a plain value a form can fill. A fact a post does not
// have is an absent key, never an empty string.

/** A day, written YYYY-MM-DD. */
export type IsoDate = `${number}-${number}-${number}`;

/** A photo in public/outreach/, given as its path from the site root. */
export type OutreachPhoto = { src: `/outreach/${string}`; alt: string };

/** What kind of event a post is about. Award also feeds the header's award count. */
export type OutreachTag =
  | "Award"
  | "Charity run"
  | "Congress"
  | "Expo"
  | "Fair"
  | "Hackathon"
  | "School"
  | "Summit"
  | "Talk"
  | "Visit";

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
  tags: NonEmpty<OutreachTag>;
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

export type OutreachPage = {
  description: string;
  header: { eyebrow: string; title: string; intro: string };
  feature: OutreachFeature;
  /** Section title over the year filter and the post cards. */
  postsTitle: string;
  /** In any order; the page shows them newest first. */
  posts: NonEmpty<OutreachPost>;
};
