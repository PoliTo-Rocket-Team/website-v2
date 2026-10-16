"use client";

import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, type LucideIcon } from "lucide-react";
import type { EditDevice } from "@/lib/content/edit-shell";
import {
  FACTS_LIMIT,
  REASONS_LIMIT,
  type CopyFields,
  type FactFields,
  type PanelSection as Section,
  type PartFields,
  type ProjectFields,
  type ReasonFields,
  type StoryFields,
} from "@/lib/project-content/fields";
import { partNumber, twoDigits } from "@/lib/project-pages";
import { CONTENT_FOCUS, TextField, useDragOrder } from "./content-parts";
import { Toggle } from "./controls";
import { EditPanel, ErrorLine, PanelSection, usePanelScroll } from "./edit-panel";

// The Edit <project> panel (board 75c, issue #298): beside the project page
// under the edit shell, one card per section. This slice holds the story
// sections: Top of the page, Name story, Design story, Why and the
// Next-project card. Every change goes straight back to the page, which
// redraws as the editor types. In Phone the fields that have a phone version
// edit it; an empty phone field shows the desktop text.

/** A field's error by its path in the fields ("hero.facts.2.value"). */
export type FieldErrors = Readonly<Record<string, string>>;

type Change = (change: (fields: ProjectFields) => ProjectFields) => void;

export function ProjectEditPanel({
  name,
  kind,
  previousName,
  fields,
  onChange,
  device,
  errors,
  expanded,
  onExpandedChange,
  scrollTo,
  onClose,
}: {
  /** The project's name, as the panel's title says it. */
  name: string;
  kind: "vehicle" | "engine";
  /** The project before this one in the site order, whose page shows the next-project card line. */
  previousName: string;
  fields: ProjectFields;
  onChange: Change;
  device: EditDevice;
  errors: FieldErrors;
  expanded: readonly Section[];
  onExpandedChange: (sections: Section[]) => void;
  /** The section an Edit chip just opened, brought into view; a new object each time. */
  scrollTo: { readonly section: Section } | null;
  onClose: () => void;
}) {
  const card = usePanelScroll(scrollTo);
  const phone = device === "phone";
  const { hero, nameStory, design, reasons } = fields;
  const setHero = (change: Partial<ProjectFields["hero"]>) => onChange((f) => ({ ...f, hero: { ...f.hero, ...change } }));
  const setName = (change: Partial<StoryFields>) => onChange((f) => ({ ...f, nameStory: { ...f.nameStory, ...change } }));
  const setDesign = (change: Partial<ProjectFields["design"]>) => onChange((f) => ({ ...f, design: { ...f.design, ...change } }));
  const setReasons = (change: Partial<ProjectFields["reasons"]>) => onChange((f) => ({ ...f, reasons: { ...f.reasons, ...change } }));

  return (
    <EditPanel
      label={`Edit ${name}`}
      eyebrow="Project page"
      title={`Edit ${name}`}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      onClose={onClose}
    >
      {phone && (
        <p className="rounded-[10px] bg-white-5 px-3.5 py-2.5 text-[12px] leading-relaxed text-text-2">
          Phone view: fields with a phone version edit the phone&apos;s text. Leave one empty to show the desktop text.
        </p>
      )}

      <PanelSection value="top" cardRef={card("top")} title="Top of the page" summary={topSummary(fields)}>
        <CopyField label="Intro" rows={3} copy={hero.intro} phone={phone} error={errors["hero.intro"]} onChange={(intro) => setHero({ intro })} />
        <div className="grid grid-cols-2 gap-2.5">
          <TextField label="Status" value={hero.status} error={errors["hero.status"]} onChange={(status) => setHero({ status })} />
          <TextField label="Dates" value={hero.dates} error={errors["hero.dates"]} onChange={(dates) => setHero({ dates })} />
        </div>
        {hero.caption !== null && (
          <TextField
            label="Visual caption"
            value={hero.caption}
            error={errors["hero.caption"]}
            onChange={(caption) => setHero({ caption })}
          />
        )}
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

      <PanelSection value="name" cardRef={card("name")} title="Name story" summary={`Why it's called ${name}`}>
        <StoryEditor story={nameStory} at="nameStory" phone={phone} errors={errors} onChange={setName} />
      </PanelSection>

      <PanelSection
        value="design"
        cardRef={card("design")}
        title="Design story"
        summary={`The ${kind === "engine" ? "engine" : "rocket"}, part by part`}
      >
        <StoryEditor story={design} at="design" phone={phone} errors={errors} onChange={setDesign} />
        <EditableList
          label="Parts"
          hint="top to bottom, numbered from the bottom"
          items={design.parts}
          limit={{ min: 1, max: 50 }}
          error={errors["design.parts"]}
          blank={() => ({ name: "", desc: "", phone: "" })}
          rowName={(i) => `part ${i + 1}`}
          rowLabel={(i, n) => partNumber(i, n)}
          addLabel="Add part"
          onChange={(parts) => setDesign({ parts })}
          row={(part: PartFields, i, update) => (
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2.5">
              <TextField label="Name" value={part.name} error={errors[`design.parts.${i}.name`]} onChange={(v) => update({ ...part, name: v })} />
              {phone ? (
                <TextField
                  label="Phone description"
                  value={part.phone}
                  error={errors[`design.parts.${i}.phone`]}
                  onChange={(v) => update({ ...part, phone: v })}
                />
              ) : (
                <TextField label="Description" value={part.desc} error={errors[`design.parts.${i}.desc`]} onChange={(v) => update({ ...part, desc: v })} />
              )}
            </div>
          )}
        />
        <TextField
          label="Note under the parts"
          value={design.partsCaption}
          error={errors["design.partsCaption"]}
          onChange={(partsCaption) => setDesign({ partsCaption })}
        />
      </PanelSection>

      <PanelSection
        value="reasons"
        cardRef={card("reasons")}
        title="Why"
        summary={reasons.shown ? `${reasons.items.length} numbered ${reasons.items.length === 1 ? "reason" : "reasons"}` : "Not on the page"}
        control={<Toggle label="Show Why on the page" checked={reasons.shown} onCheckedChange={(shown) => setReasons({ shown })} />}
      >
        {!reasons.shown && <p className="text-[12px] text-prt-muted">Off the page. Switch it on to show it; the text here is kept.</p>}
        <TextField
          label="Eyebrow"
          hint="after the section number"
          placeholder="WHY LIQUID"
          value={reasons.eyebrow}
          error={errors["reasons.eyebrow"]}
          onChange={(eyebrow) => setReasons({ eyebrow })}
        />
        <TextField
          label="Title"
          hint="a new line breaks it"
          rows={2}
          value={reasons.title}
          error={errors["reasons.title"]}
          onChange={(title) => setReasons({ title })}
        />
        <EditableList
          label="Reasons"
          hint={`${REASONS_LIMIT.min} to ${REASONS_LIMIT.max}`}
          items={reasons.items}
          limit={REASONS_LIMIT}
          error={errors["reasons.items"]}
          blank={() => ({ title: "", text: "" })}
          rowName={(i) => `reason ${i + 1}`}
          rowLabel={(i) => twoDigits(i + 1)}
          addLabel="Add reason"
          onChange={(items) => setReasons({ items })}
          row={(reason: ReasonFields, i, update) => (
            <>
              <TextField
                label="Title"
                value={reason.title}
                error={errors[`reasons.items.${i}.title`]}
                onChange={(title) => update({ ...reason, title })}
              />
              <TextField
                label="Text"
                rows={3}
                value={reason.text}
                error={errors[`reasons.items.${i}.text`]}
                onChange={(text) => update({ ...reason, text })}
              />
            </>
          )}
        />
      </PanelSection>

      <PanelSection value="teaser" cardRef={card("teaser")} title="Next-project card" summary={`The line on ${previousName}'s page`}>
        <TextField
          label="Card line"
          hint={`on ${previousName}'s page, under NEXT PROJECT`}
          rows={2}
          value={fields.teaser}
          error={errors.teaser}
          onChange={(teaser) => onChange((f) => ({ ...f, teaser }))}
        />
      </PanelSection>
    </EditPanel>
  );
}

