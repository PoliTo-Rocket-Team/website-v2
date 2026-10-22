"use client";

import { useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { GripVertical, Minus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { removeFaq, reorderFaqs, saveFaq } from "@/app/dashboard/actions";
import { moveTo } from "@/lib/content/order";
import { editorVersion, statusOf, type ContentItem, type PublishStep } from "@/lib/content/versioned";
import { FAQ_QUESTION_MAX, faqFieldErrors, fieldsOf, placeOnApplyPage, updatedLabel, type FaqFieldErrors, type FaqVersion } from "@/lib/faq/faq";
import { ConfirmDialog } from "./confirm-dialog";
import { CONTENT_FOCUS, PublishFooter, RowMenu, StatusPill, TextField, useDragOrder, type DragRow } from "./content-parts";
import { DrawerPage, PanelBody, SidePanel } from "./drawer";
import { inputClass } from "./field";
import { EYEBROW, PageHeader, PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";

// The FAQ page (boards 79 and 79b, issue #258): the questions at the bottom of
// /apply in site order, each row dragged to its place; a row or New question
// opens the edit panel, whose Save draft keeps /apply as it is and whose
// Publish puts the question there. The page keeps the list it was sent and
// each answer from the server; every write is checked there again, behind the
// site-content gate.

type Panel = { kind: "closed" } | { kind: "new" } | { kind: "edit"; id: number };

const CLOSED: Panel = { kind: "closed" };

export function FaqView({ items: initial, now }: { items: readonly ContentItem<FaqVersion>[]; now: string }) {
  const [items, setItems] = useState<readonly ContentItem<FaqVersion>[]>(initial);
  const [panel, setPanel] = useState<Panel>(CLOSED);
  const ordered = [...items].sort((a, b) => a.siteOrder - b.siteOrder);
  const editing = panel.kind === "edit" ? (items.find((item) => item.id === panel.id) ?? null) : null;

  const saved = (item: ContentItem<FaqVersion>) => {
    setItems((list) => (list.some((i) => i.id === item.id) ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item]));
    setPanel({ kind: "edit", id: item.id });
  };
  const removed = (id: number) => {
    setItems((list) => list.filter((i) => i.id !== id));
    setPanel(CLOSED);
  };
  const reordered = (ids: readonly number[]) => {
    const before = items;
    // The questions keep the slots they held, as the server keeps them (lib/content/order.ts).
    const slots = ordered.map((i) => i.siteOrder);
    const next = new Map(ids.map((id, i) => [id, slots[i]]));
    setItems((list) => list.map((i) => (next.has(i.id) ? { ...i, siteOrder: next.get(i.id)! } : i)));
    void reorderFaqs(ids).then((result) => {
      if (!result.ok) {
        setItems(before);
        toast.error(result.error);
      }
    });
  };

  return (
    <DrawerPage drawerOpen={panel.kind !== "closed"} wide>
      <PageHeader
        title="FAQ"
        intro="Questions at the bottom of the Apply page, in site order. Drag to reorder."
        action={
          <button type="button" onClick={() => setPanel({ kind: "new" })} className={PRIMARY_PILL}>
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            New question
          </button>
        }
      />

      <FaqTable
        items={ordered}
        now={now}
        selectedId={editing?.id ?? null}
        panelOpen={panel.kind !== "closed"}
        onOpen={(id) => setPanel({ kind: "edit", id })}
        onReorder={reordered}
        onRemoved={removed}
      />

      <FaqPanel
        key={panel.kind === "edit" ? panel.id : panel.kind}
        open={panel.kind !== "closed" && (panel.kind === "new" || editing !== null)}
        item={editing}
        place={editing === null ? null : placeOnApplyPage(items, editing.id)}
        onClose={() => setPanel(CLOSED)}
        onSaved={saved}
        onRemoved={removed}
      />
    </DrawerPage>
  );
}

// The list (board 79): Question, Updated and Status over the rows. A row drags
// to its place; its menu moves it up or down for the keyboard. While a side
// panel is open from 1280px, Updated gives way so the question keeps its room.
function FaqTable({
  items,
  now,
  selectedId,
  panelOpen,
  onOpen,
  onReorder,
  onRemoved,
}: {
  items: readonly ContentItem<FaqVersion>[];
  now: string;
  selectedId: number | null;
  panelOpen: boolean;
  onOpen: (id: number) => void;
  onReorder: (ids: readonly number[]) => void;
  onRemoved: (id: number) => void;
}) {
  const ids = items.map((item) => item.id);
  const drag = useDragOrder(ids, onReorder);
  // Outside the rows: a click in the dialog would otherwise reach the row and open the panel.
  const [removing, setRemoving] = useState<ContentItem<FaqVersion> | null>(null);
  const shown = drag.order.map((id) => items.find((item) => item.id === id)!).filter(Boolean);
  const squeezed = panelOpen ? "xl:hidden" : "";

  return (
    <section className={`${PANEL} mt-6 overflow-hidden`}>
      <div className={`${EYEBROW} flex items-center gap-3 border-b border-hairline px-4 py-3.5 md:gap-4 md:px-5`}>
        <span aria-hidden className="hidden w-4 shrink-0 md:block" />
        <span className="flex-1">Question</span>
        <span className={`hidden w-[150px] shrink-0 md:block ${squeezed}`}>Updated</span>
        <span className="w-[120px] shrink-0">Status</span>
        <span aria-hidden className="w-8 shrink-0" />
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-5 text-[14px] text-prt-muted">No questions yet.</p>
      ) : (
        <ul className="divide-y divide-hairline" {...drag.list}>
          {shown.map((item, index) => (
            <FaqRow
              key={item.id}
              item={item}
              now={now}
              selected={item.id === selectedId}
              squeezed={squeezed}
              drag={drag.row(item.id, index)}
              onOpen={() => onOpen(item.id)}
              onUp={index > 0 ? () => onReorder(moveTo(ids, item.id, index - 1)) : null}
              onDown={index < items.length - 1 ? () => onReorder(moveTo(ids, item.id, index + 1)) : null}
              onRemove={() => setRemoving(item)}
            />
          ))}
        </ul>
      )}
      {removing !== null && (
        <RemoveDialog open onOpenChange={(open) => !open && setRemoving(null)} item={removing} onRemoved={() => onRemoved(removing.id)} />
      )}
    </section>
  );
}

