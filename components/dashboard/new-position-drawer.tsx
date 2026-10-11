"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Lock, MessageSquare, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createPosition, editPosition } from "@/app/dashboard/recruitment-actions";
import {
  checkNewPosition,
  checkPositionContent,
  divisionField,
  NEW_POSITION_LIMITS,
  newPositionCode,
  type DivisionChoice,
  type NewPositionErrors,
  type PositionContent,
} from "@/lib/dashboard/new-position";
import type { PositionRow } from "@/lib/dashboard/recruitment";
import { Toggle } from "./controls";
import { Drawer } from "./drawer";
import { Field, GroupLabel, inputClass, LOCKED_INPUT } from "./field";

// New position (boards 57a and 57b): the division first, locked when the lead
// has one and a choice when they have several; the code it makes; the role's
// text and lists; the documents to ask for; and "Open now", off by default.
// It saves through the dashboard data interface (createPosition).
// Edit position (issue #207) is the same drawer opened on a saved role: its
// division locked, its fields as saved, no "Open now" (the row's switch opens
// and closes it), and Save changes writes through editPosition.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type ListKey = "required" | "desirable" | "questions";

const LISTS: readonly { key: ListKey; label: string; icon: ReactNode; placeholder: string }[] = [
  { key: "required", label: "Required skills", icon: <Check aria-hidden className="h-3.5 w-3.5 text-accent" strokeWidth={2} />, placeholder: "A skill the role needs" },
  { key: "desirable", label: "Desirable skills", icon: <Plus aria-hidden className="h-3.5 w-3.5 text-prt-muted" strokeWidth={2} />, placeholder: "A skill that helps" },
  {
    key: "questions",
    label: "Questions for applicants",
    icon: <MessageSquare aria-hidden className="h-3.5 w-3.5 text-prt-muted" strokeWidth={1.75} />,
    placeholder: "A question the form asks",
  },
];

type Form = {
  divisionId: number | null;
  title: string;
  description: string;
  required: string[];
  desirable: string[];
  questions: string[];
  motivationLetter: boolean;
  open: boolean;
};

/** A saved list, with one empty row to type in when it has none. */
const rowsOf = (items: readonly string[]) => (items.length > 0 ? [...items] : [""]);

function savedForm(content: PositionContent): Form {
  return {
    divisionId: null,
    title: content.title,
    description: content.description,
    required: rowsOf(content.required),
    desirable: rowsOf(content.desirable),
    questions: rowsOf(content.questions),
    motivationLetter: content.motivationLetter,
    open: false,
  };
}

function emptyForm(startDivisionId: number | null): Form {
  return {
    divisionId: startDivisionId,
    title: "",
    description: "",
    required: [""],
    desirable: [""],
    questions: [""],
    motivationLetter: true,
    open: false,
  };
}

