import { refused, type WriteResult } from "@/lib/dashboard/write";
import type { NonEmpty } from "./about/alumni-types";
import { isIsoDate, withMainChannel } from "./outreach-rows";
import {
  CHANNEL_LABELS,
  CHANNEL_NAMES,
  type BodyBlock,
  type Channel,
  type ChannelName,
  type OutreachPost,
  type OutreachTag,
  type PostView,
} from "./outreach-types";
import type { Copy } from "./projects";

// The Edit post panel's fields (boards 74c, 74d and 74h, issue #290): a post
// as the editor types it, the page it draws while they type, and the rules a
// Save draft or a Publish must pass. The panel keeps the fields; only a post
// that passes every rule reaches the store, on either button: a draft is a
// whole post too. Photos are edited in a later slice, so a saved post keeps
// the photos it opened with.

/** One original post as the panel edits it: the link and the first line. `account` is kept as it was. */
export type ChannelFields = {
  readonly name: ChannelName;
  readonly url: string;
  readonly caption: string;
  readonly account?: string;
};

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
  /** In the order the panel lists them; one entry per channel. */
  readonly channels: readonly ChannelFields[];
};

/** The panel's sections that a rule can refuse. */
export type PostField = "title" | "date" | "tags" | "lead" | "summary" | "body" | "channels";

export type PostFieldErrors = Partial<Record<PostField, string>>;

/** A whole post, or what each section still needs. */
export type PostCheck =
  | { readonly ok: true; readonly value: OutreachPost }
  | { readonly ok: false; readonly errors: PostFieldErrors };

/** The panel's fields for a post, as it opens. */
export function postFieldsOf(post: OutreachPost): PostFields {
  return {
    title: post.title,
    date: post.date,
    place: post.place ?? "",
    tags: [...post.tags],
    lead: post.lead,
    summary: post.summary.text,
    body: [...post.body],
    channels: CHANNEL_NAMES.flatMap((name) => {
      const channel = post.channels[name];
      return channel === undefined ? [] : [{ name, ...channel }];
    }),
  };
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

function channelRecord(channels: readonly ChannelFields[]): Partial<Record<ChannelName, Channel>> {
  return Object.fromEntries(channels.map((c) => [c.name, channelOf(c)]));
}

/**
 * The page as the editor sees it while typing: every field as typed, the
 * opened post's date while the date is cleared, and its photos.
 */
export function postViewOf(fields: PostFields, opened: OutreachPost): PostView {
  const place = fields.place.trim();
  return {
    title: fields.title,
    date: isIsoDate(fields.date) ? fields.date : opened.date,
    ...(place !== "" && { place }),
    tags: fields.tags,
    summary: summaryOf(fields.summary.trim(), opened.summary),
    lead: fields.lead,
    body: fields.body,
    photos: opened.photos,
    channels: channelRecord(fields.channels),
  };
}

const isWebLink = (url: string) => /^https?:\/\/\S+\.\S+$/.test(url);

function bodyError(body: readonly BodyBlock[]): string | undefined {
  if (body.length === 0) return "Add at least one text block.";
  if (body.some((b) => b.text.trim() === "")) return "Write the empty text block, or remove it.";
  if (body.some((b) => b.kind === "highlight" && b.label.trim() === "")) return "Give the highlight its label.";
  return undefined;
}

function channelsError(channels: readonly ChannelFields[]): string | undefined {
  if (!channels.some((c) => c.name === "instagram" || c.name === "linkedin")) return "Add the Instagram or LinkedIn post.";
  for (const c of channels) {
    const label = CHANNEL_LABELS[c.name];
    if (c.url.trim() === "") return `${label}: paste the post's link.`;
    if (!isWebLink(c.url.trim())) return `${label}: the link starts with https://.`;
    if (c.caption.trim() === "") return `${label}: write the post's first line.`;
  }
  return undefined;
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
 * text block with its text, and the Instagram or LinkedIn post with a link
 * and a first line on every channel. The post keeps the photos it opened with.
 */
export function checkPostFields(fields: PostFields, opened: OutreachPost, tags: readonly OutreachTag[]): PostCheck {
  const errors: PostFieldErrors = {
    ...(fields.title.trim() === "" && { title: "Write the title." }),
    ...(!isIsoDate(fields.date) && { date: "Pick the date." }),
    ...(fields.lead.trim() === "" && { lead: "Write the lead." }),
    ...(fields.summary.trim() === "" && { summary: "Write the card summary." }),
  };
  const tagError = tagsError(fields.tags, tags);
  const textError = bodyError(fields.body);
  const channelError = channelsError(fields.channels);
  if (tagError !== undefined) errors.tags = tagError;
  if (textError !== undefined) errors.body = textError;
  if (channelError !== undefined) errors.channels = channelError;

  const picked = nonEmpty(fields.tags);
  const body = nonEmpty(fields.body.map(trimmedBlock));
  const channels = withMainChannel(channelRecord(fields.channels));
  const { date } = fields;
  if (Object.keys(errors).length > 0 || picked === null || body === null || channels === null || !isIsoDate(date)) {
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
      photos: opened.photos,
      channels,
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
const FIELD_ORDER: readonly PostField[] = ["title", "date", "tags", "lead", "summary", "body", "channels"];

/** The first field, in panel order, that still needs work, and what it needs. */
export function firstPostError(errors: PostFieldErrors): { field: PostField; error: string } | undefined {
  for (const field of FIELD_ORDER) {
    const error = errors[field];
    if (error !== undefined) return { field, error };
  }
  return undefined;
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

/** `value` as the panel's fields: every key in its shape, no channel twice; null otherwise. */
export function readPostFields(value: unknown): PostFields | null {
  if (!isShape(value)) return null;
  const { title, date, place, lead, summary } = value;
  if (![title, date, place, lead, summary].every(isString)) return null;
  const tags = listOf(value.tags, (tag) => (isString(tag) ? tag : null));
  const body = listOf(value.body, blockFieldsOf);
  const channels = listOf(value.channels, channelFieldsOf);
  if (tags === null || body === null || channels === null) return null;
  if (new Set(channels.map((c) => c.name)).size !== channels.length || new Set(tags).size !== tags.length) return null;
  return {
    title: title as string,
    date: date as string,
    place: place as string,
    tags,
    lead: lead as string,
    summary: summary as string,
    body,
    channels,
  };
}
