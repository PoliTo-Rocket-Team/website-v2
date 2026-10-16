import { editorVersion, statusOf, type ContentStatus } from "./content/versioned";
import type { IsoDate, MainChannelName, OutreachDraft, PostItem } from "./outreach-types";

// The dashboard's Outreach list (board 74, issue #289): every post, newest
// first, as the editor shows it (its draft when it has one), with the tag and
// status filters over the table. The page builds the rows on the server, so
// the browser never loads the post record; the filters run in the browser.

/** One row of the posts table. */
export type OutreachRow = {
  readonly id: number;
  /** The post's address on the public site, /outreach/<slug>. */
  readonly slug: string;
  readonly post: OutreachDraft;
  readonly status: ContentStatus;
};

export function outreachRow(item: PostItem, slug: string): OutreachRow {
  return { id: item.id, slug, post: editorVersion(item.version), status: statusOf(item.version) };
}

/** The rows newest first, as the public page orders the posts. */
export function newestRowsFirst(rows: readonly OutreachRow[]): OutreachRow[] {
  return [...rows].sort((a, b) => b.post.date.localeCompare(a.post.date) || b.id - a.id);
}

/**
 * What the Status filter offers: the two words the table's pills show. A
 * published post with draft changes reads Draft there (board 74), so it
 * filters as one.
 */
export type ListStatus = "draft" | "published";

export const LIST_STATUS_LABELS: Readonly<Record<ListStatus, string>> = { draft: "Draft", published: "Published" };

export function listStatusOf(status: ContentStatus): ListStatus {
  return status === "published" ? "published" : "draft";
}

/** The two filters; null shows every post. */
export type OutreachFilter = { readonly tag: string | null; readonly status: ListStatus | null };

export const NO_FILTER: OutreachFilter = { tag: null, status: null };

export function filterRows(rows: readonly OutreachRow[], filter: OutreachFilter): OutreachRow[] {
  return rows.filter(
    (row) =>
      (filter.tag === null || row.post.tags.includes(filter.tag)) &&
      (filter.status === null || listStatusOf(row.status) === filter.status),
  );
}

/** Whether Unpublish has anything to take down: the public site shows the post. */
export function isLive(status: ContentStatus): boolean {
  return status !== "draft";
}

/** The channels the post was shared on, Instagram first (the table's "Shared on"). */
export function sharedOn(post: OutreachDraft): MainChannelName[] {
  return (["instagram", "linkedin"] as const).filter((name) => post.channels[name] !== undefined);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "18 Oct 2026": the table's date. */
export function rowDate(date: IsoDate): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
