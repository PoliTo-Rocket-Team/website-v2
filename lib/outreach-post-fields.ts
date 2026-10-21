import type { PublishCheck } from "@/lib/content/edit-shell";
import { refused, type WriteResult } from "@/lib/dashboard/write";
import { GALLERY_MAX, type GalleryItemFields } from "@/lib/gallery-fields";
import type { NonEmpty } from "./about/alumni-types";
import { isPhotoSrc } from "./outreach-photos";
import { isIsoDate } from "./outreach-rows";
import {
  CHANNEL_LABELS,
  CHANNEL_NAMES,
  type BodyBlock,
  type Channel,
  type ChannelName,
  type Channels,
  type IsoDate,
  type OutreachPost,
  type OutreachTag,
  type PhotoSrc,
  type OutreachDraft,
  type PostGallery,
  type PostGalleryPhoto,
} from "./outreach-types";
import type { Copy } from "./projects";

// The Edit post panel's fields (boards 74c, 74d and 74h, issue #290): a post
// as the editor types it, the page it draws while they type, and the rules a
// Save draft or a Publish must pass. The panel keeps the fields. Publish
// takes only a post that passes every rule, and so does Save draft on a
// published post, whose draft must be whole. A post never published is
// saved as a draft at any point, blanks and all (board 74f, issue #292), and
// its Publish waits on the checklist. Photos (issue #291) are uploaded as they are picked, so the
// fields hold each one's src and its alt text, in the order the panel shows.
// Original posts and photo descriptions are optional (Owner decision, issue
// #430). A post's gallery is its photos only, with no switch and no title
// (Owner decision, issue #451): it never stops a save, and a post shows it
// whenever it has a photo.

/** One original post as the panel edits it: the link and the first line. `account` is kept as it was. */
export type ChannelFields = {
  readonly name: ChannelName;
  readonly url: string;
  readonly caption: string;
  readonly account?: string;
};

/** One photo as the panel edits it: the file, uploaded already, and its alt text, which may stay empty. */
export type PhotoFields = { readonly src: PhotoSrc; readonly alt: string };

/** Everything the panel edits, as typed: text may be empty and lists may be too, until a save checks them. */
export type PostFields = {
  readonly title: string;
  /** YYYY-MM-DD, as the date input gives it; empty when cleared. */
  readonly date: string;
  /** Empty: the post says no place. */
  readonly place: string;
  readonly tags: readonly string[];
  readonly lead: string;
  readonly summary: string;
  readonly body: readonly BodyBlock[];
  /** In order: the first is the cover and the card photo. */
  readonly photos: readonly PhotoFields[];
  /** In the order the panel lists them; one entry per channel, none at all included. */
  readonly channels: readonly ChannelFields[];
  /** The gallery at the bottom of the page: its photos in carousel order, none at all included. */
  readonly gallery: readonly GalleryItemFields[];
};

/** The panel's sections that a rule can refuse. The gallery never is (issue #451). */
export type PostField = "title" | "date" | "tags" | "lead" | "summary" | "body" | "photos" | "channels";

export type PostFieldErrors = Partial<Record<PostField, string>>;

/** A whole post, or what each section still needs. */
export type PostCheck =
  | { readonly ok: true; readonly value: OutreachPost }
  | { readonly ok: false; readonly errors: PostFieldErrors };

/** The panel's fields for a post or a draft, as it opens. */
export function postFieldsOf(post: OutreachDraft): PostFields {
  return {
    title: post.title,
    date: post.date,
    place: post.place ?? "",
    tags: [...post.tags],
    lead: post.lead,
    summary: post.summary.text,
    body: [...post.body],
    photos: post.photos.map((p) => ({ src: p.src, alt: p.alt })),
    channels: CHANNEL_NAMES.flatMap((name) => {
      const channel = post.channels[name];
      return channel === undefined ? [] : [{ name, ...channel }];
    }),
    gallery: (post.gallery?.items ?? []).map((item) => ({ src: item.src, alt: item.alt, caption: item.caption ?? "" })),
  };
}

/**
 * The gallery as a post keeps it: each text trimmed, and only photos that
 * were uploaded (the panel never makes a placeholder). With no photo it is
 * no gallery.
 */
function galleryOfFields(items: readonly GalleryItemFields[]): PostGallery | undefined {
  const photos = items.flatMap((item): PostGalleryPhoto[] => {
    if (item.src === null || !isPhotoSrc(item.src)) return [];
    const caption = item.caption.trim();
    return [{ src: item.src, alt: item.alt.trim(), ...(caption !== "" && { caption }) }];
  });
  const [first, ...rest] = photos;
  return first === undefined ? undefined : { items: [first, ...rest] };
}

