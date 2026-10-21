"use client";

import { useEffect, useMemo, useRef } from "react";
import { discardProjectPhoto, uploadProjectPhoto } from "@/app/dashboard/project-actions";
import type { EditDevice } from "@/lib/content/edit-shell";
import type { BlockFields } from "@/lib/project-content/block-fields";
import { addBlock, duplicateBlock, lastBlockId, moveBlock, removeBlock, reorderBlocks, setBlockHidden } from "@/lib/project-content/block-list";
import { FACTS_LIMIT, heldPhotos, type FactFields, type PanelSection as Section, type ProjectFields } from "@/lib/project-content/fields";
import type { HomeCardView } from "@/lib/project-content/record";
import { TextField } from "./content-parts";
import { EditPanel, PanelSection, usePanelScroll } from "./edit-panel";
import type { PhotoUploads } from "./outreach-post-photos";
import { BlockPanel, BlocksList, errorsIn, kindsFor, type BlockActions } from "./project-blocks";
import { CardEditor, cardSummary } from "./project-card-section";
import { CopyField, EditableList, type FieldErrors } from "./project-panel-parts";
import { BackgroundPicker, TopVisualEditor } from "./project-top-section";

// The Edit <project> panel (boards 75c, 93 and 93d, issues #298 and #299, epic
// #522): beside the project page under the edit shell, the Top of the page
// card (its visual, caption and background first, ./project-top-section.tsx),
// the Page blocks card (./project-blocks.tsx) and the Card (issue
// #300), which the Edit card chip on Home and the Projects list opens. A
// block's row, or its Edit chip on the page, opens the block's own panel in
// the cards' place. Every change goes straight back to the page, which
// redraws as the editor types. In Phone the fields that have a phone version
// edit it; an empty phone field shows the desktop text.

export type { FieldErrors };

/** Where the panel stands about blocks: the one outlined on the page, and whether its panel is open in the cards' place. */
export type PanelView = { readonly selected: string | null; readonly open: boolean };

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
  const { hero, blocks } = fields;
  const setHero = (change: Partial<ProjectFields["hero"]>) => onChange((f) => ({ ...f, hero: { ...f.hero, ...change } }));
  const setBlocks = (change: (blocks: readonly BlockFields[]) => readonly BlockFields[]) => onChange((f) => ({ ...f, blocks: change(f.blocks) }));

  const select = (id: string | null, open: boolean) => onBlockChange({ selected: id, open });
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
        if (blockView.selected === id) {
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
    if (id !== undefined && next !== blocks) select(id, true);
  };

  const openIndex = blockView.open ? blocks.findIndex((b) => b.id === blockView.selected) : -1;
  const open = openIndex === -1 ? null : blocks[openIndex];
  const blocked = new Set(blocks.filter((b) => Object.keys(errorsIn(errors, b.id)).length > 0).map((b) => b.id));

  return (
    <EditPanel label={`Edit ${name}`} eyebrow="Project page" title={`Edit ${name}`} expanded={expanded} onExpandedChange={onExpandedChange} onClose={onClose}>
      {phone && (
        <p className="rounded-[10px] bg-white-5 px-3.5 py-2.5 text-[12px] leading-relaxed text-text-2">
          Phone view: fields with a phone version edit the phone&apos;s text. Leave one empty to show the desktop text.
        </p>
      )}

      {open !== null ? (
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
          <PanelSection value="top" cardRef={card("top")} title="Top of the page" summary={topSummary(fields)}>
            <TopVisualEditor
              kind={kind}
              visual={hero.visual}
              caption={hero.caption}
              errors={errors}
              uploads={uploads}
              onVisualChange={(change) => onChange((f) => ({ ...f, hero: { ...f.hero, visual: change(f.hero.visual) } }))}
              onCaptionChange={(caption) => setHero({ caption })}
            />
            <BackgroundPicker background={fields.background} onChange={(background) => onChange((f) => ({ ...f, background }))} />
            <CopyField label="Intro" rows={3} copy={hero.intro} phone={phone} error={errors["hero.intro"]} onChange={(intro) => setHero({ intro })} />
            <div className="grid grid-cols-2 gap-2.5">
              <TextField label="Status" value={hero.status} error={errors["hero.status"]} onChange={(status) => setHero({ status })} />
              <TextField label="Dates" value={hero.dates} error={errors["hero.dates"]} onChange={(dates) => setHero({ dates })} />
            </div>
            <EditableList
              label="Key facts"
              hint={`${FACTS_LIMIT.min} to ${FACTS_LIMIT.max}`}
              items={hero.facts}
              limit={FACTS_LIMIT}
              error={errors["hero.facts"]}
              blank={() => ({ value: "", label: { text: "", phone: "" } })}
              rowName={(i) => `key fact ${i + 1}`}
              addLabel="Add key fact"
              onChange={(facts) => setHero({ facts })}
              row={(fact: FactFields, i, update) => (
                <div className="grid grid-cols-2 gap-2.5">
                  <TextField label="Value" value={fact.value} error={errors[`hero.facts.${i}.value`]} onChange={(value) => update({ ...fact, value })} />
                  <CopyField
                    label="Label"
                    copy={fact.label}
                    phone={phone}
                    error={errors[`hero.facts.${i}.label`]}
                    onChange={(label) => update({ ...fact, label })}
                  />
                </div>
              )}
            />
          </PanelSection>

          <PanelSection value="blocks" cardRef={card("blocks")} title="Page blocks" summary={blocksSummary(blocks)}>
            <BlocksList
              blocks={blocks}
              kinds={kindsFor(kind)}
              selected={blockView.selected}
              blocked={blocked}
              actionsOf={actionsOf}
              onOpen={(id) => select(id, true)}
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

const VISUAL_SUMMARY: Readonly<Record<ProjectFields["hero"]["visual"]["kind"], string>> = { model: "3D model", photo: "Photo", none: "No visual" };

function topSummary(fields: ProjectFields): string {
  const n = fields.hero.facts.length;
  return `${VISUAL_SUMMARY[fields.hero.visual.kind]}, background, intro, ${n} key ${n === 1 ? "fact" : "facts"}`;
}

function blocksSummary(blocks: readonly BlockFields[]): string {
  const hidden = blocks.filter((b) => b.hidden).length;
  const n = `${blocks.length} ${blocks.length === 1 ? "block" : "blocks"}`;
  return hidden === 0 ? n : `${n} · ${hidden} hidden`;
}
