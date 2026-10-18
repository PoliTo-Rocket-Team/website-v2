import type { NonEmpty } from "./about/alumni-types";
import {
  CHANNEL_NAMES,
  type BodyBlock,
  type Channel,
  type ChannelName,
  type Channels,
  type Edition,
  type IsoDate,
  type OutreachDraft,
  type OutreachFeature,
  type OutreachPhoto,
  type OutreachPost,
  type PhotoSrc,
} from "./outreach-types";
import { isPhotoSrc } from "./outreach-photos";
import type { Copy } from "./projects";

// An Outreach post version and the summit as their rows hold them (db/schema,
// issue #287), and back. The database side, the import migration and the
// dummy data's cookie all go through this one mapping, so a post reads back
// the same. The body, the photos, the channels and the editions are stored as
// JSON; reading one back checks its shape and keeps only the known keys, so a
// row no write of this code made cannot reach a page.

/** A post version's columns in `outreach_post_versions`; its tags are rows of `outreach_post_tags`. */
export type OutreachPostColumns = {
  title: string;
  date: IsoDate;
  place: string | null;
  summary: string;
  summaryPhone: string | null;
  lead: string;
  body: readonly BodyBlock[];
  photos: readonly OutreachPhoto[];
  channels: Partial<Record<ChannelName, Channel>>;
};

/** The summit version's columns in `outreach_summit_versions`. */
export type OutreachSummitColumns = {
  eyebrow: string;
  title: string;
  story: string;
  storyPhone: string | null;
  photoSrc: string;
  photoAlt: string;
  editions: readonly Edition[];
};

export function postColumns(post: OutreachDraft): OutreachPostColumns {
  return {
    title: post.title,
    date: post.date,
    place: post.place ?? null,
    summary: post.summary.text,
    summaryPhone: post.summary.phone ?? null,
    lead: post.lead,
    body: post.body,
    photos: post.photos,
    channels: post.channels,
  };
}

function fromColumns(row: Record<keyof OutreachPostColumns, unknown>, tags: readonly string[]): unknown {
  return {
    title: row.title,
    date: row.date,
    ...(row.place !== null && { place: row.place }),
    tags,
    summary: copyFromColumns(row.summary, row.summaryPhone),
    lead: row.lead,
    body: row.body,
    photos: row.photos,
    channels: row.channels,
  };
}

/** A stored post version and its tags as a post; throws on a row whose JSON is not a post's. */
export function postFromColumns(row: Record<keyof OutreachPostColumns, unknown>, tags: readonly string[]): OutreachPost {
  const post = outreachPostOf(fromColumns(row, tags));
  if (post === null) throw new Error(`an outreach post version titled ${JSON.stringify(row.title)} is not a post`);
  return post;
}

/** The stored draft of a post never published, and its tags; throws on a row whose JSON is not a draft's. */
export function draftFromColumns(row: Record<keyof OutreachPostColumns, unknown>, tags: readonly string[]): OutreachDraft {
  const draft = outreachDraftOf(fromColumns(row, tags));
  if (draft === null) throw new Error(`an outreach draft titled ${JSON.stringify(row.title)} is not a draft`);
  return draft;
}

export function summitColumns(feature: OutreachFeature): OutreachSummitColumns {
  return {
    eyebrow: feature.eyebrow,
    title: feature.title,
    story: feature.story.text,
    storyPhone: feature.story.phone ?? null,
    photoSrc: feature.photo.src,
    photoAlt: feature.photo.alt,
    editions: feature.editions,
  };
}

/** A stored summit version as the summit; throws on a row whose JSON is not the summit's. */
export function summitFromColumns(row: Record<keyof OutreachSummitColumns, unknown>): OutreachFeature {
  const feature = outreachFeatureOf({
    eyebrow: row.eyebrow,
    title: row.title,
    story: copyFromColumns(row.story, row.storyPhone),
    photo: { src: row.photoSrc, alt: row.photoAlt },
    editions: row.editions,
  });
  if (feature === null) throw new Error("the stored outreach summit is not a summit");
  return feature;
}

function copyFromColumns(text: unknown, phone: unknown): unknown {
  return { text, ...(phone !== null && { phone }) };
}

// Each reader answers a fresh value holding only the known keys, or null when
// `value` does not have the shape.

type Shape = Record<string, unknown>;

const isShape = (value: unknown): value is Shape => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const optionalText = (value: unknown): value is string | undefined => value === undefined || isText(value);

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(value);
}

function nonEmpty<T>(value: unknown, read: (item: unknown) => T | null): NonEmpty<T> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items = value.map(read);
  if (items.some((item) => item === null)) return null;
  const [first, ...rest] = items as T[];
  return [first, ...rest];
}

function copyOf(value: unknown): Copy | null {
  if (!isShape(value) || !isText(value.text) || !optionalText(value.phone)) return null;
  return { text: value.text, ...(value.phone !== undefined && { phone: value.phone }) };
}

function bodyBlockOf(value: unknown): BodyBlock | null {
  if (!isShape(value) || !isText(value.text)) return null;
  if (value.kind === "paragraph" || value.kind === "heading") return { kind: value.kind, text: value.text };
  if (value.kind === "highlight" && isText(value.label)) return { kind: "highlight", label: value.label, text: value.text };
  return null;
}

/**
 * A photo of the site or an uploaded one; a preview's data URL is never
 * stored. Which store an uploaded file may come from, a save decides
 * (`checkPhotoSources`), so a row holds only what a save let through.
 */
export function isStoredPhotoSrc(src: unknown): src is Exclude<PhotoSrc, `data:${string}`> {
  return isPhotoSrc(src) && !src.startsWith("data:");
}

