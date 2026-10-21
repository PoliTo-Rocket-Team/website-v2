// The Outreach seed (issue #309): the posts on /outreach and their pages, the
// home page's Track record cards, and the dashboard's Outreach editor (epic
// #254, boards 74 to 74h). It starts from what the import migration carries
// in (lib/outreach-import.ts): the tag list with Award as the award tag, the
// featured summit, every post of the record, published, each with its photo
// and alt text, and the summit's story, published and pinned to the top of
// /outreach (issue #392). The record's posts carry every tag but link Instagram
// and LinkedIn only, so one more published post links every channel type,
// and it has a gallery at the bottom of its page (issue #430).
// The IAC 2024 post holds draft changes, and one new post is a draft saved
// before it is whole (board 74f), never published, so the public pages do
// not show it.

import { outreachPosts, outreachPostTags, outreachPostVersions, outreachSummitVersions, outreachTags } from "@/db/schema";
import { versionRows } from "@/lib/content/versioned";
import { outreachRecord } from "@/lib/outreach";
import { importedOutreach } from "@/lib/outreach-import";
import { postColumns, summitColumns } from "@/lib/outreach-rows";
import type { OutreachDraft, OutreachPost, PostGallery, PostItem } from "@/lib/outreach-types";
import { contentVersionRows } from "./content";
import { rowsOf, tableSeedModule } from "./rows";

const CREATED = "2026-09-12 10:00:00+00";
const PUBLISHED = "2026-09-12 10:00:00+00";
const DRAFTED = "2026-10-09 14:00:00+00";

/** "IAC 2024, Milan": published, with draft changes to its lead and summary. */
export const DRAFT_CHANGES_POST = 4;

/** A published post that links every channel type a post can carry (board 74h). */
export const EVERY_CHANNEL_POST = 15;

/** A new post saved as a draft before it is whole (board 74f), never published. */
export const DRAFT_ONLY_POST = 16;

/**
 * The every-channel post's cover: the seed uploads no file, so it uses the
 * warm stand-in a preview shows for an upload (public/outreach/), with two
 * school-day photos of the record beside it to fill the photo grid.
 */
const STAND_IN_PHOTO = {
  src: "/outreach/preview-upload.webp",
  alt: "A warm brown gradient, standing in for a photo of the open lab day.",
} as const;

const recordPhoto = (title: string) => {
  const post = outreachRecord.posts.find((p) => p.title === title);
  if (post === undefined) throw new Error(`the outreach record has no post titled ${title}`);
  return post.photos[0];
};

const caption = "We opened the lab to students from three Torino high schools…";

/**
 * The every-channel post's gallery (issue #430): four photos of the record
 * at the bottom of its page, one with a caption and one with no description,
 * which its page draws with `alt=""`.
 */
const OPEN_LAB_GALLERY: PostGallery = {
  items: [
    { ...recordPhoto("Luna e Italia"), caption: "Talks in the main hall" },
    recordPhoto("Hosting Space Eagle"),
    { src: recordPhoto("Pininfarina wind tunnel").src, alt: "" },
    recordPhoto("Cassini Hackathon"),
  ],
};

const EVERY_CHANNEL: OutreachPost = {
  title: "Open lab day, Torino",
  date: "2024-02-15",
  place: "Torino, Italy",
  tags: ["Visit", "School"],
  summary: {
    text: "We opened the lab to students from three Torino high schools, with talks on Cavour and a walk past the engine test bench.",
    phone: "We opened the lab to students from three Torino high schools.",
  },
  lead: "Students from three Torino high schools spent an afternoon in our lab, from the first sketch of a rocket to the engine test bench.",
  body: [
    {
      kind: "paragraph",
      text: "We opened the lab to students from three Torino high schools. Each division showed what it builds, and the afternoon ended at the engine test bench.",
    },
    { kind: "heading", text: "What they saw" },
    {
      kind: "paragraph",
      text: "Cavour's fins and avionics bay on the bench, the recovery parachute laid out on the floor, and the engine team's latest test on the big screen.",
    },
  ],
  photos: [STAND_IN_PHOTO, recordPhoto("Steam4Future"), recordPhoto("Pi Day Fair")],
  channels: {
    instagram: { url: "https://www.example.com/instagram/open-lab-day", caption },
    linkedin: { url: "https://www.example.com/linkedin/open-lab-day", caption },
    youtube: { url: "https://www.example.com/youtube/open-lab-day", caption: "A walk through the lab, from the first sketch to the test bench." },
    facebook: { url: "https://www.example.com/facebook/open-lab-day", caption, account: "Politecnico di Torino" },
    x: { url: "https://www.example.com/x/open-lab-day", caption },
    tiktok: { url: "https://www.example.com/tiktok/open-lab-day", caption: "One minute in the lab." },
    other: { url: "https://www.example.com/news/open-lab-day", caption: "Open lab day at the PoliTo Rocket Team." },
  },
  gallery: OPEN_LAB_GALLERY,
};

