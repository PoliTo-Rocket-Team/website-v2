import { readFileSync } from "node:fs";
import { editorVersion } from "@/lib/content/versioned";
import type { BodyBlock, OutreachDraft, PostGalleryPhoto, PostItem } from "@/lib/outreach-types";
import { fingerprintOf, type Ledger, type LedgerEntry } from "./ledger";
import type { Snapshot } from "./snapshot";
import type { PostKey, Source } from "./source";

// The ledger for a database the first round of this import wrote to (issue
// #886). That round kept no ledger, so a run with the current source takes
// its drafts for someone else's and skips them, and finds its added posts'
// titles taken. Its real-run report says what it wrote: each draft with the
// post it is on, each added post with its title, and each one's text and
// gallery photos. This reads that report and the database (selects only) and
// names, for each source key, the post the first round wrote on and its
// draft's fingerprint: the entry a run of the current tool would have written.
//
// It seeds only what it can show is still the first round's draft:
// - a draft on a stored post still has the body and the added gallery photos
//   the report printed, and every other field as the published version has it
//   (the first round made it from that version);
// - an added post still holds a draft only, with the title, date, place,
//   tags, summary, lead, body and gallery photos the report printed.
// A draft changed since is the owner's now, so it is not seeded and the run
// skips it. A first-round post is matched to a source key by its title, or,
// for an added post the source has retitled, by its date when exactly one
// source post not matched by title carries it.

/** The text a first-round post was written with, as its report prints it. */
type Printed = {
  readonly title: string;
  /** The body, one line per block. */
  readonly body: readonly string[];
  /** The gallery photos it added, each printed as `<file>: <alt>[ (caption: <caption>)]`. */
  readonly photos: readonly string[];
};

/** A draft the first round wrote on a stored post. */
export type FirstRoundDraft = Printed & { readonly kind: "draft"; readonly postId: number };

/** A post the first round added, holding a draft only; its report line names no post id. */
export type FirstRoundAdded = Printed & {
  readonly kind: "added";
  readonly date: string;
  /** Its head line up to the site order: title, date, place and tags. */
  readonly head: string;
  /** Its summary, phone summary and lead lines. */
  readonly fields: readonly string[];
};

export type FirstRoundPost = FirstRoundDraft | FirstRoundAdded;

export type FirstRound = { readonly drafts: readonly FirstRoundDraft[]; readonly added: readonly FirstRoundAdded[] };

/** A report that is not a first-round real-run report. */
export class FirstRoundError extends Error {}

const DRAFT_LINE = /^ {2}"(.*)" \(post (\d+)\), dated \d{4}-\d{2}-\d{2}: \d+ gallery photos kept, \d+ added$/;
const ADDED_LINE = /^ {2}("(.*)", (\d{4}-\d{2}-\d{2}), .*; tags: .*); site order \d+$/;
const FIELD_LINE = /^ {4}((summary|summary on phones|lead): .*)$/;

const unreadable = (line: string) => new FirstRoundError(`The report has a line it cannot read: ${line.slice(0, 80)}`);

