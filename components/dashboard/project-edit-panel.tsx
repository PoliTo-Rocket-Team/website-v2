"use client";

import { Fragment, useEffect, useMemo, useRef, type ReactNode } from "react";
import { discardProjectPhoto, uploadProjectPhoto } from "@/app/dashboard/project-actions";
import type { EditDevice } from "@/lib/content/edit-shell";
import type { BlockFields } from "@/lib/project-content/block-fields";
import { addBlock, duplicateBlock, lastBlockId, moveBlock, removeBlock, reorderBlocks, setBlockHidden } from "@/lib/project-content/block-list";
import { blockIdOf, blockSection, heldPhotos, panelSections, type PanelSection as Section, type ProjectFields } from "@/lib/project-content/fields";
import type { HomeCardView } from "@/lib/project-content/record";
import type { TopPart } from "@/lib/project-pages";
import type { RocketModel } from "@/lib/rocket-model";
import { EditPanel, PanelSection, usePanelScroll } from "./edit-panel";
import type { PhotoUploads } from "./outreach-post-photos";
import { useDragOrder } from "./content-parts";
import { BlockListEnd, BlockRow, kindsFor, versionNamesOf, type BlockActions } from "./project-blocks";
import { CardEditor, cardSummary } from "./project-card-section";
import type { FieldErrors } from "./project-panel-parts";
import { TopSection } from "./project-top-section";

// The Edit <project> panel (boards 75c, 93, 93c and 93d, issues #298 and
// #299, epics #522 and #614): beside the project page under the edit shell,
// every part of the page is a row, as the Edit post panel's sections are: the
// Top of the page (./project-top-section.tsx), one row per page block in page
// order (./project-blocks.tsx), and the Card (issue #300), which the Edit card
// chip on Home and the Projects list opens. Any of them may be open at once,
// each where it sits, and an Edit chip on the page opens its row. Every
// change goes straight back to the page, which redraws as the editor types.
// In Phone the fields that have a phone version edit it; an empty phone field
// shows the desktop text.

export type { FieldErrors };

/**
 * The row an Edit chip just opened, brought into view; a new object each
 * time. A chip on one of the top's three parts names it, and the Top of the
 * page row scrolls to that part's fields.
 */
export type PanelScroll = { readonly section: Section; readonly part: TopPart | null };

/** What the panel scrolls to: a row's card, or one top part's fields in the Top of the page row. */
type ScrollKey = Section | `top:${TopPart}`;

type Change = (change: (fields: ProjectFields) => ProjectFields) => void;

/**
 * Photo uploads that never let go of a file another block still holds, as a
 * duplicated block's photos are: `held` is the fields as last drawn, so a
 * removed photo counts there once, and twice while a copy holds it too.
 */
function useHeldUploads(fields: ProjectFields): PhotoUploads {
  const held = useRef(fields);
  useEffect(() => {
    held.current = fields;
  });
  return useMemo(
    () => ({
      upload: uploadProjectPhoto,
      discard: async (src: string) => {
        if (heldPhotos(held.current).filter((s) => s === src).length > 1) return;
        return discardProjectPhoto(src);
      },
    }),
    [],
  );
}