/** A removed gallery photo: the photos without it, and its uploaded file, which the panel lets go. */
export type PostGalleryRemoval = { readonly items: readonly GalleryItemFields[]; readonly letGo: readonly string[] };

/** Removes a gallery photo. It never refuses: a post's gallery may lose its last photo, and then the post has none (issue #451). */
export function removePostGalleryPhoto(items: readonly GalleryItemFields[], index: number): PostGalleryRemoval {
  const src = items[index]?.src ?? null;
  return { items: items.filter((_, i) => i !== index), letGo: src === null ? [] : [src] };
}

/** The card summary: a phone text is kept only while the text it shortens is unchanged. */
function summaryOf(text: string, opened: Copy): Copy {
  return text === opened.text && opened.phone !== undefined ? { text, phone: opened.phone } : { text };
}

function channelOf(fields: ChannelFields): Channel {
  return {
    url: fields.url.trim(),
    caption: fields.caption.trim(),
    ...(fields.account !== undefined && { account: fields.account }),
  };
}

function channelRecord(channels: readonly ChannelFields[]): Channels {
  return Object.fromEntries(channels.map((c) => [c.name, channelOf(c)]));
}

/** The post the panel opened on, as far as the fields need it: its date while the date is cleared, and its phone summary. */
export type OpenedPost = Pick<OutreachDraft, "date" | "summary">;

/** A new post's fields (board 74f): everything blank but the date, which is `today`. */
export function blankPostFields(today: IsoDate): PostFields {
  return { title: "", date: today, place: "", tags: [], lead: "", summary: "", body: [], photos: [], channels: [], gallery: [] };
}

/** What a new post opened on: nothing yet but its date. */
export function blankPost(today: IsoDate): OutreachDraft {
  return { title: "", date: today, tags: [], summary: { text: "" }, lead: "", body: [], photos: [], channels: {} };
}

/** The page as the editor sees it while typing: every field as typed, and the opened post's date while the date is cleared. */
export function postViewOf(fields: PostFields, opened: OpenedPost): OutreachDraft {
  const place = fields.place.trim();
  const gallery = galleryOfFields(fields.gallery);
  return {
    title: fields.title,
    date: isIsoDate(fields.date) ? fields.date : opened.date,
    ...(place !== "" && { place }),
    tags: fields.tags,
    summary: summaryOf(fields.summary.trim(), opened.summary),
    lead: fields.lead,
    body: fields.body,
    photos: fields.photos,
    channels: channelRecord(fields.channels),
    ...(gallery !== undefined && { gallery }),
  };
}

/**
 * The fields as the draft of a post never published (Save draft works at any
 * point, board 74f): each text trimmed, blanks kept, the opened date while
 * the date is cleared. Refused only for a tag off the tag list, which the
 * store cannot hold.
 */
export function draftOfFields(fields: PostFields, opened: OpenedPost, tags: readonly OutreachTag[]): WriteResult<OutreachDraft> {
  const known = new Set(tags.map((t) => t.name));
  const unknown = fields.tags.find((name) => !known.has(name));
  if (unknown !== undefined) return refused(`${unknown} is not a tag. Add it to the tag list first.`);
  const place = fields.place.trim();
  const gallery = galleryOfFields(fields.gallery);
  return {
    ok: true,
    value: {
      title: fields.title.trim(),
      date: isIsoDate(fields.date) ? fields.date : opened.date,
      ...(place !== "" && { place }),
      tags: [...fields.tags],
      summary: summaryOf(fields.summary.trim(), opened.summary),
      lead: fields.lead.trim(),
      body: fields.body.map(trimmedBlock),
      photos: fields.photos.map((p) => ({ src: p.src, alt: p.alt.trim() })),
      channels: channelRecord(fields.channels),
      ...(gallery !== undefined && { gallery }),
    },
  };
}

/**
 * The checklist under Publish (board 74f), in the board's order: Publish
 * stays off until every line is done. A publish runs the whole of
 * `checkPostFields` as well, which asks for more (a lead, a card summary, a
 * whole link on each original post added), and says which section still
 * needs it. An original post is optional (Owner decision, issue #430).
 */
