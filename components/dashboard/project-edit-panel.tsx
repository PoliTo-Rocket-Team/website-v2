"use client";

import { useEffect, useMemo, useRef } from "react";
import { discardProjectPhoto, uploadProjectPhoto } from "@/app/dashboard/project-actions";
import type { EditDevice } from "@/lib/content/edit-shell";
import type { BlockFields } from "@/lib/project-content/block-fields";
import { addBlock, duplicateBlock, lastBlockId, moveBlock, removeBlock, reorderBlocks, setBlockHidden } from "@/lib/project-content/block-list";
import {
  blockIdOf,
  blockSection,
  heldPhotos,
  type PanelSection as Section,
  type PlacedSection,
  type ProjectFields,
} from "@/lib/project-content/fields";
import type { HomeCardView } from "@/lib/project-content/record";
import type { RocketModel } from "@/lib/rocket-model";
import { EditPanel, PanelSection, usePanelScroll } from "./edit-panel";
import type { PhotoUploads } from "./outreach-post-photos";
import { BlockPanel, BlocksList, errorsIn, kindsFor, type BlockActions } from "./project-blocks";
import { CardEditor, cardSummary } from "./project-card-section";
import type { FieldErrors } from "./project-panel-parts";
import { TopCard, TopPanel } from "./project-top-section";

// The Edit <project> panel (boards 75c, 93, 93c and 93d, issues #298 and
// #299, epic #522): beside the project page under the edit shell, the Top of
// the page card (./project-top-section.tsx), the Page blocks card
// (./project-blocks.tsx) and the Card (issue #300), which the Edit card chip
// on Home and the Projects list opens. The Top of the page card, a block's
// row, or either's Edit chip on the page opens that panel in the cards'
// place, with "Page blocks" to go back. Every change goes straight back to
// the page, which redraws as the editor types. In Phone the fields that have
// a phone version edit it; an empty phone field shows the desktop text.

export type { FieldErrors };