function photoOf(value: unknown): OutreachPhoto | null {
  if (!isShape(value) || !isStoredPhotoSrc(value.src) || !isText(value.alt)) return null;
  return { src: value.src, alt: value.alt };
}

function channelOf(value: unknown): Channel | null {
  if (!isShape(value) || !isText(value.url) || !isText(value.caption) || !optionalText(value.account)) return null;
  return { url: value.url, caption: value.caption, ...(value.account !== undefined && { account: value.account }) };
}

/** The channels, each one known and whole, Instagram or LinkedIn among them; null otherwise. */
function channelsOf(value: unknown): Channels | null {
  if (!isShape(value)) return null;
  const read: Partial<Record<ChannelName, Channel>> = {};
  for (const name of CHANNEL_NAMES) {
    if (value[name] === undefined) continue;
    const channel = channelOf(value[name]);
    if (channel === null) return null;
    read[name] = channel;
  }
  return withMainChannel(read);
}

/** `channels` as a post's, when Instagram or LinkedIn is among them; null otherwise. */
export function withMainChannel(channels: Partial<Record<ChannelName, Channel>>): Channels | null {
  const { instagram, linkedin, ...extra } = channels;
  if (instagram !== undefined) return { ...extra, instagram, ...(linkedin !== undefined && { linkedin }) };
  return linkedin === undefined ? null : { ...extra, linkedin };
}

function editionOf(value: unknown): Edition | null {
  if (!isShape(value) || !Number.isSafeInteger(value.year) || !isText(value.place)) return null;
  return { year: value.year as number, place: value.place };
}

/** `value` as a post: every field a post needs, in its shape; null otherwise. */
export function outreachPostOf(value: unknown): OutreachPost | null {
  if (!isShape(value) || !isText(value.title) || !isIsoDate(value.date) || !optionalText(value.place) || !isText(value.lead)) return null;
  const tags = nonEmpty(value.tags, (tag) => (isText(tag) ? tag : null));
  const summary = copyOf(value.summary);
  const body = nonEmpty(value.body, bodyBlockOf);
  const photos = nonEmpty(value.photos, photoOf);
  const channels = channelsOf(value.channels);
  if (tags === null || summary === null || body === null || photos === null || channels === null) return null;
  return {
    title: value.title,
    date: value.date,
    ...(value.place !== undefined && { place: value.place }),
    tags,
    summary,
    lead: value.lead,
    body,
    photos,
    channels,
  };
}

// A draft's readers take what the panel may leave blank: an empty title,
// lead, summary, text block, alt text or channel link, and lists with no
// item yet. Every key must still have its type.

const isString = (value: unknown): value is string => typeof value === "string";

function listOf<T>(value: unknown, read: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(read);
  return items.some((item) => item === null) ? null : (items as T[]);
}

function draftBlockOf(value: unknown): BodyBlock | null {
  if (!isShape(value) || !isString(value.text)) return null;
  if (value.kind === "paragraph" || value.kind === "heading") return { kind: value.kind, text: value.text };
  if (value.kind === "highlight" && isString(value.label)) return { kind: "highlight", label: value.label, text: value.text };
  return null;
}

function draftPhotoOf(value: unknown): OutreachPhoto | null {
  if (!isShape(value) || !isStoredPhotoSrc(value.src) || !isString(value.alt)) return null;
  return { src: value.src, alt: value.alt };
}

function draftChannelsOf(value: unknown): Partial<Record<ChannelName, Channel>> | null {
  if (!isShape(value)) return null;
  const read: Partial<Record<ChannelName, Channel>> = {};
  for (const name of CHANNEL_NAMES) {
    const channel = value[name];
    if (channel === undefined) continue;
    if (!isShape(channel) || !isString(channel.url) || !isString(channel.caption) || !optionalText(channel.account)) return null;
    read[name] = { url: channel.url, caption: channel.caption, ...(channel.account !== undefined && { account: channel.account }) };
  }
  return read;
}

/** `value` as a draft of a post (`OutreachDraft`): each key in its shape, blanks allowed; null otherwise. */
export function outreachDraftOf(value: unknown): OutreachDraft | null {
  if (!isShape(value) || !isString(value.title) || !isIsoDate(value.date) || !optionalText(value.place) || !isString(value.lead)) return null;
  const { summary } = value;
  if (!isShape(summary) || !isString(summary.text) || !optionalText(summary.phone)) return null;
  const tags = listOf(value.tags, (tag) => (isText(tag) ? tag : null));
  const body = listOf(value.body, draftBlockOf);
  const photos = listOf(value.photos, draftPhotoOf);
  const channels = draftChannelsOf(value.channels);
  if (tags === null || body === null || photos === null || channels === null) return null;
  return {
    title: value.title,
    date: value.date,
    ...(value.place !== undefined && { place: value.place }),
    tags,
    summary: { text: summary.text, ...(summary.phone !== undefined && { phone: summary.phone }) },
    lead: value.lead,
    body,
    photos,
    channels,
  };
}

/** `value` as the summit: every field it needs, in its shape; null otherwise. */
export function outreachFeatureOf(value: unknown): OutreachFeature | null {
  if (!isShape(value) || !isText(value.eyebrow) || !isText(value.title)) return null;
  const story = copyOf(value.story);
  const photo = photoOf(value.photo);
  const editions = nonEmpty(value.editions, editionOf);
  if (story === null || photo === null || editions === null) return null;
  return { eyebrow: value.eyebrow, title: value.title, story, photo, editions };
}
