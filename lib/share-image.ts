import { alumni } from "@/lib/about/alumni";
import { mission } from "@/lib/about/mission";
import { team } from "@/lib/about/team";
import { university } from "@/lib/about/university";
import { applyPage } from "@/lib/apply/page";
import { longMonthYear, outreachCopy } from "@/lib/outreach";
import { storedPhotoPathname } from "@/lib/outreach-photos";
import type { OutreachPost } from "@/lib/outreach-types";
import { partnersPage } from "@/lib/partners";
import { listingOf, visualModelOf, type ProjectRecord } from "@/lib/project-content/record";
import { stageStillOf, type OwnModel } from "@/lib/rocket-model";
import type { PublicStoreHost } from "@/lib/storage/pathname";

// What each public page's share image (Open Graph, 1200 x 630) says and
// shows: board 90, "Share images", issue #454. Four layouts share one frame:
// an orange mono eyebrow, a large white title, an optional subtitle, the PRT
// logo bottom left, the page's address bottom right and an accent line along
// the bottom edge. This module only decides the words and which files the
// image draws; components/share-image/ draws it. Projects and posts are read
// off the same published records their pages read, so a new one gets its
// image with no code of its own.

/**
 * A file the image reads from disk, by its path from the repo root: a site
 * file under public/, or a design file. Only a post's stored photo (below)
 * is ever fetched; every other image reads repo files alone.
 */
export type RepoFile = `public/${string}` | `design/${string}`;

/**
 * What fills a post's frame behind the words: a texture, or a photo shaded
 * dark toward the bottom. A photo is a file of the site, or one uploaded in
 * the dashboard to this deployment's own public Blob store (issue #469):
 * that one is fetched from its URL, and the image lies on the streak texture
 * when the fetch fails (lib/share-image-backdrop.ts).
 */
export type Backdrop =
  | { readonly kind: "texture"; readonly file: RepoFile }
  | { readonly kind: "photo"; readonly file: RepoFile }
  | { readonly kind: "stored-photo"; readonly url: string };

type Words = { readonly eyebrow: string; readonly title: string; readonly url: string };

/**
 * One share image, by its board 90 layout: the default (K2zr8Y), a project
 * (IWf1F), an outreach post (ruh9r) and every other page (Zp3hm).
 */
export type ShareCard =
  | (Words & { readonly layout: "default"; readonly subtitle: string; readonly texture: RepoFile; readonly rocket: RepoFile })
  | (Words & { readonly layout: "project"; readonly subtitle: string; readonly texture: RepoFile; readonly still: RepoFile })
  | (Words & { readonly layout: "post"; readonly backdrop: Backdrop })
  | (Words & { readonly layout: "page"; readonly subtitle: string; readonly texture: RepoFile; readonly photo: RepoFile | null });

/** The orange streak texture of the default image, and the backdrop of a post whose photo cannot be drawn. */
export const STREAK_TEXTURE: RepoFile = "public/design/news/tex-streaks.jpg";

/** The dark streak tile the pages' sky repeats: the "other pages" texture. */
export const PAGE_TEXTURE: RepoFile = "public/textures/page-streaks-tile.webp";

const SITE = "POLITOROCKETTEAM.IT";

/**
 * The file behind a site address ("/textures/x.webp" is public/textures/x.webp).
 * Null for anything that is not a file of this site: a Blob store
 * `https://` URL or a preview's `data:` upload.
 */
export function siteFile(src: string): RepoFile | null {
  if (!src.startsWith("/") || src.startsWith("//") || src.split("/").includes("..")) return null;
  return `public/${src.slice(1)}`;
}

/** Home, and any public page without its own image. */
export const defaultShareCard: ShareCard = {
  layout: "default",
  eyebrow: "POLITO ROCKET TEAM",
  title: "Born for space, built in Torino.",
  subtitle: "The rocket engineering student team of Politecnico di Torino.",
  url: SITE,
  texture: STREAK_TEXTURE,
  rocket: "design/cavour-render-vert.png",
};

/**
 * A project's image: its number and years over its name and its home card's
 * line, on its texture, with the still its page panel draws for its model.
 * `position` is its place (from 0) among the published projects.
 */
