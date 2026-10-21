"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import type { ContentItem } from "@/lib/content/versioned";
import { projectRows, type ProjectRow, type RowVisual } from "@/lib/project-content/dashboard-list";
import { takenSlugs } from "@/lib/project-content/new-project";
import type { ProjectRecord } from "@/lib/project-content/record";
import { withSubscriptDigits } from "@/lib/project-content/subscript";
import { CONTENT_FOCUS as FOCUS, StatusPill } from "./content-parts";
import { NewProjectDialog } from "./new-project-dialog";
import { EYEBROW, PageHeader, PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";

// The dashboard Projects page (board 91, issue #506): one row per stored
// project, drafts included, newest first by the rule Home and /projects use
// (lib/project-content/dashboard-list.ts). Each row shows the project's own
// background with its top-of-page visual, its name and card line, its kind, years, card status and whether
// it is on the site, then Edit page (the project on its page, board 75b),
// View on site once a version is published. The row has no menu (Owner
// decision, issue #506). The list sets no order. On phones each row is a compact card with the same fields
// and actions. New project in the header stores a draft and opens it in the
// editor (issue #301).

/** Project, Kind, Years, Status, On the site and the actions; below lg each row is a card. */
const COLUMNS = "lg:grid lg:grid-cols-[minmax(0,2.6fr)_72px_minmax(0,1fr)_minmax(0,1.3fr)_128px_152px] lg:items-center lg:gap-4";

const EDIT_PAGE = `inline-flex h-[30px] shrink-0 items-center justify-center gap-2 rounded-full bg-prt-text px-3 text-[13px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 ${FOCUS}`;
const ICON_BUTTON = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white-10 text-prt-text transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`;
const CARD_STATUS = "inline-flex h-[22px] max-w-full items-center whitespace-nowrap rounded-full bg-white-5 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-2";

export function ProjectsView({ items }: { items: readonly ContentItem<ProjectRecord>[] }) {
  const [creating, setCreating] = useState(false);
  const rows = projectRows(items);

  return (
    <>
      <PageHeader
        title="Projects"
        intro="The projects on the site, newest first. Drafts stay hidden until you publish them."
        action={
          <button type="button" onClick={() => setCreating(true)} className={PRIMARY_PILL}>
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            New project
          </button>
        }
      />
      <NewProjectDialog open={creating} onOpenChange={setCreating} taken={takenSlugs(items)} />
      <section aria-label="Projects" className={`${PANEL} mt-6 overflow-hidden`}>
        <div className={`hidden border-b border-hairline px-4 py-3 ${COLUMNS}`}>
          <span className={EYEBROW}>Project</span>
          <span className={EYEBROW}>Kind</span>
          <span className={EYEBROW}>Years</span>
          <span className={EYEBROW}>Status</span>
          <span className={EYEBROW}>On the site</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-[14px] text-prt-muted">No projects yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {rows.map((row) => (
              <ProjectRowItem key={row.id} row={row} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/**
 * The thumbnail's visual over its background, as a home card draws it at
 * 56px wide (Owner decision on #522): a model's card still in the box the
 * card's stage takes (as wide as the card, 1048 / 427 of its width tall, its
 * top 260 / 427 of its width above the card's), a photo filling the
 * thumbnail, or nothing. Stills only: the list mounts no 3D canvas.
 */
function RowVisualImage({ visual }: { visual: RowVisual }) {
  switch (visual.kind) {
    case "still":
      return (
        <span aria-hidden className="absolute inset-x-0 -top-[34px] h-[137px]">
          <Image src={visual.src} alt="" fill sizes="64px" className="object-cover" />
        </span>
      );
    case "photo":
      return <Image src={visual.src} alt={visual.alt} fill sizes="56px" unoptimized={!visual.src.startsWith("/")} className="object-cover" />;
    case "none":
      return null;
  }
}

function ProjectRowItem({ row }: { row: ProjectRow }) {
  const editHref = `/dashboard/projects/${row.slug}`;
  return (
    <li className={`flex flex-col gap-3 px-4 py-4 transition-colors duration-300 ease-out hover:bg-white-5 ${COLUMNS}`}>
      <div className="flex min-w-0 items-center gap-4">
        <span className="relative h-[72px] w-14 shrink-0 overflow-hidden rounded-md bg-white-5">
          {/* An uploaded background (issue #529) is served as it is, as uploaded photos are. */}
          <Image src={row.texture} alt="" fill sizes="56px" unoptimized={!row.texture.startsWith("/")} className="object-cover" />
          <RowVisualImage visual={row.visual} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-prt-text">{row.name}</span>
          <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-prt-muted">{withSubscriptDigits(row.desc.text)}</span>
        </span>
      </div>

      {/* Phones: kind and years on one line, then the two pills. From lg each is its own column. */}
      <p className="flex min-w-0 items-center gap-2 text-[13px] text-prt-text lg:hidden">
        <span>{row.kind}</span>
        <span aria-hidden className="text-dim">
          ·
        </span>
        <span className="font-mono">{row.years}</span>
      </p>
      <span className="hidden text-[13px] text-prt-text lg:block">{row.kind}</span>
      <span className="hidden truncate font-mono text-[13px] text-prt-text lg:block">{row.years}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-2 lg:contents">
        <span className="min-w-0">
          <span className={CARD_STATUS}>
            <span className="truncate">{row.status}</span>
          </span>
        </span>
        <span>
          <StatusPill status={row.content} />
        </span>
      </div>

      <div className="flex items-center gap-2 lg:justify-end">
        <Link href={editHref} className={EDIT_PAGE}>
          <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Edit page
        </Link>
        {row.onSite !== null && (
          <a href={row.onSite} target="_blank" rel="noopener noreferrer" aria-label={`View ${row.name} on site`} title="View on site" className={ICON_BUTTON}>
            <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        )}
      </div>
    </li>
  );
}