function FaqRow({
  item,
  now,
  selected,
  squeezed,
  drag,
  onOpen,
  onUp,
  onDown,
  onRemove,
}: {
  item: ContentItem<FaqVersion>;
  now: string;
  selected: boolean;
  squeezed: string;
  drag: DragRow;
  onOpen: () => void;
  onUp: (() => void) | null;
  onDown: (() => void) | null;
  onRemove: () => void;
}) {
  const faq = editorVersion(item.version);
  return (
    <li
      draggable
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDragEnd={drag.onDragEnd}
      onClick={onOpen}
      className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-300 ease-out md:gap-4 md:px-5 ${
        selected ? "bg-accent/[0.08]" : "hover:bg-white-5"
      } ${drag.dragged ? "opacity-50" : ""}`}
    >
      <GripVertical aria-hidden className="hidden h-4 w-4 shrink-0 cursor-grab text-dim md:block" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-prt-text">{faq.question}</span>
        <span className="block truncate text-[13px] text-prt-muted">{faq.answer[0]}</span>
      </span>
      <span className={`hidden w-[150px] shrink-0 text-[13px] text-text-2 md:block ${squeezed}`}>{updatedLabel(faq.updatedAt, now)}</span>
      <span className="w-[120px] shrink-0">
        <StatusPill status={statusOf(item.version)} />
      </span>
      <RowMenu name={faq.question} onEdit={onOpen} onUp={onUp} onDown={onDown} onRemove={onRemove} />
    </li>
  );
}

function RemoveDialog({
  open,
  onOpenChange,
  item,
  onRemoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ContentItem<FaqVersion>;
  onRemoved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const live = item.version.state === "published";
  const confirm = () =>
    startTransition(async () => {
      const result = await removeFaq(item.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
      onRemoved();
      toast.success("The question was removed.");
    });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<Trash2 className="h-5 w-5" strokeWidth={1.75} />}
      title="Remove this question?"
      description={
        live
          ? `"${editorVersion(item.version).question}" leaves the Apply page at once, with its draft. This cannot be undone.`
          : `The draft of "${editorVersion(item.version).question}" is deleted. This cannot be undone.`
      }
      cancelLabel="Keep question"
      confirmLabel="Remove"
      danger
      pending={pending}
      onConfirm={confirm}
    />
  );
}

/** One answer box in the panel; the key keeps a box's focus and text in place while boxes move. */
type Paragraph = { readonly key: number; readonly text: string };

// The edit panel (board 79b): the status and the question's place on /apply
// under the title; Question with its counter; Answer as one box per
// paragraph, each dragged to its place or removed, and Add paragraph; then
// the question as the Apply page shows it. Remove, Save draft and Publish at
// the foot. New question is the same panel, empty, with no Remove.
function FaqPanel({
  open,
  item,
  place,
  onClose,
  onSaved,
  onRemoved,
}: {
  open: boolean;
  item: ContentItem<FaqVersion> | null;
  place: { place: number; of: number } | null;
  onClose: () => void;
  onSaved: (item: ContentItem<FaqVersion>) => void;
  onRemoved: (id: number) => void;
}) {
  const opened = fieldsOf(item === null ? null : editorVersion(item.version));
  const nextKey = useRef(opened.answer.length);
  const [question, setQuestion] = useState(opened.question);
  const [paragraphs, setParagraphs] = useState<readonly Paragraph[]>(() => opened.answer.map((text, key) => ({ key, text })));
  const [errors, setErrors] = useState<FaqFieldErrors>({});
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const fields = { question, answer: paragraphs.map((p) => p.text) };

  const setParagraph = (key: number, text: string) => {
    setParagraphs((list) => list.map((p) => (p.key === key ? { key, text } : p)));
    setErrors((e) => ({ ...e, answer: undefined }));
  };
  const addParagraph = () => setParagraphs((list) => [...list, { key: nextKey.current++, text: "" }]);
  const removeParagraph = (key: number) => setParagraphs((list) => list.filter((p) => p.key !== key));
  const orderParagraphs = (keys: readonly number[]) =>
    setParagraphs((list) => keys.map((key) => list.find((p) => p.key === key)!).filter(Boolean));

  const submit = (step: PublishStep) => {
    const found = faqFieldErrors(fields);
    setErrors(found);
    if (found.question !== undefined || found.answer !== undefined) return;
    const form = new FormData();
    form.set("question", question);
    for (const p of paragraphs) form.append("answer", p.text);
    startTransition(async () => {
      const result = await saveFaq(item?.id ?? null, step, form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onSaved(result.value);
      toast.success(step === "publish" ? "The question is published." : "Draft saved.");
    });
  };

  const status = item === null ? null : statusOf(item.version);

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={item === null ? "New question" : "Edit question"}
      wide
      below={
        status !== null && (
          <span className="mt-1.5 flex items-center gap-2.5 text-[13px] text-text-2">
            <StatusPill status={status} />
            {place !== null && `${place.place} of ${place.of} on the Apply page`}
          </span>
        )
      }
      footerLayout="spread"
      footer={<PublishFooter onRemove={item === null ? null : () => setConfirming(true)} pending={pending} onSubmit={submit} />}
    >
      <form noValidate onSubmit={(e) => e.preventDefault()} className="flex min-h-0 flex-1 flex-col">
        <PanelBody className="flex flex-col gap-5">
          <TextField
            label="Question"
            value={question}
            limit={FAQ_QUESTION_MAX}
            error={errors.question}
            onChange={(v) => {
              setQuestion(v);
              setErrors((e) => ({ ...e, question: undefined }));
            }}
          />
          <AnswerField
            paragraphs={paragraphs}
            error={errors.answer}
            onChange={setParagraph}
            onAdd={addParagraph}
            onRemove={removeParagraph}
            onReorder={orderParagraphs}
          />
          <ApplyPreview question={question} answer={fields.answer} />
        </PanelBody>
      </form>
      {item !== null && <RemoveDialog open={confirming} onOpenChange={setConfirming} item={item} onRemoved={() => onRemoved(item.id)} />}
    </SidePanel>
  );
}

/** Answer, one box per paragraph (board 79b): each box drags by its grip, or moves with the arrow keys on it, and × removes it. */
function AnswerField({
  paragraphs,
  error,
  onChange,
  onAdd,
  onRemove,
  onReorder,
}: {
  paragraphs: readonly Paragraph[];
  error?: string;
  onChange: (key: number, text: string) => void;
  onAdd: () => void;
  onRemove: (key: number) => void;
  onReorder: (keys: readonly number[]) => void;
}) {
  const labelId = useId();
  const errorId = `${labelId}-error`;
  const keys = paragraphs.map((p) => p.key);
  const drag = useDragOrder(keys, onReorder);
  const shown = drag.order.map((key) => paragraphs.find((p) => p.key === key)!).filter(Boolean);
  const several = paragraphs.length > 1;

  const moveByKey = (key: number, index: number) => (event: KeyboardEvent) => {
    const to = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : null;
    if (to === null || to < 0 || to >= keys.length) return;
    event.preventDefault();
    onReorder(moveTo(keys, key, to));
  };

  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="mb-2 text-[13px] leading-snug text-prt-text">
        Answer <span className="ml-1.5 text-prt-muted">one box per paragraph</span>
      </p>
      <ol className="flex flex-col gap-2.5" {...drag.list}>
        {shown.map((paragraph, index) => {
          const row = drag.row(paragraph.key, index);
          return (
            <li key={paragraph.key} onDragOver={row.onDragOver} className={`flex items-start gap-2 ${row.dragged ? "opacity-50" : ""}`}>
              <button
                type="button"
                draggable={several}
                onDragStart={(event) => {
                  const box = event.currentTarget.parentElement;
                  if (box !== null) event.dataTransfer.setDragImage(box, 12, 12);
                  row.onDragStart(event);
                }}
                onDragEnd={row.onDragEnd}
                onKeyDown={moveByKey(paragraph.key, index)}
                disabled={!several}
                aria-label={`Move paragraph ${index + 1}; up and down arrows move it`}
                className={`mt-3 inline-flex h-5 w-4 shrink-0 items-center justify-center rounded text-dim enabled:cursor-grab disabled:opacity-40 ${CONTENT_FOCUS}`}
              >
                <GripVertical aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <textarea
                aria-label={`Paragraph ${index + 1}`}
                aria-invalid={error !== undefined}
                aria-describedby={error === undefined ? undefined : errorId}
                rows={2}
                value={paragraph.text}
                onChange={(e) => onChange(paragraph.key, e.target.value)}
                className={`${inputClass(error)} h-auto min-h-[44px] flex-1 resize-none py-2.5 leading-relaxed [field-sizing:content]`}
              />
              <button
                type="button"
                onClick={() => onRemove(paragraph.key)}
                disabled={!several}
                aria-label={`Remove paragraph ${index + 1}`}
                className={`mt-2.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text disabled:pointer-events-none disabled:opacity-40 ${CONTENT_FOCUS}`}
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </li>
          );
        })}
      </ol>
      {error !== undefined && (
        <p id={errorId} className="mt-1.5 pl-6 text-[12px] text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onAdd}
        className={`ml-6 mt-3 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${CONTENT_FOCUS}`}
      >
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Add paragraph
      </button>
    </div>
  );
}

/**
 * "On the Apply page" (board 79b): the open question as /apply's accordion
 * draws it opened (components/apply/faq.tsx), at its phone size: the
 * question, the minus an open answer shows, and the answer's paragraphs.
 */
function ApplyPreview({ question, answer }: { question: string; answer: readonly string[] }) {
  const paragraphs = answer.map((p) => p.trim()).filter((p) => p !== "");
  return (
    <section aria-label="On the Apply page" className="rounded-xl border border-hairline px-4 py-4">
      <p className={EYEBROW}>On the Apply page</p>
      <div className="mt-3 flex items-center justify-between gap-6">
        <p className="min-w-0 break-words text-[15px] font-semibold leading-snug text-prt-text">{question.trim()}</p>
        <Minus aria-hidden className="h-4 w-4 shrink-0 text-text-2" />
      </div>
      {paragraphs.length > 0 && (
        <div className="mt-2 flex flex-col gap-3 text-[13px] leading-[1.7] text-text-2">
          {paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      )}
    </section>
  );
}
