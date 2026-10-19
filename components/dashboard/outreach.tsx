"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { EyeOff, ExternalLink, Instagram, Linkedin, Pencil, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteOutreachPost, pinOutreachPost, saveOutreachSummit, unpinOutreachPost, unpublishOutreachPost } from "@/app/dashboard/outreach-actions";
import { Photo } from "@/components/outreach/photo";
import { statusOf, type PublishStep } from "@/lib/content/versioned";
import type { SummitVersions } from "@/lib/outreach-editor";
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
import {
  EDITION_PLACE_MAX,
  editionsLine,
  SUMMIT_LIMITS,
  summitFieldErrors,
  summitFieldsOf,
  type SummitFieldErrors,
  type SummitFields,
} from "@/lib/outreach-summit-fields";
import { titleOf, type MainChannelName, type OutreachPhoto, type OutreachTag } from "@/lib/outreach-types";
import { ConfirmDialog } from "./confirm-dialog";
import { CONTENT_FOCUS as FOCUS, PublishFooter, StatusPill, TextField } from "./content-parts";
import { ColumnFilterMenu, FilterMenu } from "./controls";
import { MenuItem, RowMenu } from "./division-members";
import { DrawerPage, PanelBody, SidePanel } from "./drawer";
import { inputClass } from "./field";
import { EYEBROW, GHOST_PILL, PageHeader, PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";

// The Outreach page (board 74, issue #289): the featured summit with Edit,
// then every post, newest first, with tag and status filters in the table's
// headings and each row's menu: View on site, Unpublish, Delete. A post opens
// on its own page under the edit shell (issue #288); New post opens an empty
// one there (board 74f, issue #292). A draft with no title yet is listed as
// "Untitled post", and one with no photo yet shows an empty thumbnail. A
// published post can be pinned from its menu (issue #392): it takes the
// Featured card at the top of /outreach, under the summit's line and
// editions, and a Pinned pill marks its row; pinning another post unpins it,
// so at most one is pinned. The page keeps the rows it was sent and each
// answer from the server; every write is checked there again, behind the
// site-content gate.

const STATUS_OPTIONS = (Object.keys(LIST_STATUS_LABELS) as ListStatus[]).map((value) => ({ value, label: LIST_STATUS_LABELS[value] }));

export function OutreachView({
  rows: initial,
  summit: initialSummit,
  tags,
  pinned: initialPinned,
}: {
  rows: readonly OutreachRow[];
  summit: SummitVersions;
  tags: readonly OutreachTag[];
  /** The pinned post's id; null while none is. */
  pinned: number | null;
}) {
  const [rows, setRows] = useState<readonly OutreachRow[]>(initial);
  const [summit, setSummit] = useState<SummitVersions>(initialSummit);
  const [pinned, setPinned] = useState<number | null>(initialPinned);
  const pinnedRow = rows.find((r) => r.id === pinned);
  const [filter, setFilter] = useState<OutreachFilter>(NO_FILTER);
  // Each opening starts the panel afresh from the summit as it is now.
  const [opened, setOpened] = useState<number | null>(null);
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
      toast.success(`${titleOf(row.post)} is off the Outreach page and kept as a draft.`);
    });
  };

  const pin = (row: OutreachRow) => {
    void pinOutreachPost(row.id).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPinned(row.id);
      toast.success(`${titleOf(row.post)} is pinned to the top of the Outreach page.`);
    });
  };

  const unpin = (row: OutreachRow) => {
    void unpinOutreachPost().then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPinned(null);
      toast.success(`${titleOf(row.post)} is back in the post list.`);
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
    <DrawerPage drawerOpen={opened !== null} wide>
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

      <SummitCard summit={summit} pinned={pinnedRow} onEdit={() => setOpened((n) => (n ?? 0) + 1)} />

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

      <section aria-label="Posts" className={`${PANEL} mt-3 overflow-hidden md:mt-5`}>
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
                pinned={row.id === pinned}
                onPin={() => pin(row)}
                onUnpin={() => unpin(row)}
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
            setDeleting(null);
          }}
        />
      )}

      {opened !== null && (
        <SummitPanel key={opened} summit={summit} pinned={pinnedRow !== undefined} onClose={() => setOpened(null)} onSaved={setSummit} />
      )}
    </DrawerPage>
  );
}

/** Post, Date · Place, Tags, Shared on, Status and the menu; below lg the tags and channels give way. */
const COLUMNS =
  "md:grid-cols-[minmax(0,1fr)_150px_110px_32px] lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_88px_118px_32px]";

