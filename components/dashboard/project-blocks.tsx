"use client";

import { useId } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Images,
  List,
  ListOrdered,
  MoreHorizontal,
  Plus,
  Rocket,
  Signpost,
  Table2,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  BLOCK_KINDS,
  KEY_FACTS_LIMIT,
  POINTS_LIMIT,
  type BlockFields,
  type BlockFieldsOf,
  type FactFields,
  type PartFields,
  type ReasonFields,
} from "@/lib/project-content/block-fields";
import { BLOCKS_MAX } from "@/lib/project-content/block-list";
import { blockSection, type BlockSection } from "@/lib/project-content/fields";
import { partNumber, twoDigits, type BlockKind, type TextWidth } from "@/lib/project-pages";
import { CONTENT_FOCUS, TextField, useDragOrder } from "./content-parts";
import { ErrorLine, PanelSection } from "./edit-panel";
import { PhotosSection, type PhotoUploads } from "./outreach-post-photos";
import { GalleryEditor, LaunchesEditor, PlanEditor, VersionsEditor } from "./project-list-sections";
import { CopyField, EditableList, type FieldErrors } from "./project-panel-parts";

// The page blocks' rows of the Edit <project> panel (boards 93, 93b and 93c,
// epics #522 and #614): a row per block in page order with its grip, its kind
// and a one-line summary, and a ⋯ menu to duplicate, hide, move or remove it;
// "+ Add block" opens the menu of the eight kinds. A row opens the block's
// fields where it sits, beside any other open row, and while it is the row
// opened last the block is outlined on the page.
// The list blocks' fields are in ./project-list-sections.tsx; the rules every
// edit keeps are in lib/project-content/block-fields.ts and block-list.ts.

export const BLOCK_LABELS: Readonly<Record<BlockKind, string>> = {
  text: "Text",
  facts: "Key facts",
  photo: "Photo",
  gallery: "Gallery",
  versions: "Versions",
  launches: "Launch history",
  timeline: "Timeline",
  points: "Numbered points",
};

/** The Add block menu's line under each kind (board 93b). */
const BLOCK_HINTS: Readonly<Record<BlockKind, string>> = {
  text: "Paragraphs with an optional heading",
  facts: `Big numbers with a label, ${KEY_FACTS_LIMIT.min} to ${KEY_FACTS_LIMIT.max}`,
  photo: "One wide photo with a caption",
  gallery: "A swipeable row of photos",
  versions: "A specs table, one column per version",
  launches: "One card per flight: date, place, outcome, numbers",
  timeline: "Done, now, next and later steps",
  points: `A title and ${POINTS_LIMIT.min} to ${POINTS_LIMIT.max} numbered points`,
};

const BLOCK_ICONS: Readonly<Record<BlockKind, LucideIcon>> = {
  text: Type,
  facts: List,
  photo: ImageIcon,
  gallery: Images,
  versions: Table2,
  launches: Rocket,
  timeline: Signpost,
  points: ListOrdered,
};

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const named = (names: readonly string[]) => names.map((n) => n.trim()).filter((n) => n !== "");
/** "THE NAME" as a summary says it: "The name". */
const sentence = (label: string) => label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();

/** The row's one line: what the block holds, as board 93's rows say it. */
export function blockSummary(block: BlockFields): string {
  switch (block.kind) {
    case "text": {
      const first = block.paragraphs.find((p) => p.trim() !== "")?.trim() ?? "";
      const label = block.label.trim();
      if (label !== "" && block.heading.trim() !== "") return `${sentence(label)}: ${first || block.heading.trim()}`;
      return block.heading.trim() || first || "Empty: click to write";
    }
    case "facts":
      return named(block.facts.map((f) => f.value)).join(" · ") || count(block.facts.length, "number");
    case "photo":
      return block.caption.trim() || (block.photo === null ? "No photo yet" : "One photo");
    case "gallery":
      return count(block.items.filter((i) => i.src !== null).length, "photo");
    case "versions":
      return `${named(block.items.map((v) => v.pill)).join(", ") || "No versions yet"} · specs table`;
    case "launches":
      return named(block.items.map((l) => l.title)).join(", ") || count(block.items.length, "launch", "launches");
    case "timeline":
      return [block.title.trim().split("\n")[0], count(block.steps.length, "step")].filter(Boolean).join(" · ");
    case "points":
      return [block.title.trim().split("\n")[0], count(block.items.length, "point")].filter(Boolean).join(" · ");
  }
}

