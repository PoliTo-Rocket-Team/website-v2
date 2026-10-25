"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { saveProject } from "@/app/dashboard/project-actions";
import type { ProjectFrame } from "@/components/project-page/view";
import type { EditDevice, PageTarget } from "@/lib/content/edit-shell";
import { editorVersion, statusOf, type ContentItem, type PublishStep } from "@/lib/content/versioned";
import {
  blockSection,
  fieldProblems,
  fieldsAfterSave,
  fieldsOf,
  outlinedSection,
  projectModelOf,
  projectViewOf,
  type PanelSection,
  type ProjectFields,
} from "@/lib/project-content/fields";
import { editBlocksOf, outlinedPart, sectionOf, topPartOf } from "@/lib/project-content/page-parts";
import { cardLookOf, liveLookOf, PROJECT_CHECKED_PAGES, type ProjectCheckedPage } from "@/lib/project-content/card-look";
import { homeCardOf, lineupWith, type ProjectBlock, type ProjectPlace, type ProjectRecord } from "@/lib/project-content/record";
import type { ProjectPart, TopPart } from "@/lib/project-pages";
import { EditableBlock, EditShell, type BlockShape } from "./edit-shell";
import { EditedProjectPage, ProjectCardPage, type ProjectPageId } from "./project-edit-pages";
import { ProjectEditPanel, type FieldErrors, type PanelScroll } from "./project-edit-panel";

// A project on its real page under the edit shell (boards 75b, 75c and 93,
// issue #298, epic #522). The page is drawn from the panel's fields, so it
// changes as the editor types; Save draft and Publish on the bar send the
// fields to the projects editor, which checks them again. Save draft leaves
// the published page live. Each part of the page is outlined round its
// content with its name and an Edit chip, as the Edit post page's parts are
// (epic #614): the top of the page in three parts, the title and its
// details, the visual and the key facts, and every page block. A chip opens
// the part's row in the panel (the one Top of the page row for the top's
// three) and brings the part's fields into view; of the open rows, the part
// whose row was opened last is outlined strongest and scrolled into view.
//
// The page switch (board 75d, issue #300): the project's own page, then Home
// and the Projects list, each drawn from the fields being edited with the
// project's card in its place among the published ones, outlined with an
// Edit card chip that opens the panel's Card section; the other cards are
// dimmed.
//
// Publish is held (board 93e, issues #530 and #581) after the visual or the
// background changes, and on a project never published, until the editor has
// ticked Home and the Projects list through the bar each of those tabs shows.
// The edit shell keeps the ticks; the project names those two pages and its
// card look (lib/project-content/card-look.ts).
//
// The pages themselves, drawn without the site's navbar and footer (issue
// #495), are in project-edit-pages.tsx.

/**
 * Every part sits on the page's column, its outline round its content; the
 * gallery's carousel runs past the column to the frame's edges, so its
 * outline keeps to the column while the photos pass under its sides.
 */
function shapeOf(record: ProjectRecord, part: ProjectPart): BlockShape {
  const blocks: readonly ProjectBlock[] = record.blocks;
  return blocks.find((b) => blockSection(b.id) === part)?.kind === "gallery" ? "column" : "around";
}

/** Brings the part into view when it becomes the selected one. */
function InView({ when, children }: { when: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (when) ref.current?.scrollIntoView({ block: "nearest" });
  }, [when]);
  return <div ref={ref}>{children}</div>;
}

const PAGE_TARGETS: readonly PageTarget<ProjectPageId>[] = [
  { id: "page", label: "Project page" },
  { id: "home", label: "Home" },
  { id: "list", label: "Projects list" },
];

const CHECK_NOTICE = "This changes how the project looks on Home and the Projects list. Check both tabs before publishing.";

/** Where the confirm bar asks about the card, by tab (board 93e). */
const CHECKED_PLACE: Readonly<Record<ProjectCheckedPage, string>> = { home: "Home", list: "the Projects list" };

/** Each field's error, once a save was refused; fixing a field drops its error. */
function errorsOf(fields: ProjectFields): FieldErrors {
  return Object.fromEntries(fieldProblems(fields).map((p) => [p.field, p.error]));
}