function topSummary(fields: ProjectFields): string {
  const n = fields.hero.facts.length;
  return `Intro, status, dates, ${n} key ${n === 1 ? "fact" : "facts"}`;
}

/** A text with a phone version: Desktop edits the text, Phone the phone's, which shows the text while empty. */
function CopyField({
  label,
  copy,
  phone,
  rows,
  error,
  onChange,
}: {
  label: string;
  copy: CopyFields;
  phone: boolean;
  rows?: number;
  error?: string;
  onChange: (copy: CopyFields) => void;
}) {
  if (!phone) return <TextField label={label} rows={rows} value={copy.text} error={error} onChange={(text) => onChange({ ...copy, text })} />;
  return (
    <TextField
      label={label}
      hint="phone"
      rows={rows}
      value={copy.phone}
      placeholder={copy.text}
      error={error}
      onChange={(p) => onChange({ ...copy, phone: p })}
    />
  );
}

/** A story column's title and text: desktop paragraphs in Desktop, the phone's one paragraph in Phone. */
function StoryEditor({
  story,
  at,
  phone,
  errors,
  onChange,
}: {
  story: StoryFields;
  /** Where the story sits in the fields, for its errors. */
  at: "nameStory" | "design";
  phone: boolean;
  errors: FieldErrors;
  onChange: (change: Partial<StoryFields>) => void;
}) {
  return (
    <>
      <TextField label="Title" hint="a new line breaks it" rows={2} value={story.title} error={errors[`${at}.title`]} onChange={(title) => onChange({ title })} />
      {phone ? (
        <TextField label="Text" hint="phone, one paragraph" rows={4} value={story.phone} error={errors[`${at}.phone`]} onChange={(p) => onChange({ phone: p })} />
      ) : (
        <TextField
          label="Text"
          hint="a blank line between paragraphs"
          rows={6}
          value={story.body}
          error={errors[`${at}.body`]}
          onChange={(body) => onChange({ body })}
        />
      )}
    </>
  );
}

