"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { EyeOff, ExternalLink, Instagram, Linkedin, Plus, Star, StarOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteOutreachPost, featureOutreachPost, unfeatureOutreachPost, unpublishOutreachPost } from "@/app/dashboard/outreach-actions";
import { Photo } from "@/components/outreach/photo";
import {
  FEATURE_LOCKED,
  FEATURED_FULL,
  featuredAfter,
  featureMoveDone,
  isFeatured,
  unfeaturing,
  type FeaturedIds,
  type FeatureMove,
} from "@/lib/outreach-featured";
import {
  filterRows,
  isLive,
  LIST_STATUS_LABELS,
  NO_FILTER,
  outreachRow,
  rowDate,
  sharedOn,
  type ListStatus,
  type OutreachFilter,
  type OutreachRow,
} from "@/lib/outreach-list";
import { titleOf, type MainChannelName, type OutreachPhoto, type OutreachTag } from "@/lib/outreach-types";
import { ConfirmDialog } from "./confirm-dialog";
import { CONTENT_FOCUS as FOCUS, StatusPill } from "./content-parts";
import { ColumnFilterMenu, FilterMenu } from "./controls";
import { MenuItem, RowMenu } from "./division-members";
import { EYEBROW, PageHeader, PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";

// The Outreach page (board 74, issue #289): every post, newest first, with tag
// and status filters in the table's headings and each row's menu: View on
// site, Feature or Unfeature, Unpublish, Delete. A post opens on its own page
// under the edit shell (issue #288); New post opens an empty one there (board
// 74f, issue #292). A draft with no title yet is listed as "Untitled post",
// and one with no photo yet shows an empty thumbnail. Featured is a setting
// on any published post (issue #496): a featured post takes a Featured card
// of its own at the top of /outreach, a Featured mark sits on its row, and at
// most two are featured at once. The page keeps the rows it was sent and each
// answer from the server; every write is checked there again, behind the
// site-content gate.

const STATUS_OPTIONS = (Object.keys(LIST_STATUS_LABELS) as ListStatus[]).map((value) => ({ value, label: LIST_STATUS_LABELS[value] }));

export function OutreachView({
  rows: initial,
  tags,
  featured: initialFeatured,
}: {
  rows: readonly OutreachRow[];
  tags: readonly OutreachTag[];
  /** The featured posts' ids: none, one or two. */
  featured: FeaturedIds;
}) {
  const [rows, setRows] = useState<readonly OutreachRow[]>(initial);
  const [featured, setFeatured] = useState<FeaturedIds>(initialFeatured);
  const [filter, setFilter] = useState<OutreachFilter>(NO_FILTER);
  const [deleting, setDeleting] = useState<OutreachRow | null>(null);
  const shown = filterRows(rows, filter);
  const tagOptions = tags.map((t) => ({ value: t.name, label: t.name }));
  const award = new Set(tags.filter((t) => t.award).map((t) => t.name));

  const unpublish = (row: OutreachRow) => {
    void unpublishOutreachPost(row.id).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRows((list) => list.map((r) => (r.id === row.id ? outreachRow(result.value, row.slug) : r)));
      // The server freed its featured slot in the same write (issue #502).
      setFeatured((ids) => unfeaturing(ids, row.id));
      toast.success(`${titleOf(row.post)} is off the Outreach page and kept as a draft.`);
    });
  };

  const moveFeature = (move: FeatureMove) => {
    const write = move.kind === "feature" ? featureOutreachPost : unfeatureOutreachPost;
    void write(move.id).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setFeatured((ids) => featuredAfter(ids, move));
      toast.success(featureMoveDone(move));
    });
  };

  const filters = {
    tag: (
      <ColumnFilterMenu heading="Tags" allLabel="All tags" options={tagOptions} value={filter.tag} onChange={(tag) => setFilter((f) => ({ ...f, tag }))} />
    ),
    status: (
      <ColumnFilterMenu
        heading="Status"
        allLabel="Every status"
        options={STATUS_OPTIONS}
        value={filter.status}
        onChange={(status) => setFilter((f) => ({ ...f, status: status as ListStatus | null }))}
      />
    ),
  };

  return (
    <>
      <PageHeader
        title="Outreach"
        intro="Posts on the Outreach page, newest first. Drafts stay hidden until you publish them."
        action={
          <Link href="/dashboard/outreach/new" className={PRIMARY_PILL}>
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            New post
          </Link>
        }
      />

      {/* Phones have no table headings, so the two filters sit over the cards. */}
      <div className="mt-5 flex flex-wrap gap-2 md:hidden">
        <FilterMenu look="chip" label="Tag" allLabel="All tags" options={tagOptions} value={filter.tag} onChange={(tag) => setFilter((f) => ({ ...f, tag }))} />
        <FilterMenu
          look="chip"
          label="Status"
          allLabel="Every status"
          options={STATUS_OPTIONS}
          value={filter.status}
          onChange={(status) => setFilter((f) => ({ ...f, status: status as ListStatus | null }))}
        />
      </div>

      <section aria-label="Posts" className={`${PANEL} mt-3 overflow-hidden md:mt-6`}>
        <div className={`hidden items-center gap-4 border-b border-hairline px-4 py-3 md:grid ${COLUMNS}`}>
          <span className={EYEBROW}>Post</span>
          <span className={EYEBROW}>Date · Place</span>
          <span className="hidden lg:block">{filters.tag}</span>
          <span className={`${EYEBROW} hidden lg:block`}>Shared on</span>
          <span>{filters.status}</span>
          <span />
        </div>
        {shown.length === 0 ? (
          <p className="px-5 py-6 text-[14px] text-prt-muted">{rows.length === 0 ? "No posts yet." : "No post matches these filters."}</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {shown.map((row) => (
              <PostRow
                key={row.id}
                row={row}
                award={award}
                featured={isFeatured(featured, row.id)}
                full={featured.length === 2}
                onMove={moveFeature}
                onUnpublish={() => unpublish(row)}
                onDelete={() => setDeleting(row)}
              />
            ))}
          </ul>
        )}
      </section>

      {deleting !== null && (
        <DeleteDialog
          row={deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          onDeleted={() => {
            setRows((list) => list.filter((r) => r.id !== deleting.id));
            setFeatured((ids) => unfeaturing(ids, deleting.id));
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}

/** Post, Date · Place, Tags, Shared on, Status and the menu; below lg the tags and channels give way. */
const COLUMNS =
  "md:grid-cols-[minmax(0,1fr)_150px_110px_32px] lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_88px_118px_32px]";

const CHANNEL_ICONS: Readonly<Record<MainChannelName, { Icon: typeof Instagram; label: string }>> = {
  instagram: { Icon: Instagram, label: "Instagram" },
  linkedin: { Icon: Linkedin, label: "LinkedIn" },
};

function PostRow({
  row,
  award,
  featured,
  full,
  onMove,
  onUnpublish,
  onDelete,
}: {
  row: OutreachRow;
  award: ReadonlySet<string>;
  /** Whether this post is featured at the top of /outreach (issue #496). */
  featured: boolean;
  /** Whether two posts are featured already, so no other can be. */
  full: boolean;
  onMove: (move: FeatureMove) => void;
  onUnpublish: () => void;
  onDelete: () => void;
}) {
  const { post, status } = row;
  const live = isLive(status);
  const channels = sharedOn(post);
  const title = titleOf(post);
  return (
    <li className={`flex items-center gap-3 px-4 py-3 transition-colors duration-300 ease-out hover:bg-white-5 md:grid md:gap-4 ${COLUMNS}`}>
      <Link href={`/dashboard/outreach/${row.slug}`} className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg md:gap-4 ${FOCUS}`}>
        <Thumb photo={post.photos[0]} />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-medium text-prt-text">{title}</span>
            {featured && (
              <span className="inline-flex h-[20px] shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 text-[11px] font-medium text-accent">
                <Star aria-hidden className="h-3 w-3" strokeWidth={2} />
                Featured
              </span>
            )}
          </span>
          <span className="block truncate text-[13px] text-prt-muted md:line-clamp-2 md:whitespace-normal">{post.summary.text}</span>
          <span className="mt-0.5 block truncate text-[12px] text-prt-muted md:hidden">
            {rowDate(post.date)}
            {post.place && ` · ${post.place}`}
          </span>
        </span>
      </Link>
      <span className="hidden min-w-0 text-[13px] md:block">
        <span className="block truncate text-prt-text">{rowDate(post.date)}</span>
        <span className="block truncate text-prt-muted">{post.place ?? "No place"}</span>
      </span>
      <span className="hidden min-w-0 flex-wrap gap-1.5 lg:flex">
        {post.tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex h-[22px] items-center rounded-full px-2 text-[12px] ${award.has(tag) ? "bg-accent-soft text-accent" : "bg-white-10 text-prt-text"}`}
          >
            {tag}
          </span>
        ))}
      </span>
      <span className="hidden items-center gap-2.5 text-text-2 lg:flex">
        {channels.map((name) => {
          const { Icon, label } = CHANNEL_ICONS[name];
          return <Icon key={name} role="img" aria-label={label} className="h-4 w-4" strokeWidth={1.75} />;
        })}
      </span>
      <span className="shrink-0">
        <StatusPill status={status} short />
      </span>
      <span className="shrink-0">
        <RowMenu label={`More for ${title}`}>
          <MenuItem
            icon={<ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />}
            locked={live ? null : "Not on the site until it is published."}
            onSelect={() => window.open(`/outreach/${row.slug}`, "_blank", "noopener,noreferrer")}
          >
            View on site
          </MenuItem>
          {featured ? (
            <MenuItem
              icon={<StarOff className="h-3.5 w-3.5" strokeWidth={1.75} />}
              detail="Puts it back in the post list on the Outreach page."
              onSelect={() => onMove({ kind: "unfeature", id: row.id, title })}
            >
              Unfeature
            </MenuItem>
          ) : (
            <MenuItem
              icon={<Star className="h-3.5 w-3.5" strokeWidth={1.75} />}
              locked={!live ? FEATURE_LOCKED : full ? FEATURED_FULL : null}
              detail={live && !full ? "Shows it in a Featured card at the top of the Outreach page. Up to two posts can be featured." : null}
              onSelect={() => onMove({ kind: "feature", id: row.id, title })}
            >
              Feature
            </MenuItem>
          )}
          <MenuItem
            icon={<EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />}
            locked={live ? null : "Already a draft."}
            detail={live ? "Takes it off the Outreach page and keeps it as a draft." : null}
            onSelect={onUnpublish}
          >
            Unpublish
          </MenuItem>
          <MenuItem danger icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />} onSelect={onDelete}>
            Delete
          </MenuItem>
        </RowMenu>
      </span>
    </li>
  );
}

/** The post's cover; the PRT mark while a draft has no photo yet (issue #366). */
function Thumb({ photo }: { photo: OutreachPhoto | undefined }) {
  return (
    <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md bg-white-5">
      <Photo photo={photo && { ...photo, alt: "" }} sizes="64px" />
    </span>
  );
}

function DeleteDialog({ row, onOpenChange, onDeleted }: { row: OutreachRow; onOpenChange: (open: boolean) => void; onDeleted: () => void }) {
  const [pending, startTransition] = useTransition();
  const title = titleOf(row.post);
  const confirm = () =>
    startTransition(async () => {
      const result = await deleteOutreachPost(row.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDeleted();
      toast.success(`${title} was deleted.`);
    });
  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      icon={<Trash2 className="h-5 w-5" strokeWidth={1.75} />}
      title={`Delete ${title}?`}
      description={
        isLive(row.status)
          ? `${title} leaves the Outreach page and its own page at once, with its draft. This cannot be undone.`
          : `The draft of ${title} is deleted. This cannot be undone.`
      }
      cancelLabel="Keep post"
      confirmLabel="Delete"
      danger
      pending={pending}
      onConfirm={confirm}
    />
  );
}