/**
 * Board 74's card over the table: what the Featured card shows, the pinned
 * post's photo and title (issue #392) or, with none pinned, the summit's,
 * under the summit's eyebrow, then its editions, and Edit.
 */
function SummitCard({ summit, pinned, onEdit }: { summit: SummitVersions; pinned: OutreachRow | undefined; onEdit: () => void }) {
  const shown = summit.draft ?? summit.published;
  const photo = pinned === undefined ? shown.photo : pinned.post.photos[0];
  return (
    <section aria-label="Featured summit" className={`${PANEL} mt-6 flex items-center gap-4 p-4`}>
      <span className="relative hidden h-[60px] w-[96px] shrink-0 overflow-hidden rounded-lg bg-white-5 sm:block">
        <Photo photo={photo && { ...photo, alt: "" }} sizes="96px" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`${EYEBROW} truncate`}>Featured · {shown.eyebrow}</p>
        <p className="mt-1.5 truncate text-[15px] font-semibold text-prt-text">
          {pinned === undefined ? shown.title : `Pinned: ${titleOf(pinned.post)}`}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-prt-muted">{editionsLine(shown)}</p>
      </div>
      {summit.draft !== null && (
        <span className="hidden shrink-0 sm:block">
          <StatusPill status={statusOf(summit)} />
        </span>
      )}
      <button type="button" onClick={onEdit} className={GHOST_PILL}>
        <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Edit
      </button>
    </section>
  );
}

const CHANNEL_ICONS: Readonly<Record<MainChannelName, { Icon: typeof Instagram; label: string }>> = {
  instagram: { Icon: Instagram, label: "Instagram" },
  linkedin: { Icon: Linkedin, label: "LinkedIn" },
};