export function ProjectEditPanel({
  name,
  kind,
  model,
  card: homeCard,
  fields,
  onChange,
  device,
  errors,
  expanded,
  onExpandedChange,
  onOpen,
  scrollTo,
  onClose,
}: {
  /** The project's name, as the panel's title says it. */
  name: string;
  kind: "vehicle" | "engine";
  /** The model the top's Rocket field opens on (`projectModelOf`). */
  model: RocketModel;
  /** The project's card as Home draws it now, for the Card section's number and counted pill. */
  card: HomeCardView;
  fields: ProjectFields;
  onChange: Change;
  device: EditDevice;
  errors: FieldErrors;
  expanded: readonly Section[];
  onExpandedChange: (sections: Section[]) => void;
  /** Opens a row beside the open ones and brings it into view, as Add block does with its new block's row. */
  onOpen: (section: Section) => void;
  scrollTo: PanelScroll | null;
  onClose: () => void;
}) {
  const target = useMemo(
    () => scrollTo && { section: scrollTo.part === null ? scrollTo.section : (`top:${scrollTo.part}` as ScrollKey) },
    [scrollTo],
  );
  const card = usePanelScroll<ScrollKey>(target);
  const uploads = useHeldUploads(fields);
  const phone = device === "phone";
  const { blocks } = fields;
  const setBlocks = (change: (blocks: readonly BlockFields[]) => readonly BlockFields[]) => onChange((f) => ({ ...f, blocks: change(f.blocks) }));

  const actionsOf = (id: string): BlockActions => {
    const index = blocks.findIndex((b) => b.id === id);
    return {
      onDuplicate: () => setBlocks((list) => duplicateBlock(list, id)),
      onToggleHidden: () => setBlocks((list) => setBlockHidden(list, id, !blocks[index]?.hidden)),
      onUp: index > 0 ? () => setBlocks((list) => moveBlock(list, id, -1)) : null,
      onDown: index < blocks.length - 1 ? () => setBlocks((list) => moveBlock(list, id, 1)) : null,
      onRemove: () => {
        const { blocks: left, letGo } = removeBlock(blocks, id);
        setBlocks(() => left);
        // The server keeps a file while a stored version of a project shows it.
        for (const src of letGo) void discardProjectPhoto(src);
        onExpandedChange(expanded.filter((s) => s !== blockSection(id)));
      },
    };
  };
  const add = (k: BlockFields["kind"]) => {
    const next = addBlock(blocks, k);
    setBlocks(() => next);
    const id = lastBlockId(next);
    if (id !== undefined && next !== blocks) onOpen(blockSection(id));
  };

  // The rows are drawn in `panelSections` order. Only the block rows take a
  // grip and a drop, so a dragged block moves among the blocks and the top
  // stays first and the card last.
  const blockOf = new Map(blocks.map((b) => [b.id, b]));
  const drag = useDragOrder(panelSections(fields), (order) =>
    setBlocks((list) => reorderBlocks(list, order.flatMap((section) => blockIdOf(section) ?? []))),
  );
  const versionNames = versionNamesOf(blocks);

  const rowOf = (section: Section, index: number): ReactNode => {
    if (section === "top") {
      return (
        <TopSection
          key={section}
          fields={fields}
          kind={kind}
          model={model}
          phone={phone}
          errors={errors}
          uploads={uploads}
          cardRef={card(section)}
          partRef={(part) => card(`top:${part}`)}
          onChange={onChange}
        />
      );
    }
    if (section === "card") {
      // The block rows end where the card begins: Add block sits under the last block.
      return (
        <Fragment key={section}>
          <BlockListEnd count={blocks.length} kinds={kindsFor(kind)} onAdd={add} />
          <PanelSection value={section} cardRef={card(section)} title="Card" summary={cardSummary(homeCard)}>
            <CardEditor
              card={fields.card}
              shown={homeCard}
              kind={kind}
              phone={phone}
              errors={errors}
              onChange={(change) => onChange((f) => ({ ...f, card: { ...f.card, ...change } }))}
            />
          </PanelSection>
        </Fragment>
      );
    }
    const id = blockIdOf(section);
    const block = blockOf.get(id);
    if (block === undefined) return null;
    return (
      <BlockRow
        key={section}
        block={block}
        section={section}
        // The top of the page is row 0, so the first block is 1.
        number={index}
        phone={phone}
        errors={errors}
        versionNames={versionNames}
        uploads={uploads}
        cardRef={card(section)}
        drag={drag.row(section, index)}
        actions={actionsOf(id)}
        onChange={(change) => setBlocks((list) => list.map((b) => (b.id === id ? change(b) : b)))}
      />
    );
  };

  return (
    <EditPanel label={`Edit ${name}`} eyebrow="Project page" title={`Edit ${name}`} expanded={expanded} onExpandedChange={onExpandedChange} onClose={onClose}>
      {phone && (
        <p className="rounded-[10px] bg-white-5 px-3.5 py-2.5 text-[12px] leading-relaxed text-text-2">
          Phone view: fields with a phone version edit the phone&apos;s text. Leave one empty to show the desktop text.
        </p>
      )}
      <div className="space-y-3" {...drag.list}>
        {drag.order.map(rowOf)}
      </div>
    </EditPanel>
  );
}