/**
 * A list of rows the editor adds to, removes from and reorders: drag a row by
 * its grip, or use its Move up and Move down buttons from the keyboard. A
 * list at its least keeps its rows: Remove is off. Each
 * row keeps one key while it moves, so a field being typed in stays itself.
 */
function EditableList<T>({
  label,
  hint,
  items,
  limit,
  error,
  blank,
  rowName,
  rowLabel = (i) => twoDigits(i + 1),
  addLabel,
  onChange,
  row,
}: {
  label: string;
  hint?: string;
  items: readonly T[];
  limit: { readonly min: number; readonly max: number };
  error?: string;
  blank: () => T;
  rowName: (index: number) => string;
  rowLabel?: (index: number, count: number) => string;
  addLabel: string;
  onChange: (items: T[]) => void;
  row: (item: T, index: number, update: (item: T) => void) => ReactNode;
}) {
  const [keys, setKeys] = useState(() => items.map((_, i) => i));
  const nextKey = useRef(items.length);
  // A save hands back fresh fields of another length: start the keys afresh.
  const rowKeys = keys.length === items.length ? keys : items.map((_, i) => i);
  const itemOf = new Map(rowKeys.map((key, i) => [key, items[i]]));

  const reorder = (order: readonly number[]) => {
    setKeys([...order]);
    onChange(order.map((key) => itemOf.get(key)!));
  };
  const drag = useDragOrder(rowKeys, reorder);
  const move = (key: number, by: -1 | 1) => {
    const at = rowKeys.indexOf(key);
    const order = [...rowKeys];
    [order[at], order[at + by]] = [order[at + by], order[at]];
    reorder(order);
  };
  const remove = (key: number) => {
    setKeys(rowKeys.filter((k) => k !== key));
    onChange(items.filter((_, i) => rowKeys[i] !== key));
  };
  const add = () => {
    setKeys([...rowKeys, nextKey.current++]);
    onChange([...items, blank()]);
  };
  const shown = drag.order;

  return (
    <div>
      <p className="mb-2 text-[13px] leading-snug text-prt-text">
        {label}
        {hint && <span className="ml-1.5 text-prt-muted">{hint}</span>}
      </p>
      <ol className="space-y-2" {...drag.list}>
        {shown.map((key, index) => {
          const item = itemOf.get(key)!;
          const at = rowKeys.indexOf(key);
          const r = drag.row(key, index);
          const canRemove = items.length > limit.min;
          return (
            <li
              key={key}
              onDragOver={r.onDragOver}
              className={`rounded-[10px] border border-hairline bg-white-5 p-3 transition-colors duration-300 ease-out hover:border-border-strong ${r.dragged ? "opacity-50" : ""}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  draggable
                  onDragStart={r.onDragStart}
                  onDragEnd={r.onDragEnd}
                  aria-hidden
                  className="cursor-grab text-dim"
                >
                  <GripVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
                <span className="flex-1 font-mono text-[10px] tracking-[0.2em] text-dim">{rowLabel(index, shown.length)}</span>
                <RowButton icon={ArrowUp} label={`Move ${rowName(index)} up`} onClick={index > 0 ? () => move(key, -1) : null} />
                <RowButton icon={ArrowDown} label={`Move ${rowName(index)} down`} onClick={index < shown.length - 1 ? () => move(key, 1) : null} />
                <RowButton icon={Trash2} label={`Remove ${rowName(index)}`} onClick={canRemove ? () => remove(key) : null} />
              </div>
              <div className="space-y-2.5">{row(item, at, (next) => onChange(items.map((x, i) => (i === at ? next : x))))}</div>
            </li>
          );
        })}
      </ol>
      <ErrorLine error={error} />
      {items.length < limit.max && (
        <button
          type="button"
          onClick={add}
          className={`mt-2.5 inline-flex items-center gap-1.5 rounded-md text-[13px] text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${CONTENT_FOCUS}`}
        >
          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {addLabel}
        </button>
      )}
    </div>
  );
}

function RowButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: (() => void) | null }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={onClick === null}
      onClick={() => onClick?.()}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text disabled:pointer-events-none disabled:opacity-30 ${CONTENT_FOCUS}`}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  );
}