function PostRow({
  row,
  award,
  pinned,
  onPin,
  onUnpin,
  onUnpublish,
  onDelete,
}: {
  row: OutreachRow;
  award: ReadonlySet<string>;
  /** Whether this is the post pinned to the top of /outreach (issue #392). */
  pinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
}) {
  const { post, status } = row;
  const live = isLive(status);
  const channels = sharedOn(post);
  return (
    <li className={`flex items-center gap-3 px-4 py-3 transition-colors duration-300 ease-out hover:bg-white-5 md:grid md:gap-4 ${COLUMNS}`}>
      <Link href={`/dashboard/outreach/${row.slug}`} className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg md:gap-4 ${FOCUS}`}>
        <Thumb photo={post.photos[0]} />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-medium text-prt-text">{titleOf(post)}</span>
            {pinned && (
              <span className="inline-flex h-[20px] shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 text-[11px] font-medium text-accent">
                <Pin aria-hidden className="h-3 w-3" strokeWidth={2} />
                Pinned
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
        <RowMenu label={`More for ${titleOf(post)}`}>
          <MenuItem
            icon={<ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />}
            locked={live ? null : "Not on the site until it is published."}
            onSelect={() => window.open(`/outreach/${row.slug}`, "_blank", "noopener,noreferrer")}
          >
            View on site
          </MenuItem>
          {pinned ? (
            <MenuItem
              icon={<PinOff className="h-3.5 w-3.5" strokeWidth={1.75} />}
              detail="Puts it back in the post list. The Featured card shows the summit alone."
              onSelect={onUnpin}
            >
              Unpin
            </MenuItem>
          ) : (
            <MenuItem
              icon={<Pin className="h-3.5 w-3.5" strokeWidth={1.75} />}
              locked={live ? null : "Publish the post before you pin it."}
              detail={live ? "Shows it in the Featured card at the top of the Outreach page, in place of any pinned post." : null}
              onSelect={onPin}
            >
              Pin to top
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

// The summit's edit panel, opened by the card's Edit: its line over the
// title, title, story and the shorter phone story, the photo's description,
// and the editions; Save draft keeps /outreach as it is, Publish changes it.
// While a post is pinned (issue #392) the Featured card shows that post's
// title, summary and photo, so the panel says the summit's own show only
// while none is.
function SummitPanel({
  summit,
  pinned,
  onClose,
  onSaved,
}: {
  summit: SummitVersions;
  pinned: boolean;
  onClose: () => void;
  onSaved: (summit: SummitVersions) => void;
}) {
  const [current, setCurrent] = useState(summit);
  const shown = current.draft ?? current.published;
  const [fields, setFields] = useState<SummitFields>(() => summitFieldsOf(shown));
  const [errors, setErrors] = useState<SummitFieldErrors>({});
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof SummitFields>(name: K, value: SummitFields[K]) => {
    setFields((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };
  const setEdition = (index: number, part: "year" | "place", value: string) =>
    set(
      "editions",
      fields.editions.map((e, i) => (i === index ? { ...e, [part]: value } : e)),
    );

  const submit = (step: PublishStep) => {
    const found = summitFieldErrors(fields);
    setErrors(found);
    if (Object.values(found).some((e) => e !== undefined)) return;
    startTransition(async () => {
      const result = await saveOutreachSummit(step, fields);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrent(result.value);
      onSaved(result.value);
      toast.success(step === "publish" ? "The summit is published on the Outreach page." : "Draft of the summit saved.");
    });
  };

  return (
    <SidePanel
      open
      onOpenChange={(next) => !next && onClose()}
      title="Featured summit"
      wide
      below={
        <span className="mt-1.5 flex items-center gap-2.5 text-[13px] text-text-2">
          <StatusPill status={statusOf(current)} />
          On the Outreach page
        </span>
      }
      footerLayout="spread"
      footer={<PublishFooter onRemove={null} pending={pending} onSubmit={submit} />}
    >
      <form noValidate onSubmit={(e) => e.preventDefault()} className="flex min-h-0 flex-1 flex-col">
        <PanelBody className="flex flex-col gap-5">
          {pinned && (
            <p className="text-[13px] leading-snug text-text-2">
              A post is pinned, so the Featured card shows its title, summary and photo under this line and the editions. The title, story and photo below show only while no post is pinned.
            </p>
          )}
          <TextField label="Line over the title" value={fields.eyebrow} limit={SUMMIT_LIMITS.eyebrow} error={errors.eyebrow} onChange={(v) => set("eyebrow", v)} />
          <TextField label="Title" value={fields.title} limit={SUMMIT_LIMITS.title} error={errors.title} onChange={(v) => set("title", v)} />
          <TextField label="Story" rows={5} value={fields.story} limit={SUMMIT_LIMITS.story} error={errors.story} onChange={(v) => set("story", v)} />
          <TextField
            label="Story on phones"
            hint="optional, shorter"
            rows={3}
            value={fields.storyPhone}
            limit={SUMMIT_LIMITS.storyPhone}
            error={errors.storyPhone}
            onChange={(v) => set("storyPhone", v)}
          />
          <div className="flex items-start gap-4">
            <span className="relative mt-7 h-[60px] w-[96px] shrink-0 overflow-hidden rounded-lg bg-white-5">
              <Photo photo={{ ...shown.photo, alt: "" }} sizes="96px" />
            </span>
            <div className="min-w-0 flex-1">
              <TextField
                label="Photo description"
                rows={3}
                value={fields.photoAlt}
                limit={SUMMIT_LIMITS.photoAlt}
                error={errors.photoAlt}
                onChange={(v) => set("photoAlt", v)}
              />
            </div>
          </div>
          <EditionsField
            editions={fields.editions}
            error={errors.editions}
            onChange={(index, part, value) => setEdition(index, part, value)}
            onAdd={() => set("editions", [...fields.editions, { year: "", place: "" }])}
            onRemove={(index) => set("editions", fields.editions.filter((_, i) => i !== index))}
          />
        </PanelBody>
      </form>
    </SidePanel>
  );
}

/** The editions, one row each: year and place, × to remove; oldest first once saved. */
function EditionsField({
  editions,
  error,
  onChange,
  onAdd,
  onRemove,
}: {
  editions: SummitFields["editions"];
  error?: string;
  onChange: (index: number, part: "year" | "place", value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[13px] leading-snug text-prt-text">
        Editions <span className="ml-1.5 text-prt-muted">the first is the one we started</span>
      </legend>
      <ul className="flex flex-col gap-2">
        {editions.map((edition, index) => (
          <li key={index} className="grid grid-cols-[88px_minmax(0,1fr)_32px] items-center gap-2">
            <input
              aria-label={`Edition ${index + 1} year`}
              inputMode="numeric"
              maxLength={4}
              value={edition.year}
              placeholder="Year"
              onChange={(e) => onChange(index, "year", e.target.value)}
              className={inputClass(error === undefined ? undefined : "")}
            />
            <input
              aria-label={`Edition ${index + 1} place`}
              maxLength={EDITION_PLACE_MAX * 2}
              value={edition.place}
              placeholder="City"
              onChange={(e) => onChange(index, "place", e.target.value)}
              className={inputClass(error === undefined ? undefined : "")}
            />
            <button
              type="button"
              aria-label={`Remove edition ${index + 1}`}
              disabled={editions.length === 1}
              onClick={() => onRemove(index)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>
      {error !== undefined && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
      <button
        type="button"
        onClick={onAdd}
        className={`mt-3 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${FOCUS}`}
      >
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Add edition
      </button>
    </fieldset>
  );
}
