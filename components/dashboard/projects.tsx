"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ExternalLink, GripVertical, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { reorderProjects } from "@/app/dashboard/project-actions";
import { HomeProjectCard } from "@/components/landing/project-card";
import { moveTo } from "@/lib/content/order";
import { editorVersion, publicVersion, statusOf, type ContentItem } from "@/lib/content/versioned";
import { takenSlugs } from "@/lib/project-content/new-project";
import { homeCardOf, type ProjectRecord } from "@/lib/project-content/record";
import { CONTENT_FOCUS as FOCUS, StatusPill, useDragOrder, type DragRow } from "./content-parts";
import { NewProjectDialog } from "./new-project-dialog";
import { PageHeader, PRIMARY_PILL } from "./page-header";

/** The home card at Home's heights, as wide as its dashboard column (210px on phones, as Home). */
const DASHBOARD_CARD_LAYOUT = "mx-auto h-[360px] w-[210px] md:h-[618px] md:w-full";

// The dashboard Projects page (board 75, issue #297): every stored project as
// its home card, as Home draws it, at about 0.85 scale and three per row from
// lg. Over each card: the drag grip, its status and the "edited by" line;
// under it: Edit page (the project on its page, board 75b) and View on site.
// Dragging a card, or the arrow keys on its grip, sets the site order Home
// and /projects follow; the server checks the move again behind the
// site-content gate, and a refused one puts the cards back. New project in
// the header stores a draft and opens it in the editor (issue #301).

const EDIT_PAGE =
  "inline-flex h-[30px] flex-1 items-center justify-center gap-2 rounded-full bg-prt-text px-3 text-[13px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90";
const VIEW_ON_SITE =
  "inline-flex h-[30px] flex-1 items-center justify-center gap-2 rounded-full border border-white-10 px-3 text-[13px] font-medium text-prt-text transition-colors duration-300 ease-out hover:border-border-strong";

export function ProjectsView({
  items: initial,
  edited,
}: {
  items: readonly ContentItem<ProjectRecord>[];
  edited: Readonly<Record<number, string>>;
}) {
  const [items, setItems] = useState<readonly ContentItem<ProjectRecord>[]>(initial);
  const [creating, setCreating] = useState(false);
  const ordered = [...items].sort((a, b) => a.siteOrder - b.siteOrder);
  const ids = ordered.map((item) => item.id);

  const reordered = (next: readonly number[]) => {
    const before = items;
    // Every project keeps one of the slots the list held, as the server keeps them (lib/content/order.ts).
    const slots = ordered.map((item) => item.siteOrder);
    const placed = new Map(next.map((id, i) => [id, slots[i]]));
    setItems((list) => list.map((item) => ({ ...item, siteOrder: placed.get(item.id) ?? item.siteOrder })));
    void reorderProjects(next).then((result) => {
      if (!result.ok) {
        setItems(before);
        toast.error(result.error);
      }
    });
  };

  const drag = useDragOrder(ids, reordered);
  const shown = drag.order.flatMap((id) => ordered.filter((item) => item.id === id));

  return (
    <>
      <PageHeader
        title="Projects"
        intro="The rockets on the Projects page, in site order. Drag to reorder."
        action={
          <button type="button" onClick={() => setCreating(true)} className={PRIMARY_PILL}>
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            New project
          </button>
        }
      />
      <NewProjectDialog open={creating} onOpenChange={setCreating} taken={takenSlugs(items)} />
      {shown.length === 0 ? (
        <p className="mt-6 text-[14px] text-prt-muted">No projects yet.</p>
      ) : (
        <ul className="mt-6 grid gap-x-5 gap-y-10 lg:grid-cols-3" {...drag.list}>
          {shown.map((item, index) => (
            <ProjectCard
              key={item.id}
              item={item}
              position={index}
              edited={edited[item.id] ?? null}
              drag={drag.row(item.id, index)}
              onMove={(to) => to >= 0 && to < ids.length && reordered(moveTo(ids, item.id, to))}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function ProjectCard({
  item,
  position,
  edited,
  drag,
  onMove,
}: {
  item: ContentItem<ProjectRecord>;
  position: number;
  edited: string | null;
  drag: DragRow;
  onMove: (to: number) => void;
}) {
  const record = editorVersion(item.version);
  const published = publicVersion(item.version);
  // The grip is the keyboard's way to move a card: the arrow keys move it one place.
  const onKey = (event: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    onMove(position + step);
  };
  return (
    <li
      draggable
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDragEnd={drag.onDragEnd}
      className={`mx-auto flex w-full min-w-0 max-w-[480px] flex-col transition-opacity duration-300 ease-out lg:max-w-none ${drag.dragged ? "opacity-50" : ""}`}
    >
      <div className="mb-2.5 flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onKeyDown={onKey}
          aria-label={`Move ${record.name}`}
          aria-keyshortcuts="ArrowLeft ArrowRight"
          className={`-ml-1 inline-flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-dim transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
        >
          <GripVertical aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <StatusPill status={statusOf(item.version)} />
        {edited !== null && <span className="min-w-0 truncate text-[12px] text-prt-muted">{edited}</span>}
      </div>

      {/* The home card at 0.85 from lg: laid out at its full size in a box
          1/0.85 of the column wide, then scaled from its top left corner,
          inside a frame as tall as the scaled card. Below lg it is the card
          Home draws at that width. The card fills this column: Home's row
          layout sizes it against its scroll row, not against a grid cell. */}
      <div className="flex justify-center lg:block lg:h-[calc(618px*0.85)]">
        <div className="w-full lg:w-[calc(100%/0.85)] lg:origin-top-left lg:scale-[0.85]">
          <HomeProjectCard project={homeCardOf(record, position)} layout={DASHBOARD_CARD_LAYOUT} />
        </div>
      </div>

      <div className="mt-2.5 flex gap-2.5">
        <Link href={`/dashboard/projects/${record.slug}`} className={`${EDIT_PAGE} ${FOCUS}`}>
          <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Edit page
        </Link>
        {published !== null && (
          <a href={`/projects/${published.slug}`} target="_blank" rel="noopener noreferrer" className={`${VIEW_ON_SITE} ${FOCUS}`}>
            <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            View on site
          </a>
        )}
      </div>
    </li>
  );
}
