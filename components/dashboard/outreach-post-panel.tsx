"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { discardOutreachPhoto, uploadOutreachPhoto } from "@/app/dashboard/actions";
import { CHANNEL_ICONS } from "@/components/outreach/channel-icons";
import { shortDayMonthYear } from "@/lib/outreach";
import type { ChannelFields, PostFieldErrors, PostFields } from "@/lib/outreach-post-fields";
import { isIsoDate } from "@/lib/outreach-rows";
import {
  CHANNEL_LABELS,
  CHANNEL_NAMES,
  type BodyBlock,
  type ChannelName,
  type OutreachTag,
} from "@/lib/outreach-types";
import { CONTENT_FOCUS, RowMenu, TextField, useDragOrder, type DragRow } from "./content-parts";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditPanel, ErrorLine, PanelSection, usePanelScroll } from "./edit-panel";
import { Field, GroupLabel, inputClass } from "./field";
import { PhotosSection, type PhotoUploads } from "./outreach-post-photos";

const OUTREACH_UPLOADS: PhotoUploads = { upload: uploadOutreachPhoto, discard: discardOutreachPhoto };

// The Edit post panel (boards 74c, 74d and 74h, issue #290): 480px beside the
// post page under the edit shell, one card per section, any of them open at
// once. Every change goes straight back to the page, which redraws as the
// editor types; Save draft and Publish sit on the edit bar. Photos upload,
// move and take their alt text in ./outreach-post-photos.tsx (issue #291).

/** The panel's sections, in order; each block's Edit chip opens one. */
export type PostSection = "details" | "text" | "photos" | "channels";

/** Which section a refused field sits in, so a refusal opens it. */
export const SECTION_OF: Readonly<Record<keyof PostFieldErrors, PostSection>> = {
  title: "details",
  date: "details",
  tags: "details",
  lead: "details",
  summary: "details",
  body: "text",
  photos: "photos",
  channels: "channels",
};

