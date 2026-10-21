"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { saveProject } from "@/app/dashboard/project-actions";
import type { ProjectFrame, ProjectPart } from "@/components/project-page/view";
import type { EditBlock, EditBlocks, EditDevice, PageTarget } from "@/lib/content/edit-shell";
import { editorVersion, statusOf, type ContentItem, type PublishStep } from "@/lib/content/versioned";
import {
  blockIdOf,
  blockSection,
  fieldProblems,
  fieldsAfterSave,
  fieldsOf,
  projectViewOf,
  type PanelSection,
  type ProjectFields,
} from "@/lib/project-content/fields";
import { homeCardOf, lineupWith, type ProjectBlock, type ProjectPlace, type ProjectRecord } from "@/lib/project-content/record";
import { EditableBlock, EditShell, type BlockShape } from "./edit-shell";
import { BLOCK_LABELS } from "./project-blocks";
import { EditedProjectPage, ProjectCardPage, type ProjectPageId } from "./project-edit-pages";
import { ProjectEditPanel, type FieldErrors, type PanelView } from "./project-edit-panel";

// A project on its real page under the edit shell (boards 75b, 75c and 93,
// issue #298, epic #522). The page is drawn from the panel's fields, so it
// changes as the editor types; Save draft and Publish on the bar send the
// fields to the projects editor, which checks them again. Save draft leaves
// the published page live. The top of the page and every page block is
// outlined with its Edit chip, which opens its panel; the block whose panel
// is open, or which was picked last in the Page blocks card, is outlined
// strongest and scrolled into view.
//
// The page switch (board 75d, issue #300): the project's own page, then Home
// and the Projects list, each drawn from the fields being edited with the
// project's card in its place among the published ones, outlined with an
// Edit card chip that opens the panel's Card section; the other cards are
// dimmed.
//
// The pages themselves, drawn without the site's navbar and footer (issue
// #495), are in project-edit-pages.tsx.

const HERO: EditBlock<PanelSection> = { name: "Top of the page", section: "top", chip: "Edit top of the page" };

/** Each part of the page by its id: the top, and every block the page draws, its Edit chip opening the block's panel. */
function editBlocksOf(record: ProjectRecord): EditBlocks<ProjectPart, PanelSection> {
  const blocks: readonly ProjectBlock[] = record.blocks;
  const parts = blocks.map((block): [ProjectPart, EditBlock<PanelSection>] => {
    const name = BLOCK_LABELS[block.kind];
    return [`block:${block.id}`, { name, section: blockSection(block.id), chip: `Edit ${name.toLowerCase()}` }];
  });
  return Object.fromEntries([["hero", HERO], ...parts]) as EditBlocks<ProjectPart, PanelSection>;
}

/**
 * The hero and every block but text fill the page's width, so their outlines
 * and chips sit inside them; a text block sits inside the page's column.
 */
function shapeOf(record: ProjectRecord, part: ProjectPart): BlockShape {
  const blocks: readonly ProjectBlock[] = record.blocks;
  const id = part === "hero" ? null : part.slice("block:".length);
  return blocks.find((b) => b.id === id)?.kind === "text" ? "around" : "bleed";
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
  const [scrollTo, setScrollTo] = useState<{ section: PanelSection } | null>(null);
  const [blockView, setBlockView] = useState<PanelView>({ selected: null, open: false });
  const [device, setDevice] = useState<EditDevice>("desktop");
  const [page, setPage] = useState<ProjectPageId>("page");
  const [pending, startTransition] = useTransition();

  const view = projectViewOf(fields, opened);

  const openSection = useCallback((section: PanelSection) => {
    setPanelOpen(true);
    const id = blockIdOf(section);
    if (id !== null) {
      setBlockView({ selected: id, open: true });
      return;
    }
    setBlockView((v) => ({ ...v, open: false }));
    setExpanded([section]);
    setScrollTo({ section });
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

  const selected = panelOpen && blockView.selected !== null ? (`block:${blockView.selected}` as const) : undefined;
  const outlined: ProjectFrame = (part, node) => (
    <InView when={part === selected}>
      {/* On phones the hero leaves only 24px over its first line, so it keeps room there for its chip row. */}
      <EditableBlock id={part} shape={shapeOf(view, part)} className={part === "hero" ? "max-md:pt-6" : ""}>
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
      blocks={editBlocksOf(view)}
      selected={page === "page" ? selected : undefined}
      onEdit={openSection}
      onDeviceChange={setDevice}
      // Beside the open panel the page keeps its desktop layout, scaled (board 93, issue #526).
      scalesDesktop
      panel={
        panelOpen && (
          <ProjectEditPanel
            key={revision}
            name={view.name}
            kind={view.kind}
            card={homeCardOf(view, place.position)}
            fields={fields}
            onChange={setFields}
            device={device}
            errors={refusedOnce ? errorsOf(fields) : {}}
            expanded={expanded}
            onExpandedChange={setExpanded}
            scrollTo={scrollTo}
            block={blockView}
            onBlockChange={setBlockView}
            onClose={() => {
              setPanelOpen(false);
              setBlockView({ selected: null, open: false });
            }}
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