export function publishChecklist(fields: PostFields): readonly PublishCheck[] {
  return [
    { label: "Title", done: fields.title.trim() !== "" },
    { label: "At least 1 tag", done: fields.tags.length > 0 },
    { label: "Cover photo", done: fields.photos.length > 0 },
    { label: "Some text", done: fields.body.some((b) => b.text.trim() !== "") },
    { label: "Date", done: isIsoDate(fields.date) },
  ];
}

const isWebLink = (url: string) => /^https?:\/\/\S+\.\S+$/.test(url);

function bodyError(body: readonly BodyBlock[]): string | undefined {
  if (body.length === 0) return "Add at least one text block.";
  if (body.some((b) => b.text.trim() === "")) return "Write the empty text block, or remove it.";
  if (body.some((b) => b.kind === "highlight" && b.label.trim() === "")) return "Give the highlight its label.";
  return undefined;
}

/** A channel added needs its link and first line; none at all is fine (issue #430). */
function channelsError(channels: readonly ChannelFields[]): string | undefined {
  for (const c of channels) {
    const label = CHANNEL_LABELS[c.name];
    if (c.url.trim() === "") return `${label}: paste the post's link.`;
    if (!isWebLink(c.url.trim())) return `${label}: the link starts with https://.`;
    if (c.caption.trim() === "") return `${label}: write the post's first line.`;
  }
  return undefined;
}

/** The cover is needed; a description on each photo is optional (issue #430). */
function photosError(photos: readonly PhotoFields[]): string | undefined {
  return photos.length === 0 ? "Add at least one photo." : undefined;
}

function tagsError(picked: readonly string[], tags: readonly OutreachTag[]): string | undefined {
  if (picked.length === 0) return "Pick at least one tag.";
  const known = new Set(tags.map((t) => t.name));
  const unknown = picked.find((name) => !known.has(name));
  return unknown === undefined ? undefined : `${unknown} is not a tag. Add it to the tag list first.`;
}

/**
 * The fields as a post, or what each section still needs: a title, a date,
 * at least one tag from the tag list, a lead, a card summary, at least one
 * text block with its text, at least one photo, a link and a first line on
 * each channel added. The first photo is the post's cover and its card photo.
 * Photo descriptions and original posts are optional (Owner decision, issue
 * #430), and the gallery never stops a publish (issue #451).
 */
export function checkPostFields(fields: PostFields, opened: OpenedPost, tags: readonly OutreachTag[]): PostCheck {
  const errors: PostFieldErrors = {
    ...(fields.title.trim() === "" && { title: "Write the title." }),
    ...(!isIsoDate(fields.date) && { date: "Pick the date." }),
    ...(fields.lead.trim() === "" && { lead: "Write the lead." }),
    ...(fields.summary.trim() === "" && { summary: "Write the card summary." }),
  };
  const tagError = tagsError(fields.tags, tags);
  const textError = bodyError(fields.body);
  const channelError = channelsError(fields.channels);
  const photoError = photosError(fields.photos);
  if (tagError !== undefined) errors.tags = tagError;
  if (textError !== undefined) errors.body = textError;
  if (photoError !== undefined) errors.photos = photoError;
  if (channelError !== undefined) errors.channels = channelError;

  const picked = nonEmpty(fields.tags);
  const body = nonEmpty(fields.body.map(trimmedBlock));
  const photos = nonEmpty(fields.photos.map((p) => ({ src: p.src, alt: p.alt.trim() })));
  const gallery = galleryOfFields(fields.gallery);
  const { date } = fields;
  if (Object.keys(errors).length > 0 || picked === null || body === null || photos === null || !isIsoDate(date)) {
    return { ok: false, errors };
  }
  const place = fields.place.trim();
  return {
    ok: true,
    value: {
      title: fields.title.trim(),
      date,
      ...(place !== "" && { place }),
      tags: picked,
      summary: summaryOf(fields.summary.trim(), opened.summary),
      lead: fields.lead.trim(),
      body,
      photos,
      channels: channelRecord(fields.channels),
      ...(gallery !== undefined && { gallery }),
    },
  };
}

function nonEmpty<T>(items: readonly T[]): NonEmpty<T> | null {
  const [first, ...rest] = items;
  return items.length === 0 ? null : [first as T, ...rest];
}

function trimmedBlock(block: BodyBlock): BodyBlock {
  return block.kind === "highlight"
    ? { kind: "highlight", label: block.label.trim(), text: block.text.trim() }
    : { kind: block.kind, text: block.text.trim() };
}