export function OutreachPostPanel({
  fields,
  onChange,
  tags,
  onAddTag,
  errors,
  expanded,
  onExpandedChange,
  scrollTo,
  onClose,
}: {
  fields: PostFields;
  /** Takes a change to the fields as they are when it lands, so a slow tag add never undoes typing. */
  onChange: (change: (fields: PostFields) => PostFields) => void;
  tags: readonly OutreachTag[];
  /** Adds a tag to the tag list; answers whether it was added. */
  onAddTag: (name: string) => Promise<boolean>;
  errors: PostFieldErrors;
  expanded: readonly PostSection[];
  onExpandedChange: (sections: PostSection[]) => void;
  /** The section an Edit chip just opened, brought into view; a new object each time. */
  scrollTo: { readonly section: PostSection } | null;
  onClose: () => void;
}) {
  const card = usePanelScroll(scrollTo);
  const set = <K extends keyof PostFields>(key: K, value: PostFields[K]) => onChange((f) => ({ ...f, [key]: value }));
  const addTag = async (name: string) => {
    const added = await onAddTag(name);
    if (added) onChange((f) => ({ ...f, tags: [...f.tags, name] }));
    return added;
  };

  return (
    <EditPanel label="Edit post" title="Edit post" expanded={expanded} onExpandedChange={onExpandedChange} onClose={onClose}>
      <PanelSection value="details" cardRef={card("details")} title="Title and details" summary={detailsSummary(fields)}>
        <DetailsSection fields={fields} set={set} tags={tags} onAddTag={addTag} errors={errors} />
      </PanelSection>

      <PanelSection value="text" cardRef={card("text")} title="Text" summary={textSummary(fields.body)}>
        <TextSection body={fields.body} onChange={(body) => set("body", body)} error={errors.body} />
      </PanelSection>

      <PanelSection value="photos" cardRef={card("photos")} title="Photos" summary={`${count(fields.photos.length, "photo")} · the first is the cover`}>
        <PhotosSection
          photos={fields.photos}
          onChange={(change) => onChange((f) => ({ ...f, photos: change(f.photos) }))}
          uploads={OUTREACH_UPLOADS}
          cover
          max={null}
          error={errors.photos}
        />
      </PanelSection>

      <PanelSection value="channels" cardRef={card("channels")} title="Original posts" summary={channelsSummary(fields.channels)}>
        <ChannelsSection channels={fields.channels} onChange={(channels) => set("channels", channels)} error={errors.channels} />
      </PanelSection>
    </EditPanel>
  );
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

function joinedNames(names: readonly string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function detailsSummary(fields: PostFields): string {
  return [fields.title.trim() || "No title", isIsoDate(fields.date) ? shortDayMonthYear(fields.date) : "No date", fields.tags.join(", ")]
    .filter(Boolean)
    .join(" · ");
}

function textSummary(body: readonly BodyBlock[]): string {
  const kinds = [
    body.some((b) => b.kind === "paragraph") && "paragraphs",
    body.some((b) => b.kind === "heading") && "headings",
    ((n) => n > 0 && count(n, "highlight"))(body.filter((b) => b.kind === "highlight").length),
  ].filter((k): k is string => typeof k === "string");
  return [count(body.length, "block"), kinds.join(", ")].filter(Boolean).join(" · ");
}

function channelsSummary(channels: readonly ChannelFields[]): string {
  return channels.length === 0 ? "No channel yet" : `${joinedNames(channels.map((c) => CHANNEL_LABELS[c.name]))} links`;
}

function DetailsSection({
  fields,
  set,
  tags,
  onAddTag,
  errors,
}: {
  fields: PostFields;
  set: <K extends keyof PostFields>(key: K, value: PostFields[K]) => void;
  tags: readonly OutreachTag[];
  /** Adds the tag to the tag list and picks it for this post; answers whether it was added. */
  onAddTag: (name: string) => Promise<boolean>;
  errors: PostFieldErrors;
}) {
  const toggle = (name: string) =>
    set("tags", fields.tags.includes(name) ? fields.tags.filter((t) => t !== name) : [...fields.tags, name]);
  return (
    <>
      <TextField label="Title" value={fields.title} error={errors.title} onChange={(v) => set("title", v)} />
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Date" error={errors.date}>
          {(id, describedBy) => (
            <input
              id={id}
              type="date"
              value={fields.date}
              aria-invalid={errors.date !== undefined}
              aria-describedby={describedBy}
              onChange={(e) => set("date", e.target.value)}
              className={`${inputClass(errors.date)} [color-scheme:dark]`}
            />
          )}
        </Field>
        <TextField label="Place" hint="optional" value={fields.place} onChange={(v) => set("place", v)} />
      </div>
      <div>
        <GroupLabel id="post-tags" label="Tags" hint="at least 1" />
        <div role="group" aria-labelledby="post-tags" className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => {
            const on = fields.tags.includes(tag.name);
            return (
              <button
                key={tag.name}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(tag.name)}
                className={`inline-flex h-[26px] items-center rounded-full border px-2.5 text-[12px] transition-colors duration-300 ease-out ${CONTENT_FOCUS} ${
                  on ? "border-accent bg-accent-soft text-accent" : "border-white-10 text-text-2 hover:border-border-strong hover:text-prt-text"
                }`}
              >
                {tag.name}
              </button>
            );
          })}
          <NewTag onAdd={onAddTag} />
        </div>
        <div className="mt-1.5">
          <ErrorLine error={errors.tags} />
        </div>
      </div>
      <TextField label="Lead" hint="under the title" rows={3} value={fields.lead} error={errors.lead} onChange={(v) => set("lead", v)} />
      <TextField
        label="Card summary"
        hint="on the Outreach list card"
        rows={2}
        value={fields.summary}
        error={errors.summary}
        onChange={(v) => set("summary", v)}
      />
    </>
  );
}

/** The tag list's end: type a new tag, Enter adds it to the tag data and picks it for this post. */
function NewTag({ onAdd }: { onAdd: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const onKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (adding || name.trim() === "") return;
    setAdding(true);
    const added = await onAdd(name.trim());
    setAdding(false);
    if (added) setName("");
  };
  return (
    <span className="inline-flex items-center gap-2">
      <input
        aria-label="New tag"
        placeholder="New tag"
        value={name}
        disabled={adding}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onKeyDown}
        className={`h-[26px] w-[104px] rounded-full border border-white-10 bg-transparent px-2.5 text-[12px] text-prt-text placeholder:text-dim transition-colors duration-300 ease-out focus:border-prt-text focus:outline-none`}
      />
      <span aria-hidden className="text-[11px] text-dim">
        Enter to add
      </span>
    </span>
  );
}

const BLOCK_LABELS: Readonly<Record<BodyBlock["kind"], string>> = {
  paragraph: "Paragraph",
  heading: "Heading",
  highlight: "Highlight",
};

