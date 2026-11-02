import type { BodyBlock } from "@/lib/outreach-types";
import type { Plan, SkipKind } from "./plan";
import type { SourcePhoto } from "./source";
import type { Written } from "./write";

// The report a run prints (issue #886): the dry-run list the owner reads
// before the real run. It shows every draft and new post in full, so the
// texts can be approved as they will be stored: each body block, each
// gallery photo with its alt text and its file in the export, and each post
// skipped, with why. It holds what the source holds and the stored titles,
// nothing personal beyond what the posts themselves say.

const SKIP_TEXT: Readonly<Record<SkipKind, string>> = {
  "no-post": "no published post has this title",
  "several-posts": "more than one published post has this title",
  "has-draft": "the post already has a draft; a new one would overwrite it",
  "address-taken": "a stored post already has this title's address",
  "unknown-tag": "a tag is not on the tag list",
};

export type ReportInput = {
  readonly sourceFile: string;
  readonly plan: Plan;
  /** Each photo file the plan carries, and whether it makes a photo the store takes. */
  readonly photos: readonly { readonly file: string; readonly fit: boolean }[];
  /** What a real run wrote and how many photos it uploaded; absent on a dry run. */
  readonly written?: Written & { readonly uploaded: number };
};

function blockLine(block: BodyBlock): string {
  return block.kind === "highlight" ? `[highlight ${block.label}] ${block.text}` : `[${block.kind}] ${block.text}`;
}

function photoLine(photo: SourcePhoto): string {
  return `${photo.file}: ${photo.alt}${photo.caption === undefined ? "" : ` (caption: ${photo.caption})`}`;
}

export function renderReport({ sourceFile, plan, photos, written }: ReportInput): string {
  const dry = written === undefined;
  const lines: string[] = [];
  const push = (indent: number, text: string) => lines.push(`${" ".repeat(indent)}${text}`);
  push(0, `Outreach Instagram import (issue #886): ${dry ? "dry run, nothing written or uploaded" : "real run"}`);
  push(0, `Source: ${sourceFile}`);

  push(0, `Drafts for stored posts${dry ? "" : ", written"}: ${written?.drafts ?? plan.drafts.length}`);
  for (const d of plan.drafts) {
    const kept = d.published.gallery?.items.length ?? 0;
    push(2, `"${d.entry.title}" (post ${d.postId}), dated ${d.published.date}: ${kept} gallery photos kept, ${d.entry.gallery.length} added`);
    push(4, "body:");
    for (const block of d.entry.body) push(6, blockLine(block));
    push(4, "gallery photos added:");
    for (const photo of d.entry.gallery) push(6, photoLine(photo));
  }

  push(0, `New posts, each a draft${dry ? "" : ", written"}: ${written?.added ?? plan.added.length}`);
  for (const a of plan.added) {
    const e = a.entry;
    push(2, `"${e.title}", ${e.date}, ${e.place}; tags: ${e.tags.join(", ")}; site order ${a.siteOrder}`);
    push(4, `summary: ${e.summary.text}`);
    if (e.summary.phone !== undefined) push(4, `summary on phones: ${e.summary.phone}`);
    push(4, `lead: ${e.lead}`);
    push(4, "body:");
    for (const block of e.body) push(6, blockLine(block));
    push(4, "gallery (the first is also the cover):");
    for (const photo of e.gallery) push(6, photoLine(photo));
  }

  push(0, `Skipped: ${plan.skipped.length}`);
  for (const s of plan.skipped) push(2, `[${s.kind}] "${s.title}"${s.detail === undefined ? "" : ` (${s.detail})`}: ${SKIP_TEXT[s.kind]}`);

  const unfit = photos.filter((p) => !p.fit);
  push(0, `Photo files: ${photos.length}; ${dry ? "would be uploaded" : "uploaded"}: ${written?.uploaded ?? photos.length - unfit.length}`);
  if (unfit.length > 0) {
    push(0, `Photo files that make no photo the store takes (a JPEG, PNG or WebP of at most 4 MB once shrunk): ${unfit.length}`);
    for (const p of unfit) push(2, p.file);
  }
  return `${lines.join("\n")}\n`;
}