/** The fields in the order the panel shows them. */
const FIELD_ORDER: readonly PostField[] = ["title", "date", "tags", "lead", "summary", "body", "photos", "channels"];

/** The first field, in panel order, that still needs work, and what it needs. */
export function firstPostError(errors: PostFieldErrors): { field: PostField; error: string } | undefined {
  for (const field of FIELD_ORDER) {
    const error = errors[field];
    if (error !== undefined) return { field, error };
  }
  return undefined;
}

/**
 * A failed check's errors as the panel still shows them: a field's error goes
 * once the field is edited after the check, so a fixed field stops reading as
 * wrong before the next save.
 */
export function standingErrors(failed: { fields: PostFields; errors: PostFieldErrors } | null, now: PostFields): PostFieldErrors {
  if (failed === null) return {};
  return Object.fromEntries(
    FIELD_ORDER.filter((field) => failed.errors[field] !== undefined && failed.fields[field] === now[field]).map((field) => [field, failed.errors[field]]),
  );
}

/** A check as a write's answer: the post, or the first thing it still needs. */
export function postCheckResult(check: PostCheck): WriteResult<OutreachPost> {
  if (check.ok) return { ok: true, value: check.value };
  return refused(firstPostError(check.errors)?.error ?? "The post is not complete.");
}

// What the browser sends with Save draft and Publish is read back into
// fields here; anything that is not the panel's shape is refused whole.

type Shape = Record<string, unknown>;

const isShape = (value: unknown): value is Shape => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";

function blockFieldsOf(value: unknown): BodyBlock | null {
  if (!isShape(value) || !isString(value.text)) return null;
  if (value.kind === "paragraph" || value.kind === "heading") return { kind: value.kind, text: value.text };
  if (value.kind === "highlight" && isString(value.label)) return { kind: "highlight", label: value.label, text: value.text };
  return null;
}

function photoFieldsOf(value: unknown): PhotoFields | null {
  if (!isShape(value) || !isPhotoSrc(value.src) || !isString(value.alt)) return null;
  return { src: value.src, alt: value.alt };
}

const isChannelName = (value: unknown): value is ChannelName => (CHANNEL_NAMES as readonly unknown[]).includes(value);

function channelFieldsOf(value: unknown): ChannelFields | null {
  if (!isShape(value) || !isChannelName(value.name) || !isString(value.url) || !isString(value.caption)) return null;
  if (value.account !== undefined && !isString(value.account)) return null;
  return {
    name: value.name,
    url: value.url,
    caption: value.caption,
    ...(value.account !== undefined && { account: value.account }),
  };
}

function listOf<T>(value: unknown, read: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(read);
  return items.some((item) => item === null) ? null : (items as T[]);
}

/** A gallery photo the panel sent: an uploaded one, since the post panel never makes a placeholder; null otherwise. */
function galleryItemFieldsOf(value: unknown): GalleryItemFields | null {
  if (!isShape(value) || !isPhotoSrc(value.src) || !isString(value.alt) || !isString(value.caption)) return null;
  return { src: value.src, alt: value.alt, caption: value.caption };
}

/** The gallery's photos the panel sent, up to the most a gallery holds; null otherwise. */
function galleryFieldsOf(value: unknown): GalleryItemFields[] | null {
  return Array.isArray(value) && value.length <= GALLERY_MAX ? listOf(value, galleryItemFieldsOf) : null;
}

/** `value` as the panel's fields: every key in its shape, no channel or photo twice; null otherwise. */
export function readPostFields(value: unknown): PostFields | null {
  if (!isShape(value)) return null;
  const { title, date, place, lead, summary } = value;
  if (![title, date, place, lead, summary].every(isString)) return null;
  const tags = listOf(value.tags, (tag) => (isString(tag) ? tag : null));
  const body = listOf(value.body, blockFieldsOf);
  const photos = listOf(value.photos, photoFieldsOf);
  const channels = listOf(value.channels, channelFieldsOf);
  const gallery = galleryFieldsOf(value.gallery);
  if (tags === null || body === null || photos === null || channels === null || gallery === null) return null;
  if (new Set(channels.map((c) => c.name)).size !== channels.length || new Set(tags).size !== tags.length) return null;
  if (new Set(photos.map((p) => p.src)).size !== photos.length) return null;
  return {
    title: title as string,
    date: date as string,
    place: place as string,
    tags,
    lead: lead as string,
    summary: summary as string,
    body,
    photos,
    channels,
    gallery,
  };
}