const NEW_BLOCK: Readonly<Record<BodyBlock["kind"], BodyBlock>> = {
  paragraph: { kind: "paragraph", text: "" },
  heading: { kind: "heading", text: "" },
  highlight: { kind: "highlight", label: "", text: "" },
};

/** The post's text as block cards: click one to write in it, drag or its menu to move it, the buttons below to add one. */
function TextSection({ body, onChange, error }: { body: readonly BodyBlock[]; onChange: (body: BodyBlock[]) => void; error?: string }) {
  // Each block keeps one key while it moves, so a card being written in stays itself.
  const [keys, setKeys] = useState(() => body.map((_, i) => i));
  const nextKey = useRef(body.length);
  const [open, setOpen] = useState<number | null>(null);
  const blockOf = new Map(keys.map((key, i) => [key, body[i]]));

  const reorder = (order: readonly number[]) => {
    setKeys([...order]);
    onChange(order.map((key) => blockOf.get(key)!));
  };
  const drag = useDragOrder(keys, reorder);
  const shown = drag.order;

  const update = (key: number, block: BodyBlock) => onChange(keys.map((k, i) => (k === key ? block : body[i])));
  const remove = (key: number) => {
    setKeys(keys.filter((k) => k !== key));
    onChange(body.filter((_, i) => keys[i] !== key));
    if (open === key) setOpen(null);
  };
  const add = (kind: BodyBlock["kind"]) => {
    const key = nextKey.current++;
    setKeys([...keys, key]);
    onChange([...body, NEW_BLOCK[kind]]);
    setOpen(key);
  };
  const move = (key: number, by: -1 | 1) => {
    const at = keys.indexOf(key);
    const order = [...keys];
    [order[at], order[at + by]] = [order[at + by], order[at]];
    reorder(order);
  };

  return (
    <>
      <ol className="space-y-2" {...drag.list}>
        {shown.map((key, index) => {
          const block = blockOf.get(key)!;
          const row = drag.row(key, index);
          return (
            <BlockCard
              key={key}
              block={block}
              open={open === key}
              dragged={row.dragged}
              drag={row}
              onOpen={() => setOpen(key)}
              onChange={(next) => update(key, next)}
              menu={
                <RowMenu
                  name={BLOCK_LABELS[block.kind]}
                  onEdit={() => setOpen(key)}
                  onUp={index > 0 ? () => move(key, -1) : null}
                  onDown={index < shown.length - 1 ? () => move(key, 1) : null}
                  onRemove={() => remove(key)}
                />
              }
            />
          );
        })}
      </ol>
      <ErrorLine error={error} />
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {(["paragraph", "heading", "highlight"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => add(kind)}
            className={`inline-flex items-center gap-1.5 rounded-md text-[13px] text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${CONTENT_FOCUS}`}
          >
            <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {BLOCK_LABELS[kind]}
          </button>
        ))}
      </div>
    </>
  );
}