/** The first round's real-run report, read: the drafts it wrote on stored posts, and the posts it added. */
export function parseFirstRound(text: string): FirstRound {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "Outreach Instagram import (issue #886): real run") {
    throw new FirstRoundError("The report is not a real run's report: only a real run says what it wrote.");
  }
  type Open = { body: string[]; photos: string[]; fields: string[] };
  const drafts: FirstRoundDraft[] = [];
  const added: FirstRoundAdded[] = [];
  let section: "drafts" | "added" | null = null;
  let post: Open | null = null;
  let list: "body" | "photos" | null = null;
  for (const line of lines.slice(1)) {
    if (/^\S/.test(line)) {
      section = line.startsWith("Drafts for stored posts, written: ") ? "drafts" : line.startsWith("New posts, each a draft, written: ") ? "added" : null;
      post = null;
      continue;
    }
    if (section === null || line === "") continue;
    const draftHead = section === "drafts" ? DRAFT_LINE.exec(line) : null;
    const addedHead = section === "added" ? ADDED_LINE.exec(line) : null;
    const field = FIELD_LINE.exec(line);
    if (draftHead !== null) {
      post = { body: [], photos: [], fields: [] };
      drafts.push({ kind: "draft", title: draftHead[1], postId: Number(draftHead[2]), body: post.body, photos: post.photos });
      list = null;
    } else if (addedHead !== null) {
      post = { body: [], photos: [], fields: [] };
      added.push({ kind: "added", head: addedHead[1], title: addedHead[2], date: addedHead[3], fields: post.fields, body: post.body, photos: post.photos });
      list = null;
    } else if (post === null) {
      throw unreadable(line);
    } else if (line === "    body:") {
      list = "body";
    } else if (line === "    gallery photos added:" || line === "    gallery (the first is also the cover):") {
      list = "photos";
    } else if (list !== null && line.startsWith("      ")) {
      post[list].push(line.slice(6));
    } else if (section === "added" && list === null && field !== null) {
      post.fields.push(field[1]);
    } else {
      throw unreadable(line);
    }
  }
  if (drafts.length === 0 && added.length === 0) throw new FirstRoundError("The report names no draft and no added post.");
  return { drafts, added };
}

/** Reads the first round's report file. */
export function readFirstRound(file: string): FirstRound {
  return parseFirstRound(readFileSync(file, "utf8"));
}

/** Why a first-round post was not seeded. */
export type NotSeeded = "no-key" | "key-taken" | "no-post" | "several-posts" | "no-draft" | "changed-since";

export type SeedRow =
  | { readonly kind: "seeded"; readonly post: FirstRoundPost; readonly key: PostKey; readonly postId: number; readonly matchedBy: "title" | "date" }
  | { readonly kind: NotSeeded; readonly post: FirstRoundPost; readonly detail?: string };

export type Seed = { readonly ledger: Ledger; readonly rows: readonly SeedRow[] };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function blockLines(block: BodyBlock): string[] {
  return (block.kind === "highlight" ? `[highlight ${block.label}] ${block.text}` : `[${block.kind}] ${block.text}`).split(/\r?\n/);
}

function photoText(photo: PostGalleryPhoto): string {
  return `${photo.alt}${photo.caption === undefined ? "" : ` (caption: ${photo.caption})`}`;
}

/** How the draft differs from what the first round printed and made it from, or null when it does not. */
function changeSince(post: FirstRoundPost, item: PostItem, draft: OutreachDraft): string | null {
  if (draft.title !== post.title) return "its title changed";
  if (!same(draft.body.flatMap(blockLines), post.body)) return "its body changed";
  const printed = post.photos.map((line) => line.slice(line.indexOf(": ") + 2));
  if (printed.length === 0 || !same((draft.gallery?.items ?? []).slice(-printed.length).map(photoText), printed)) return "its gallery changed";
  if (post.kind === "draft") {
    if (item.version.state !== "published") return "it is no longer published";
    const { published } = item.version;
    const fields = (Object.keys({ ...published, ...draft }) as (keyof OutreachDraft)[]).filter((k) => k !== "body" && k !== "gallery");
    const moved = fields.filter((k) => !same(draft[k], published[k]));
    return moved.length === 0 ? null : `its ${moved.join(", ")} ${moved.length === 1 ? "differs" : "differ"} from the published version`;
  }
  if (item.version.state !== "draft") return "it was published";
  const head = `"${draft.title}", ${draft.date}, ${draft.place}; tags: ${draft.tags.join(", ")}`;
  const fields = [`summary: ${draft.summary.text}`, ...(draft.summary.phone === undefined ? [] : [`summary on phones: ${draft.summary.phone}`]), `lead: ${draft.lead}`];
  return head === post.head && same(fields, post.fields) ? null : "its date, place, tags, summary or lead changed";
}

/**
 * The ledger the first round would have written, from its report, the
 * current source and the database: each first-round post matched to a source
 * key, at the post it is on and its draft's fingerprint, when the draft is as
 * the first round left it.
 */