export function ProjectEdit({
  item: opening,
  place,
}: {
  item: ContentItem<ProjectRecord>;
  place: ProjectPlace;
}) {
  const [item, setItem] = useState(opening);
  const opened = editorVersion(item.version);
  const [fields, setFields] = useState<ProjectFields>(() => fieldsOf(opened));
  // A save hands the panel the stored fields; it starts afresh on them.
  const [revision, setRevision] = useState(0);
  const [refusedOnce, setRefusedOnce] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [expanded, setExpanded] = useState<PanelSection[]>([]);
  const [scrollTo, setScrollTo] = useState<PanelScroll | null>(null);
  // The top part whose chip opened the Top of the page row last: outlined strongest while that row is.
  const [topPart, setTopPart] = useState<TopPart>("title");
  const [device, setDevice] = useState<EditDevice>("desktop");
  const [page, setPage] = useState<ProjectPageId>("page");
  const [pending, startTransition] = useTransition();

  const view = projectViewOf(fields, opened);

  // An Edit chip, or a refused save, opens its row alone, as the Edit post panel does.
  const openSection = useCallback((section: PanelSection, part: TopPart | null = null) => {
    setPanelOpen(true);
    setExpanded([section]);
    setScrollTo({ section, part });
  }, []);
  // A part's chip opens its row and brings that part's fields into view.
  const openPart = useCallback(
    (part: ProjectPart) => {
      const top = topPartOf(part);
      if (top !== null) setTopPart(top);
      openSection(sectionOf(part), top);
    },
    [openSection],
  );
  // Add block opens its new block's row beside the open ones.
  const openBeside = useCallback((section: PanelSection) => {
    setExpanded((open) => [...open.filter((s) => s !== section), section]);
    setScrollTo({ section, part: null });
  }, []);

  const save = (step: PublishStep) => {
    const [first] = fieldProblems(fields);
    if (first !== undefined) {
      setRefusedOnce(true);
      openSection(first.section);
      toast.error(first.error);
      return;
    }
    startTransition(async () => {
      const result = await saveProject(item.id, step, fields);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setItem(result.value);
      setFields(fieldsAfterSave(editorVersion(result.value.version), fields));
      setRevision((r) => r + 1);
      setRefusedOnce(false);
      toast.success(step === "publish" ? `${view.name} is published.` : "Draft saved. The published page stays live.");
    });
  };

  const selected = panelOpen ? (outlinedPart(outlinedSection(expanded), topPart) ?? undefined) : undefined;
  const outlined: ProjectFrame = (part, node) => (
    <InView when={part === selected}>
      <EditableBlock id={part} shape={shapeOf(view, part)}>
        {node}
      </EditableBlock>
    </InView>
  );

  return (
    <EditShell
      section={{ label: "Projects", href: "/dashboard/projects" }}
      heading={`Editing ${view.name}`}
      status={statusOf(item.version)}
      saved={panelOpen ? "Changes show on the page as you type" : undefined}
      onSaveDraft={pending ? null : () => save("save-draft")}
      onPublish={pending ? null : () => save("publish")}
      pages={{ targets: PAGE_TARGETS, current: page, onSelect: setPage }}
      check={{
        pages: PROJECT_CHECKED_PAGES,
        look: cardLookOf(view),
        live: liveLookOf(item.version),
        notice: CHECK_NOTICE,
        question: (checked) => `Is the ${view.name} card right on ${CHECKED_PLACE[checked]}?`,
      }}
      blocks={editBlocksOf(view)}
      selected={page === "page" ? selected : undefined}
      onEdit={openPart}
      onDeviceChange={setDevice}
      // Beside the open panel the page keeps its desktop layout, scaled (board 93, issue #526).
      scalesDesktop
      panel={
        panelOpen && (
          <ProjectEditPanel
            key={revision}
            name={view.name}
            kind={view.kind}
            model={projectModelOf(item.version)}
            card={homeCardOf(view, place.position)}
            fields={fields}
            onChange={setFields}
            device={device}
            errors={refusedOnce ? errorsOf(fields) : {}}
            expanded={expanded}
            onExpandedChange={setExpanded}
            onOpen={openBeside}
            scrollTo={scrollTo}
            onClose={() => setPanelOpen(false)}
          />
        )
      }
    >
      {page === "page" ? (
        <EditedProjectPage view={view} position={place.position} frame={outlined} />
      ) : (
        <ProjectCardPage page={page} lineup={lineupWith(place, view)} position={place.position} onEditCard={() => openSection("card")} />
      )}
    </EditShell>
  );
}