const MENU_CONTENT =
  "z-50 rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0";
const MENU_ITEM =
  "flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-text-2 outline-none transition-colors data-[disabled]:cursor-default data-[disabled]:opacity-40 data-[highlighted]:bg-white-5 data-[highlighted]:text-prt-text";

/** What a block's ⋯ menu does. A null move is one the block cannot make: it is first, or last. */
export type BlockActions = {
  readonly onDuplicate: (() => void) | null;
  readonly onToggleHidden: () => void;
  readonly onUp: (() => void) | null;
  readonly onDown: (() => void) | null;
  readonly onRemove: () => void;
};

/** A block's ⋯ menu: Duplicate, Hide or Show, Move up and Move down (the keyboard's way to reorder), Remove. */
function BlockMenu({ name, hidden, actions }: { name: string; hidden: boolean; actions: BlockActions }) {
  const item = (icon: LucideIcon, label: string, onSelect: (() => void) | null, danger = false) => {
    const Icon = icon;
    return (
      <DropdownMenuPrimitive.Item
        disabled={onSelect === null}
        onSelect={() => onSelect?.()}
        className={`${MENU_ITEM} ${danger ? "text-danger data-[highlighted]:text-danger" : ""}`}
      >
        <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        {label}
      </DropdownMenuPrimitive.Item>
    );
  };
  return (
    <span onClick={(e) => e.stopPropagation()} className="shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`More for ${name}`}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text data-[state=open]:bg-white-5 ${CONTENT_FOCUS}`}
        >
          <MoreHorizontal aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuPrimitive.Content align="end" sideOffset={6} className={`${MENU_CONTENT} min-w-[180px]`}>
            {item(Copy, "Duplicate", actions.onDuplicate)}
            {item(hidden ? Eye : EyeOff, hidden ? "Show on the page" : "Hide from the page", actions.onToggleHidden)}
            {item(ArrowUp, "Move up", actions.onUp)}
            {item(ArrowDown, "Move down", actions.onDown)}
            <DropdownMenuPrimitive.Separator className="-mx-1.5 my-1 h-px bg-hairline" />
            {item(Trash2, "Remove", actions.onRemove, true)}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPortal>
      </DropdownMenu>
    </span>
  );
}

function HiddenTag() {
  return <span className="rounded-full bg-white-5 px-2 py-0.5 text-[11px] font-normal text-prt-muted">Hidden</span>;
}

/**
 * The page blocks' rows (board 93, ruling R1.2 on #720): one row per block in
 * page order, each with its grip, its kind, a one-line summary and its ⋯
 * menu, opening its fields where it sits; then the reorder hint and Add
 * block. A row is dragged by its grip, so the fields of an open row keep
 * their text selection.
 */