/** What the panel picked: the top of the page or one block, outlined on the page, and whether its panel is open in the cards' place. */
export type PanelView = { readonly selected: PlacedSection | null; readonly open: boolean };

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
  scrollTo,
  block: blockView,
  onBlockChange,
  onClose,
}: {
  /** The project's name, as the panel's title says it. */
  name: string;
  kind: "vehicle" | "engine";
  /** The model the top's 3D model draws (`projectModelOf`). */
  model: RocketModel;
  /** The project's card as Home draws it now, for the Card section's number and counted pill. */
  card: HomeCardView;
  fields: ProjectFields;
  onChange: Change;
  device: EditDevice;
  errors: FieldErrors;
  expanded: readonly Section[];
  onExpandedChange: (sections: Section[]) => void;
  /** The section an Edit chip just opened, brought into view; a new object each time. */
  scrollTo: { readonly section: Section } | null;
  block: PanelView;
  onBlockChange: (view: PanelView) => void;
  onClose: () => void;
}) {
  const card = usePanelScroll(scrollTo);
  const uploads = useHeldUploads(fields);
  const phone = device === "phone";
  const { blocks } = fields;
  const setBlocks = (change: (blocks: readonly BlockFields[]) => readonly BlockFields[]) => onChange((f) => ({ ...f, blocks: change(f.blocks) }));

  const select = (section: PlacedSection | null, open: boolean) => onBlockChange({ selected: section, open });
  const backToList = () => {
    select(blockView.selected, false);
    if (!expanded.includes("blocks")) onExpandedChange([...expanded, "blocks"]);
  };
  const actionsOf = (id: string, index: number): BlockActions => {
    const target = blocks.find((b) => b.id === id);
    return {
      onDuplicate: () => setBlocks((list) => duplicateBlock(list, id)),
      onToggleHidden: () => setBlocks((list) => setBlockHidden(list, id, !target?.hidden)),
      onUp: index > 0 ? () => setBlocks((list) => moveBlock(list, id, -1)) : null,
      onDown: index < blocks.length - 1 ? () => setBlocks((list) => moveBlock(list, id, 1)) : null,
      onRemove: () => {
        const { blocks: left, letGo } = removeBlock(blocks, id);
        setBlocks(() => left);
        // The server keeps a file while a stored version of a project shows it.
        for (const src of letGo) void discardProjectPhoto(src);
        if (blockView.selected === blockSection(id)) {
          select(null, false);
          if (!expanded.includes("blocks")) onExpandedChange([...expanded, "blocks"]);
        }
      },
    };
  };
  const add = (k: BlockFields["kind"]) => {
    const next = addBlock(blocks, k);
    setBlocks(() => next);
    const id = lastBlockId(next);
    if (id !== undefined && next !== blocks) select(blockSection(id), true);
  };

  const topOpen = blockView.open && blockView.selected === "top";
  const openId = blockView.open && blockView.selected !== null ? blockIdOf(blockView.selected) : null;
  const openIndex = openId === null ? -1 : blocks.findIndex((b) => b.id === openId);
  const open = openIndex === -1 ? null : blocks[openIndex];
  const blocked = new Set(blocks.filter((b) => Object.keys(errorsIn(errors, b.id)).length > 0).map((b) => b.id));

  return (
    <EditPanel label={`Edit ${name}`} eyebrow="Project page" title={`Edit ${name}`} expanded={expanded} onExpandedChange={onExpandedChange} onClose={onClose}>
      {phone && (
        <p className="rounded-[10px] bg-white-5 px-3.5 py-2.5 text-[12px] leading-relaxed text-text-2">
          Phone view: fields with a phone version edit the phone&apos;s text. Leave one empty to show the desktop text.
        </p>
      )}

      {topOpen ? (
        <TopPanel fields={fields} model={model} phone={phone} errors={errors} uploads={uploads} onChange={onChange} onBack={backToList} />
      ) : open !== null ? (
        <BlockPanel
          key={open.id}
          block={open}
          index={openIndex}
          phone={phone}
          errors={errorsIn(errors, open.id)}
          versionNames={blocks.flatMap((b) => (b.kind === "versions" ? b.items.map((v) => v.pill.trim()).filter((pill) => pill !== "") : []))}
          uploads={uploads}
          actions={actionsOf(open.id, openIndex)}
          onChange={(change) => setBlocks((list) => list.map((b) => (b.id === open.id ? change(b) : b)))}
          onBack={backToList}
        />
      ) : (
        <>
          <TopCard fields={fields} onOpen={() => select("top", true)} />

          <PanelSection value="blocks" cardRef={card("blocks")} title="Page blocks" summary={blocksSummary(blocks)}>
            <BlocksList
              blocks={blocks}
              kinds={kindsFor(kind)}
              selected={blockView.selected === null ? null : blockIdOf(blockView.selected)}
              blocked={blocked}
              actionsOf={actionsOf}
              onOpen={(id) => select(blockSection(id), true)}
              onReorder={(ids) => setBlocks((list) => reorderBlocks(list, ids))}
              onAdd={add}
            />
          </PanelSection>

          <PanelSection value="card" cardRef={card("card")} title="Card" summary={cardSummary(homeCard)}>
            <CardEditor
              card={fields.card}
              shown={homeCard}
              kind={kind}
              phone={phone}
              errors={errors}
              onChange={(change) => onChange((f) => ({ ...f, card: { ...f.card, ...change } }))}
            />
          </PanelSection>
        </>
      )}
    </EditPanel>
  );
}

function blocksSummary(blocks: readonly BlockFields[]): string {
  const hidden = blocks.filter((b) => b.hidden).length;
  const n = `${blocks.length} ${blocks.length === 1 ? "block" : "blocks"}`;
  return hidden === 0 ? n : `${n} · ${hidden} hidden`;
}