function BlockCard({
  block,
  open,
  dragged,
  drag,
  onOpen,
  onChange,
  menu,
}: {
  block: BodyBlock;
  open: boolean;
  dragged: boolean;
  drag: DragRow;
  onOpen: () => void;
  onChange: (block: BodyBlock) => void;
  menu: ReactNode;
}) {
  const highlight = block.kind === "highlight";
  const kindLabel = (
    <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${highlight ? "text-accent" : "text-dim"}`}>{BLOCK_LABELS[block.kind]}</span>
  );
  return (
    <li
      draggable={!open}
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDragEnd={drag.onDragEnd}
      className={`group/card relative flex gap-2 rounded-[10px] border py-2.5 pl-2 pr-1.5 transition-colors duration-300 ease-out ${
        open ? "border-accent" : "border-hairline hover:border-border-strong"
      } ${highlight ? "bg-accent/[0.04]" : "bg-white-5"} ${dragged ? "opacity-50" : ""}`}
    >
      <GripVertical aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-grab text-dim" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        {open ? (
          <div className="space-y-2">
            {kindLabel}
            {block.kind === "highlight" && (
              <input
                aria-label="Highlight label"
                placeholder="Label, such as AWARD"
                value={block.label}
                onChange={(e) => onChange({ ...block, label: e.target.value })}
                className={`${inputClass()} h-9 font-mono text-[12px] uppercase tracking-[0.15em]`}
              />
            )}
            <textarea
              autoFocus
              aria-label={`${BLOCK_LABELS[block.kind]} text`}
              rows={block.kind === "heading" ? 1 : 4}
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
              className={`${inputClass()} h-auto resize-none py-2 leading-relaxed ${block.kind === "heading" ? "font-semibold" : "text-[13px]"}`}
            />
          </div>
        ) : (
          <button type="button" onClick={onOpen} className={`block w-full rounded-md text-left ${CONTENT_FOCUS}`}>
            {kindLabel}
            <span
              className={`mt-1 line-clamp-2 ${
                block.kind === "heading" ? "text-[14px] font-semibold text-prt-text" : "text-[13px] leading-[1.5] text-text-2"
              }`}
            >
              {blockPreview(block) || <span className="text-dim">Empty: click to write</span>}
            </span>
          </button>
        )}
      </div>
      <div className="shrink-0 -mt-1">{menu}</div>
    </li>
  );
}

function blockPreview(block: BodyBlock): string {
  if (block.kind !== "highlight") return block.text;
  return [block.label.trim().toUpperCase(), block.text.trim()].filter(Boolean).join(" · ");
}

const MENU_ITEM =
  "flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-text-2 outline-none transition-colors data-[highlighted]:bg-white-5 data-[highlighted]:text-prt-text";

/** Instagram and LinkedIn first, then any other channel: a link and the post's first line each. */
function ChannelsSection({
  channels,
  onChange,
  error,
}: {
  channels: readonly ChannelFields[];
  onChange: (channels: ChannelFields[]) => void;
  error?: string;
}) {
  const added = new Set(channels.map((c) => c.name));
  const missing = CHANNEL_NAMES.filter((name) => !added.has(name));
  const update = (name: ChannelName, change: Partial<ChannelFields>) =>
    onChange(channels.map((c) => (c.name === name ? { ...c, ...change } : c)));
  const add = (name: ChannelName) =>
    onChange(
      [...channels, { name, url: "", caption: "" }].sort((a, b) => CHANNEL_NAMES.indexOf(a.name) - CHANNEL_NAMES.indexOf(b.name)),
    );
  const alreadyAdded = CHANNEL_NAMES.filter((name) => added.has(name)).map((name) => CHANNEL_LABELS[name]);
  return (
    <>
      <p className="text-[12px] text-prt-muted">The cards on the right of the post. At least one channel.</p>
      {channels.map((channel) => {
        const Icon = CHANNEL_ICONS[channel.name];
        const label = CHANNEL_LABELS[channel.name];
        return (
          <div key={channel.name} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
                <Icon aria-hidden className="h-4 w-4 text-text-2" strokeWidth={1.75} />
                {label}
              </span>
              <button
                type="button"
                aria-label={`Remove ${label}`}
                onClick={() => onChange(channels.filter((c) => c.name !== channel.name))}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text ${CONTENT_FOCUS}`}
              >
                <X aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
            <input
              type="url"
              aria-label={`${label} link`}
              placeholder="https://"
              value={channel.url}
              onChange={(e) => update(channel.name, { url: e.target.value })}
              className={inputClass()}
            />
            <textarea
              aria-label={`${label} first line`}
              placeholder="The post's first line"
              rows={2}
              value={channel.caption}
              onChange={(e) => update(channel.name, { caption: e.target.value })}
              className={`${inputClass()} h-auto resize-none py-2.5 leading-relaxed`}
            />
          </div>
        );
      })}
      <ErrorLine error={error} />
      {missing.length > 0 && (
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`inline-flex items-center gap-1.5 rounded-md text-[13px] text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${CONTENT_FOCUS}`}
            >
              <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Add another channel
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuPrimitive.Content
                align="start"
                sideOffset={8}
                className="z-50 min-w-[220px] rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
              >
                {missing.map((name) => {
                  const Icon = CHANNEL_ICONS[name];
                  return (
                    <DropdownMenuPrimitive.Item key={name} onSelect={() => add(name)} className={MENU_ITEM}>
                      <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {CHANNEL_LABELS[name]}
                    </DropdownMenuPrimitive.Item>
                  );
                })}
              </DropdownMenuPrimitive.Content>
            </DropdownMenuPortal>
          </DropdownMenu>
          {alreadyAdded.length > 0 && (
            <p className="mt-2 text-[12px] text-prt-muted">
              {joinedNames(alreadyAdded)} {alreadyAdded.length === 1 ? "is" : "are"} already added.
            </p>
          )}
        </div>
      )}
    </>
  );
}