export function BlockRows({
  blocks,
  kinds,
  phone,
  errors,
  uploads,
  cardRef,
  actionsOf,
  onChange,
  onReorder,
  onAdd,
}: {
  blocks: readonly BlockFields[];
  /** The kinds Add block offers: an engine's page has no launch history. */
  kinds: readonly BlockKind[];
  phone: boolean;
  /** Every field's error in the panel; each row takes its block's (`errorsIn`). */
  errors: FieldErrors;
  uploads: PhotoUploads;
  cardRef: (section: BlockSection) => (node: HTMLDivElement | null) => void;
  actionsOf: (id: string, index: number) => BlockActions;
  onChange: (id: string, change: (block: BlockFields) => BlockFields) => void;
  onReorder: (ids: readonly string[]) => void;
  onAdd: (kind: BlockKind) => void;
}) {
  const ids = blocks.map((b) => b.id);
  const blockOf = new Map(blocks.map((b) => [b.id, b]));
  const drag = useDragOrder(ids, onReorder);
  const versionNames = blocks.flatMap((b) => (b.kind === "versions" ? b.items.map((v) => v.pill.trim()).filter((pill) => pill !== "") : []));
  return (
    <>
      {blocks.length === 0 ? (
        <p className="px-1 text-[13px] text-prt-muted">The page has no blocks yet. Add one to start.</p>
      ) : (
        <div className="space-y-3" {...drag.list}>
          {drag.order.map((id, index) => {
            const block = blockOf.get(id)!;
            const row = drag.row(id, index);
            const name = BLOCK_LABELS[block.kind];
            const section = blockSection(id);
            return (
              <div key={id} data-block-row onDragOver={row.onDragOver} className={row.dragged ? "opacity-50" : undefined}>
                <PanelSection
                  value={section}
                  cardRef={cardRef(section)}
                  title={name}
                  tag={block.hidden ? <HiddenTag /> : undefined}
                  summary={blockSummary(block)}
                  lead={
                    <span
                      draggable
                      onDragStart={(event) => {
                        row.onDragStart(event);
                        // The whole row follows the pointer, not the grip alone.
                        const card = event.currentTarget.closest("[data-block-row]");
                        if (card !== null) event.dataTransfer.setDragImage(card, 16, 16);
                      }}
                      onDragEnd={row.onDragEnd}
                      aria-hidden
                      className="cursor-grab text-dim"
                    >
                      <GripVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                  }
                  control={<BlockMenu name={`${name} block ${index + 1}`} hidden={block.hidden} actions={actionsOf(id, index)} />}
                >
                  {block.hidden && (
                    <p className="rounded-[10px] bg-white-5 px-3.5 py-2.5 text-[12px] leading-relaxed text-text-2">
                      Hidden: the page leaves this block out. Its fields are kept; show it again from the ⋯ menu.
                    </p>
                  )}
                  <BlockFieldsEditor
                    block={block}
                    phone={phone}
                    errors={errorsIn(errors, id)}
                    versionNames={versionNames}
                    uploads={uploads}
                    onChange={(change) => onChange(id, change)}
                  />
                </PanelSection>
              </div>
            );
          })}
        </div>
      )}
      {(blocks.length > 1 || blocks.length < BLOCKS_MAX) && (
        <div className="space-y-2.5 px-1">
          {blocks.length > 1 && <p className="text-[12px] text-prt-muted">Drag to reorder · ⋯ to duplicate, hide or remove</p>}
          {blocks.length < BLOCKS_MAX && <AddBlockMenu kinds={kinds} onAdd={onAdd} />}
        </div>
      )}
    </>
  );
}