/** Saved before it is whole: a title, a tag and one paragraph, with no photo or channel yet. */
const UNFINISHED_DRAFT: OutreachDraft = {
  title: "Space Day at school",
  date: "2026-10-02",
  tags: ["School"],
  summary: { text: "" },
  lead: "",
  body: [{ kind: "paragraph", text: "Notes for the post: two talks, one for each year group." }],
  photos: [],
  channels: {},
};

const IMPORTED = importedOutreach();

/** The summit's story (issue #392), pinned as the import leaves it. */
export const PINNED_POST = IMPORTED.pinned;

export const OUTREACH_ITEMS: readonly PostItem[] = [
  ...IMPORTED.posts.map((item): PostItem => {
    if (item.id !== DRAFT_CHANGES_POST || item.version.state !== "published") return item;
    const published = item.version.published;
    const draft: OutreachPost = {
      ...published,
      summary: { text: "At the largest IAC ever we showed Cavour, presented two papers and won the Geography, Generation, Gender award." },
      lead: "At the 75th International Astronautical Congress, the largest IAC in history, we showed Cavour and won an award.",
    };
    return { ...item, version: { state: "published", published, draft } };
  }),
  { id: EVERY_CHANNEL_POST, siteOrder: EVERY_CHANNEL_POST, version: { state: "published", published: EVERY_CHANNEL, draft: null } },
  { id: DRAFT_ONLY_POST, siteOrder: DRAFT_ONLY_POST, version: { state: "draft", draft: UNFINISHED_DRAFT } },
];

export const OUTREACH_SUMMIT = IMPORTED.summit;

export const OUTREACH_TAG_ROWS = rowsOf(
  outreachTags,
  IMPORTED.tags.map((tag, i) => ({ name: tag.name, award: tag.award, listOrder: i + 1, createdAt: CREATED })),
);

export const OUTREACH_POST_ROWS = rowsOf(
  outreachPosts,
  OUTREACH_ITEMS.map(({ id, siteOrder }) => ({ id, siteOrder, pinned: id === PINNED_POST, createdAt: CREATED })),
);

const VERSIONS = contentVersionRows(OUTREACH_ITEMS);

export const OUTREACH_POST_VERSION_ROWS = rowsOf(
  outreachPostVersions,
  VERSIONS.map(({ itemId, kind, content }) => {
    const c = postColumns(content);
    return {
      postId: itemId,
      version: kind,
      ...c,
      body: [...c.body],
      photos: [...c.photos],
      updatedAt: kind === "published" ? PUBLISHED : DRAFTED,
    };
  }),
);

export const OUTREACH_POST_TAG_ROWS = rowsOf(
  outreachPostTags,
  VERSIONS.flatMap(({ itemId, kind, content }) =>
    content.tags.map((tagName, i) => ({ postId: itemId, version: kind, tagName, position: i + 1 })),
  ),
);

export const OUTREACH_SUMMIT_ROWS = rowsOf(
  outreachSummitVersions,
  versionRows(OUTREACH_SUMMIT).map(({ kind, content }) => {
    const c = summitColumns(content);
    return { version: kind, ...c, editions: [...c.editions], updatedAt: PUBLISHED };
  }),
);

export const outreachSeed = tableSeedModule({
  name: "outreach",
  owns: [outreachTags, outreachPosts, outreachPostVersions, outreachPostTags, outreachSummitVersions],
  rows: [OUTREACH_TAG_ROWS, OUTREACH_POST_ROWS, OUTREACH_POST_VERSION_ROWS, OUTREACH_POST_TAG_ROWS, OUTREACH_SUMMIT_ROWS],
});