export function seedLedger(firstRound: FirstRound, source: Source, snapshot: Snapshot): Seed {
  const rows: SeedRow[] = [];
  const ledger = new Map<PostKey, LedgerEntry>();
  const used = new Set<PostKey>();

  /** The row for a first-round post matched to `key` and found at `item`; a seeded one also enters the ledger. */
  const seedOne = (post: FirstRoundPost, key: PostKey, matchedBy: "title" | "date", item: PostItem): SeedRow => {
    const draft = item.version.draft;
    if (draft === null) return { kind: "no-draft", post, detail: `post ${item.id}` };
    const changed = changeSince(post, item, draft);
    if (changed !== null) return { kind: "changed-since", post, detail: `post ${item.id}, ${changed}` };
    ledger.set(key, { postId: item.id, fingerprint: fingerprintOf(editorVersion(item.version)) });
    return { kind: "seeded", post, key, postId: item.id, matchedBy };
  };

  for (const post of firstRound.drafts) {
    const key = source.existing.find((e) => e.title === post.title)?.key;
    const item = snapshot.posts.find((p) => p.id === post.postId);
    if (key === undefined) rows.push({ kind: "no-key", post });
    else if (used.has(key)) rows.push({ kind: "key-taken", post, detail: key });
    else if (item === undefined) rows.push({ kind: "no-post", post, detail: `post ${post.postId}` });
    else rows.push(seedOne(post, key, "title", item));
    if (key !== undefined) used.add(key);
  }

  // Added posts: each by its title first; then each one left by its date, when one source post not yet matched alone has it.
  const byTitle = firstRound.added.map((post) => source.added.find((a) => a.title === post.title)?.key);
  for (const key of byTitle) if (key !== undefined) used.add(key);
  firstRound.added.forEach((post, i) => {
    const sameDay = source.added.filter((a) => a.date === post.date && !used.has(a.key));
    const key = byTitle[i] ?? (sameDay.length === 1 ? sameDay[0].key : undefined);
    if (key === undefined) return rows.push({ kind: "no-key", post });
    if (byTitle[i] === undefined) used.add(key);
    const holders = snapshot.posts.filter((p) => p.version.state === "draft" && p.version.draft.title === post.title);
    if (holders.length === 0) return rows.push({ kind: "no-post", post, detail: "no draft-only post has this title" });
    if (holders.length > 1) return rows.push({ kind: "several-posts", post, detail: `posts ${holders.map((h) => h.id).join(", ")}` });
    return rows.push(seedOne(post, key, byTitle[i] === undefined ? "date" : "title", holders[0]));
  });
  return { ledger, rows };
}

const NOT_SEEDED_TEXT: Readonly<Record<NotSeeded, string>> = {
  "no-key": "the source has no post with this title, nor one alone on its date",
  "key-taken": "another first-round post took this source key",
  "no-post": "the database holds no such post",
  "several-posts": "more than one draft-only post has this title",
  "no-draft": "the post holds no draft",
  "changed-since": "the draft changed since the first round wrote it; the run will leave it alone",
};

/** What a seeding prints: each first-round post, seeded with its key or not with why. */
export function renderSeed(reportFile: string, ledgerFile: string, seed: Seed): string {
  const seeded = seed.rows.filter((r) => r.kind === "seeded").length;
  const lines = [
    "Outreach Instagram import (issue #886): ledger seeded from the first round's report; the database was only read",
    `First-round report: ${reportFile}`,
    `Ledger written: ${ledgerFile}`,
    `First-round posts: ${seed.rows.length}; seeded: ${seeded}; not seeded: ${seed.rows.length - seeded}`,
  ];
  for (const r of seed.rows) {
    lines.push(
      r.kind === "seeded"
        ? `  [seeded] "${r.post.title}" -> ${r.key} (post ${r.postId}, matched by ${r.matchedBy})`
        : `  [${r.kind}] "${r.post.title}"${r.detail === undefined ? "" : ` (${r.detail})`}: ${NOT_SEEDED_TEXT[r.kind]}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