/** "+ Add block" and its menu of kinds (board 93b): an icon, the kind and a line on what it holds. */
function AddBlockMenu({ kinds, onAdd }: { kinds: readonly BlockKind[]; onAdd: (kind: BlockKind) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`inline-flex items-center gap-1.5 rounded-md text-[14px] text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${CONTENT_FOCUS}`}
      >
        <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
        Add block
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content side="top" align="start" sideOffset={8} className={`${MENU_CONTENT} w-[400px] max-w-[calc(100vw-32px)] p-2`}>
          {kinds.map((kind) => {
            const Icon = BLOCK_ICONS[kind];
            return (
              <DropdownMenuPrimitive.Item
                key={kind}
                onSelect={() => onAdd(kind)}
                className="flex cursor-pointer items-center gap-3.5 rounded-lg px-3 py-2.5 outline-none transition-colors data-[highlighted]:bg-white-5"
              >
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white-5 text-accent">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-snug text-prt-text">{BLOCK_LABELS[kind]}</span>
                  <span className="block text-[13px] leading-snug text-prt-muted">{BLOCK_HINTS[kind]}</span>
                </span>
              </DropdownMenuPrimitive.Item>
            );
          })}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

/** A block's errors, keyed by their path in the block ("text.paragraphs"). */
export function errorsIn(errors: FieldErrors, id: string): FieldErrors {
  const prefix = `blocks.${id}.`;
  return Object.fromEntries(Object.entries(errors).flatMap(([field, error]) => (field.startsWith(prefix) ? [[field.slice(prefix.length), error]] : [])));
}

type BlockChange = (change: (block: BlockFields) => BlockFields) => void;

/**
 * A change to a block of one kind; it leaves a block of any other kind as it
 * is. The kind check is what makes the block one of `K`, which the compiler
 * cannot follow through a type parameter.
 */
function changeOf<K extends BlockKind>(kind: K, onChange: BlockChange) {
  return (change: (block: BlockFieldsOf<K>) => BlockFieldsOf<K>) =>
    onChange((b) => (b.kind === kind ? (change(b as unknown as BlockFieldsOf<K>) as unknown as BlockFields) : b));
}

/**
 * A block's fields in its row (board 93c). A hidden block's fields stay, and
 * the page shows them again once it is shown.
 */
function BlockFieldsEditor({
  block,
  phone,
  errors,
  versionNames,
  uploads,
  onChange,
}: {
  block: BlockFields;
  phone: boolean;
  errors: FieldErrors;
  versionNames: readonly string[];
  uploads: PhotoUploads;
  onChange: BlockChange;
}) {
  switch (block.kind) {
    case "text":
      return <TextBlockEditor block={block} phone={phone} errors={errors} onChange={changeOf("text", onChange)} />;
    case "facts":
      return <FactsBlockEditor block={block} phone={phone} errors={errors} onChange={changeOf("facts", onChange)} />;
    case "photo":
      return <PhotoBlockEditor block={block} errors={errors} uploads={uploads} onChange={changeOf("photo", onChange)} />;
    case "points":
      return <PointsBlockEditor block={block} errors={errors} onChange={changeOf("points", onChange)} />;
    case "versions": {
      const set = changeOf("versions", onChange);
      return <VersionsEditor versions={block} phone={phone} errors={errors} onChange={(next) => set((b) => ({ ...b, ...next }))} />;
    }
    case "launches": {
      const set = changeOf("launches", onChange);
      return (
        <LaunchesEditor
          launches={block}
          versionNames={versionNames}
          phone={phone}
          errors={errors}
          uploads={uploads}
          onChange={(change) => set((b) => ({ ...b, ...change(b) }))}
        />
      );
    }
    case "timeline": {
      const set = changeOf("timeline", onChange);
      return <PlanEditor plan={block} phone={phone} errors={errors} onChange={(next) => set((b) => ({ ...b, ...next }))} />;
    }
    case "gallery": {
      const set = changeOf("gallery", onChange);
      return <GalleryEditor gallery={block} errors={errors} uploads={uploads} onChange={(change) => set((b) => ({ ...b, ...change(b) }))} />;
    }
  }
}

const WIDTHS: readonly { value: TextWidth; label: string }[] = [
  { value: "full", label: "Full width" },
  { value: "half", label: "Half width" },
];

/** Full width or half (board 93c): one choice in a two-part control. */
function WidthChoice({ value, onChange }: { value: TextWidth; onChange: (width: TextWidth) => void }) {
  const id = useId();
  return (
    <div>
      <p id={id} className="mb-2 text-[13px] leading-snug text-prt-text">
        Width
      </p>
      <div role="group" aria-labelledby={id} className="grid grid-cols-2 gap-1 rounded-[10px] border border-white-10 bg-white-5 p-1">
        {WIDTHS.map((w) => (
          <button
            key={w.value}
            type="button"
            aria-pressed={value === w.value}
            onClick={() => onChange(w.value)}
            className={`h-9 rounded-lg text-[14px] transition-colors duration-300 ease-out ${CONTENT_FOCUS} ${
              value === w.value ? "bg-white-10 font-semibold text-prt-text" : "text-text-2 hover:text-prt-text"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-prt-muted">Two half-width blocks in a row sit side by side.</p>
    </div>
  );
}

type Edit<K extends BlockKind> = (change: (block: BlockFieldsOf<K>) => BlockFieldsOf<K>) => void;

function TextBlockEditor({ block, phone, errors, onChange }: { block: BlockFieldsOf<"text">; phone: boolean; errors: FieldErrors; onChange: Edit<"text"> }) {
  const set = (change: Partial<BlockFieldsOf<"text">>) => onChange((b) => ({ ...b, ...change }));
  const parts = block.parts;
  return (
    <>
      <WidthChoice value={block.width} onChange={(width) => set({ width })} />
      <TextField label="Heading" hint="optional" rows={2} value={block.heading} onChange={(heading) => set({ heading })} />
      {block.heading.trim() !== "" && (
        <TextField
          label="Label"
          hint="after the number, over the heading"
          placeholder="THE NAME"
          value={block.label}
          error={errors["text.label"]}
          onChange={(label) => set({ label })}
        />
      )}
      <ParagraphList paragraphs={block.paragraphs} error={errors["text.paragraphs"]} onChange={(paragraphs) => set({ paragraphs })} />
      {phone && (
        <TextField
          label="Phone text"
          hint="one paragraph; empty shows the paragraphs"
          rows={4}
          placeholder={block.paragraphs.join(" ")}
          value={block.phone}
          onChange={(p) => set({ phone: p })}
        />
      )}
      {parts !== null && (
        <>
          <EditableList
            label="Parts"
            hint="top to bottom, numbered from the bottom"
            items={parts.items}
            limit={{ min: 1, max: 50 }}
            error={errors["text.parts"]}
            blank={() => ({ name: "", desc: "", phone: "" })}
            rowName={(i) => `part ${i + 1}`}
            rowLabel={(i, n) => partNumber(i, n)}
            addLabel="Add part"
            onChange={(items) => set({ parts: { ...parts, items } })}
            row={(part: PartFields, i, update) => (
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2.5">
                <TextField label="Name" value={part.name} error={errors[`text.parts.${i}.name`]} onChange={(v) => update({ ...part, name: v })} />
                {phone ? (
                  <TextField
                    label="Phone description"
                    value={part.phone}
                    error={errors[`text.parts.${i}.phone`]}
                    onChange={(v) => update({ ...part, phone: v })}
                  />
                ) : (
                  <TextField label="Description" value={part.desc} error={errors[`text.parts.${i}.desc`]} onChange={(v) => update({ ...part, desc: v })} />
                )}
              </div>
            )}
          />
          <TextField
            label="Note under the parts"
            value={parts.caption}
            error={errors["text.parts.caption"]}
            onChange={(caption) => set({ parts: { ...parts, caption } })}
          />
        </>
      )}
    </>
  );
}

/**
 * A text block's paragraphs (board 93c): each in its own box, dragged by its
 * grip into a new order, × to remove it, "+ Paragraph" to add one. The last
 * one stays: a text block has one paragraph at least.
 */
function ParagraphList({ paragraphs, error, onChange }: { paragraphs: readonly string[]; error?: string; onChange: (paragraphs: string[]) => void }) {
  const id = useId();
  // A paragraph is known by its place; a drag hands back the places in their new order.
  const places = paragraphs.map((_, i) => i);
  const drag = useDragOrder(places, (order) => onChange(order.map((i) => paragraphs[i])));
  const at = (i: number, text: string) => onChange(paragraphs.map((p, j) => (j === i ? text : p)));
  return (
    <div>
      <p id={id} className="mb-2 text-[13px] leading-snug text-prt-text">
        Paragraphs
      </p>
      <ol aria-labelledby={id} className="space-y-2.5" {...drag.list}>
        {drag.order.map((place, index) => {
          const row = drag.row(place, index);
          return (
            <li key={place} onDragOver={row.onDragOver} className={`flex items-start gap-2 ${row.dragged ? "opacity-50" : ""}`}>
              <span draggable onDragStart={row.onDragStart} onDragEnd={row.onDragEnd} aria-hidden className="mt-3 cursor-grab text-dim">
                <GripVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
              </span>
              <textarea
                aria-label={`Paragraph ${index + 1}`}
                rows={3}
                value={paragraphs[place]}
                onChange={(e) => at(place, e.target.value)}
                className="h-auto min-w-0 flex-1 resize-y rounded-[10px] border border-white-10 bg-white-5 px-3.5 py-2.5 text-[14px] leading-relaxed text-prt-text placeholder:text-dim transition-colors duration-300 ease-out focus:border-accent focus:bg-accent/[0.06] focus:outline-none"
              />
              <button
                type="button"
                aria-label={`Remove paragraph ${index + 1}`}
                disabled={paragraphs.length <= 1}
                onClick={() => onChange(paragraphs.filter((_, j) => j !== place))}
                className={`mt-1.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text disabled:pointer-events-none disabled:opacity-30 ${CONTENT_FOCUS}`}
              >
                <X aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </li>
          );
        })}
      </ol>
      <ErrorLine error={error} />
      <AddLine label="Paragraph" onClick={() => onChange([...paragraphs, ""])} />
    </div>
  );
}

function AddLine({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-2.5 inline-flex items-center gap-1.5 rounded-md text-[14px] text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${CONTENT_FOCUS}`}
    >
      <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
      {label}
    </button>
  );
}

function FactsBlockEditor({ block, phone, errors, onChange }: { block: BlockFieldsOf<"facts">; phone: boolean; errors: FieldErrors; onChange: Edit<"facts"> }) {
  return (
    <EditableList
      label="Key facts"
      hint={`${KEY_FACTS_LIMIT.min} to ${KEY_FACTS_LIMIT.max}`}
      items={block.facts}
      limit={KEY_FACTS_LIMIT}
      error={errors["facts.items"]}
      blank={() => ({ value: "", label: { text: "", phone: "" } })}
      rowName={(i) => `key fact ${i + 1}`}
      addLabel="Add key fact"
      onChange={(facts) => onChange((b) => ({ ...b, facts }))}
      row={(fact: FactFields, i, update) => (
        <div className="grid grid-cols-2 gap-2.5">
          <TextField label="Value" placeholder="3 160 m" value={fact.value} error={errors[`facts.items.${i}.value`]} onChange={(value) => update({ ...fact, value })} />
          <CopyField label="Label" copy={fact.label} phone={phone} error={errors[`facts.items.${i}.label`]} onChange={(label) => update({ ...fact, label })} />
        </div>
      )}
    />
  );
}

function PhotoBlockEditor({
  block,
  errors,
  uploads,
  onChange,
}: {
  block: BlockFieldsOf<"photo">;
  errors: FieldErrors;
  uploads: PhotoUploads;
  onChange: Edit<"photo">;
}) {
  return (
    <>
      <div>
        <p className="mb-2 text-[13px] leading-snug text-prt-text">
          Photo<span className="ml-1.5 text-prt-muted">one, the page&apos;s full width</span>
        </p>
        <PhotosSection
          photos={block.photo === null ? [] : [block.photo]}
          onChange={(change) =>
            onChange((b) => {
              const [photo = null] = change(b.photo === null ? [] : [b.photo]);
              return { ...b, photo };
            })
          }
          uploads={uploads}
          cover={false}
          max={1}
          error={errors["photo.photo"]}
        />
      </div>
      <TextField label="Caption" value={block.caption} error={errors["photo.caption"]} onChange={(caption) => onChange((b) => ({ ...b, caption }))} />
    </>
  );
}

function PointsBlockEditor({ block, errors, onChange }: { block: BlockFieldsOf<"points">; errors: FieldErrors; onChange: Edit<"points"> }) {
  const set = (change: Partial<BlockFieldsOf<"points">>) => onChange((b) => ({ ...b, ...change }));
  return (
    <>
      <TextField
        label="Eyebrow"
        hint="after the number"
        placeholder="WHY LIQUID"
        value={block.eyebrow}
        error={errors["points.eyebrow"]}
        onChange={(eyebrow) => set({ eyebrow })}
      />
      <TextField label="Title" hint="a new line breaks it" rows={2} value={block.title} error={errors["points.title"]} onChange={(title) => set({ title })} />
      <EditableList
        label="Points"
        hint={`${POINTS_LIMIT.min} to ${POINTS_LIMIT.max}`}
        items={block.items}
        limit={POINTS_LIMIT}
        error={errors["points.items"]}
        blank={() => ({ title: "", text: "" })}
        rowName={(i) => `point ${i + 1}`}
        rowLabel={(i) => twoDigits(i + 1)}
        addLabel="Add point"
        onChange={(items) => set({ items })}
        row={(point: ReasonFields, i, update) => (
          <>
            <TextField label="Title" value={point.title} error={errors[`points.items.${i}.title`]} onChange={(title) => update({ ...point, title })} />
            <TextField label="Text" rows={3} value={point.text} error={errors[`points.items.${i}.text`]} onChange={(text) => update({ ...point, text })} />
          </>
        )}
      />
    </>
  );
}

/** The kinds Add block offers a project of `kind`: all eight for a rocket; an engine's page has no launch history. */
export const kindsFor = (kind: "vehicle" | "engine"): readonly BlockKind[] => BLOCK_KINDS.filter((k) => kind === "vehicle" || k !== "launches");