export function NewPositionDrawer({
  open,
  onOpenChange,
  divisions,
  startDivisionId,
  divisionHint,
  nextId,
  editing = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divisions: readonly DivisionChoice[];
  /** The division New position starts on (`startingDivisionId`); null leaves the choice to the viewer. */
  startDivisionId: number | null;
  /** The Division field's hint when there is a choice: "2 in Aerodynamics" (board 63b); else "you lead 3". */
  divisionHint?: string;
  nextId: number;
  /** The saved role to edit; null for New position. The caller keys the drawer by it, so each opening starts from what is saved. */
  editing?: PositionRow | null;
}) {
  const [form, setForm] = useState<Form>(() => (editing ? savedForm(editing.content) : emptyForm(startDivisionId)));
  const [errors, setErrors] = useState<NewPositionErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const field = divisionField(divisions);
  const chosen = divisions.find((d) => d.id === form.divisionId) ?? null;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setForm(editing ? savedForm(editing.content) : emptyForm(startDivisionId));
      setErrors({});
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editing) return save(editing);
    const checked = checkNewPosition(form);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await createPosition(checked.position);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${checked.position.title} is saved as ${result.value.code}`);
      close(false);
    } finally {
      setSubmitting(false);
    }
  };

  const save = async (position: PositionRow) => {
    const checked = checkPositionContent(form);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await editPosition(position.id, checked.position);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Saved ${checked.position.title}`);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (field === null && editing === null) return null;

  return (
    <Drawer
      open={open}
      onOpenChange={close}
      title={editing ? "Edit position" : "New position"}
      detail={
        editing
          ? `Code ${editing.code}`
          : chosen
            ? `Code ${newPositionCode(chosen, nextId)} · made from the division`
            : "Pick a division to get the position code"
      }
      submitLabel={editing ? "Save changes" : "Create position"}
      submitting={submitting}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-6">
        {editing ? (
          <Field label="Division" hint="a role keeps its division">
            {(id) => (
              <div id={id} className={LOCKED_INPUT}>
                <span className="min-w-0 flex-1 truncate text-prt-text">
                  {editing.department} · {editing.division}
                </span>
                <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              </div>
            )}
          </Field>
        ) : field === null ? null : field.kind === "locked" ? (
          <Field label="Division" hint="the only one you lead">
            {(id) => (
              <div id={id} className={LOCKED_INPUT}>
                <span className="min-w-0 flex-1 truncate text-prt-text">
                  {field.division.department} · {field.division.name}
                </span>
                <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              </div>
            )}
          </Field>
        ) : (
          <Field label="Division" hint={divisionHint ?? `you lead ${field.divisions.length}`} error={errors.division}>
            {(id, describedBy) => (
              <DivisionMenu id={id} describedBy={describedBy} divisions={field.divisions} value={chosen} onChange={(d) => set("divisionId", d.id)} invalid={errors.division !== undefined} />
            )}
          </Field>
        )}

        <Field label="Title" error={errors.title}>
          {(id, describedBy) => (
            <input
              id={id}
              aria-describedby={describedBy}
              value={form.title}
              maxLength={NEW_POSITION_LIMITS.title}
              onChange={(e) => set("title", e.target.value)}
              className={inputClass(errors.title)}
            />
          )}
        </Field>

        <Field label="Description" hint="shown on the site" error={errors.description}>
          {(id, describedBy) => (
            <textarea
              id={id}
              aria-describedby={describedBy}
              rows={4}
              value={form.description}
              maxLength={NEW_POSITION_LIMITS.description}
              onChange={(e) => set("description", e.target.value)}
              className={`${inputClass(errors.description)} h-auto resize-none py-2.5 leading-relaxed`}
            />
          )}
        </Field>

        {LISTS.map((list) => (
          <ListField
            key={list.key}
            label={list.label}
            icon={list.icon}
            placeholder={list.placeholder}
            items={form[list.key]}
            onChange={(items) => set(list.key, items)}
            error={list.key === "required" ? errors.required : undefined}
          />
        ))}

        <div>
          <GroupLabel id="new-position-documents" label="Documents to ask for" hint="PDF, up to 2 MB each" />
          <div role="group" aria-labelledby="new-position-documents" className="divide-y divide-hairline rounded-[10px] border border-white-10">
            <div className="flex items-center gap-3 px-3.5 py-3">
              <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border border-border-strong bg-white-10 text-text-2">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px]">CV</span>
                <span className="block text-[12px] text-prt-muted">Every applicant uploads one</span>
              </span>
              <span className="rounded-full bg-white-10 px-2 py-0.5 text-[11px] text-text-2">Always asked</span>
            </div>
            <label className="flex cursor-pointer items-center gap-3 px-3.5 py-3">
              <input
                type="checkbox"
                checked={form.motivationLetter}
                onChange={(e) => set("motivationLetter", e.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-300 ease-out peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${
                  form.motivationLetter ? "border-accent bg-accent text-accent-on-accent" : "border-border-strong"
                }`}
              >
                {form.motivationLetter && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px]">Motivation letter</span>
                <span className="block text-[12px] text-prt-muted">Why this role, in their words</span>
              </span>
            </label>
          </div>
        </div>

        {!editing && (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px]">Open now</p>
              <p className="text-[12px] text-prt-muted">Shows on the site while recruitment is on</p>
            </div>
            <Toggle checked={form.open} onCheckedChange={(on) => set("open", on)} label="Open now" />
          </div>
        )}
      </div>
    </Drawer>
  );
}

function DivisionMenu({
  id,
  describedBy,
  divisions,
  value,
  onChange,
  invalid,
}: {
  id: string;
  describedBy: string | undefined;
  divisions: readonly DivisionChoice[];
  value: DivisionChoice | null;
  onChange: (division: DivisionChoice) => void;
  invalid: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={id}
        aria-describedby={describedBy}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-[10px] border bg-white-5 px-3.5 text-left text-[14px] transition-colors duration-300 ease-out data-[state=open]:border-accent data-[state=open]:bg-accent/[0.06] ${
          invalid ? "border-danger" : "border-white-10"
        } ${FOCUS}`}
      >
        <span className={`min-w-0 truncate ${value ? "text-prt-text" : "text-dim"}`}>{value ? value.name : "Choose a division"}</span>
        <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-[320px] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          <DropdownMenuPrimitive.RadioGroup
            value={value ? String(value.id) : ""}
            onValueChange={(v) => {
              const division = divisions.find((d) => String(d.id) === v);
              if (division) onChange(division);
            }}
          >
            {divisions.map((d) => (
              <DropdownMenuPrimitive.RadioItem
                key={d.id}
                value={String(d.id)}
                className="flex cursor-pointer flex-col rounded-lg px-2.5 py-2 outline-none transition-colors data-[highlighted]:bg-white-5"
              >
                <span className="text-[13px] text-prt-text">{d.name}</span>
                <span className="text-[11px] text-prt-muted">{d.department}</span>
              </DropdownMenuPrimitive.RadioItem>
            ))}
          </DropdownMenuPrimitive.RadioGroup>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

/** A list with add and remove (boards 57a, 57b): one row per item, its icon on the left and a remove cross on the right. */
function ListField({
  label,
  icon,
  placeholder,
  items,
  onChange,
  error,
}: {
  label: string;
  icon: ReactNode;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
  error?: string;
}) {
  const rows = useRef<(HTMLInputElement | null)[]>([]);
  const groupId = `list-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const add = () => {
    if (items.length >= NEW_POSITION_LIMITS.items) return;
    onChange([...items, ""]);
    requestAnimationFrame(() => rows.current[items.length]?.focus());
  };
  return (
    <div>
      <GroupLabel id={groupId} label={label} />
      <ul aria-labelledby={groupId} className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className={`flex h-10 items-center gap-3 rounded-[10px] border bg-white-5 pl-3.5 pr-2 focus-within:border-accent focus-within:bg-accent/[0.06] ${error && i === 0 ? "border-danger" : "border-white-10"}`}>
            {icon}
            <input
              ref={(el) => {
                rows.current[i] = el;
              }}
              aria-label={`${label} ${i + 1}`}
              value={item}
              maxLength={NEW_POSITION_LIMITS.item}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-prt-text placeholder:text-dim focus:outline-none"
            />
            <button
              type="button"
              aria-label={`Remove ${item || "this row"}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
            >
              <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
      {items.length < NEW_POSITION_LIMITS.items && (
        <button type="button" onClick={add} className={`mt-2 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${FOCUS}`}>
          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Add
        </button>
      )}
    </div>
  );
}