export function projectShareCard(record: ProjectRecord, position: number): ShareCard {
  const { index, years, texture } = listingOf(record, position);
  const rocket = visualModelOf<OwnModel>(record.hero);
  const still = stageStillOf(rocket === undefined ? undefined : { model: rocket, alt: "" }).src;
  return {
    layout: "project",
    eyebrow: `${index} · PROJECT · ${years}`.toUpperCase(),
    title: record.name,
    subtitle: record.card.desc.text,
    url: `${SITE}/PROJECTS`,
    texture: siteFile(texture) ?? STREAK_TEXTURE,
    still: siteFile(still) ?? "public/design/placeholder/stage-poster.webp",
  };
}

/**
 * A post's image: its month and title over its first photo. `store` is the
 * host of this deployment's public Blob store, null while none is set up.
 */
export function postShareCard(post: OutreachPost, store: PublicStoreHost | null): ShareCard {
  return {
    layout: "post",
    eyebrow: `OUTREACH · ${longMonthYear(post.date)}`,
    title: post.title,
    url: `${SITE}/OUTREACH`,
    backdrop: postBackdrop(post.photos[0].src, store),
  };
}

/**
 * A file of the site is read from disk. A post photo in this deployment's own
 * public store is fetched. Anything else (a preview's `data:` upload, a URL
 * on any other host, another Blob store included) is never fetched: that
 * post's image lies on the streak texture.
 */
function postBackdrop(src: string, store: PublicStoreHost | null): Backdrop {
  const file = siteFile(src);
  if (file !== null) return { kind: "photo", file };
  if (store !== null && storedPhotoPathname(src, store, "post-photo") !== null) return { kind: "stored-photo", url: src };
  return { kind: "texture", file: STREAK_TEXTURE };
}

/** The public pages with an image of their own that is neither a project nor a post. */
export const SHARE_PAGES = [
  "projects",
  "outreach",
  "partners",
  "apply",
  "the-team",
  "alumni",
  "mission-vision",
  "our-university",
] as const;
export type SharePage = (typeof SHARE_PAGES)[number];

const page = (words: Words & { subtitle: string; photo?: string }): ShareCard => ({
  layout: "page",
  eyebrow: words.eyebrow,
  title: words.title,
  subtitle: words.subtitle,
  url: words.url,
  texture: PAGE_TEXTURE,
  photo: words.photo === undefined ? null : siteFile(words.photo),
});

/**
 * Each page's eyebrow is its header's, its title and subtitle its heading and
 * meta description, and its photo the page's own photo where it has one.
 * The Team's words are board 90's own (node Zp3hm).
 */
const pages: Record<SharePage, ShareCard> = {
  projects: page({
    eyebrow: "PROJECTS",
    title: "From first launch to first liquid engine.",
    subtitle: "Cavour, VES and Efesto: the rockets and the liquid engine designed, built and flown by students of Politecnico di Torino.",
    url: `${SITE}/PROJECTS`,
  }),
  outreach: page({
    eyebrow: outreachCopy.header.eyebrow,
    title: outreachCopy.header.title,
    subtitle: outreachCopy.description,
    url: `${SITE}/OUTREACH`,
  }),
  partners: page({
    eyebrow: partnersPage.header.eyebrow,
    title: partnersPage.header.title,
    subtitle: partnersPage.description,
    url: `${SITE}/PARTNERS`,
  }),
  apply: page({
    eyebrow: applyPage.header.eyebrow,
    title: applyPage.header.title,
    subtitle: applyPage.description,
    url: `${SITE}/APPLY`,
  }),
  "the-team": page({
    eyebrow: team.header.eyebrow,
    title: "150+ students. One team.",
    subtitle: "Every course at Politecnico, from the first sketch to the launch rail.",
    url: `${SITE}/ABOUT`,
    photo: team.coreMembers.groupPhoto.src,
  }),
  alumni: page({
    eyebrow: alumni.header.eyebrow,
    title: alumni.header.title,
    subtitle: alumni.description,
    url: `${SITE}/ABOUT`,
  }),
  "mission-vision": page({
    eyebrow: mission.header.eyebrow,
    title: mission.header.title,
    subtitle: mission.description,
    url: `${SITE}/ABOUT`,
  }),
  "our-university": page({
    eyebrow: university.header.eyebrow,
    title: university.header.title,
    subtitle: university.description,
    url: `${SITE}/ABOUT`,
    photo: university.photo.src,
  }),
};

export function pageShareCard(name: SharePage): ShareCard {
  return pages[name];
}
