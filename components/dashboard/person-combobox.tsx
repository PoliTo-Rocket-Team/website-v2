"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, CornerDownLeft, MailPlus } from "lucide-react";
import { activeAt, filtering, shownPeople, stepActive } from "@/lib/dashboard/person-combobox";
import type { Pictured } from "@/lib/dashboard/stored-photo";
import { Avatar } from "./avatar";

/** Someone the field can offer, already in the place's reach, with their stored photo for their row and the box (issue #656). */
export type ComboboxPerson<Id extends PersonId = number> = Pictured & {
  readonly id: Id;
  readonly name: string;
  /** Beside the name: their place or unit ("Aerodynamics · Mission Analysis"). */
  readonly aside?: string | null;
  /** Under the name: their role or email. */
  readonly line?: string | null;
  /** Why they cannot be chosen here ("Already a lead"): shown in place of the line, and the row cannot be chosen. */
  readonly taken?: string | null;
  /** At the row's end: their chips. */
  readonly trail?: ReactNode;
};

/** A person's id: a member id, or an account id where the place picks accounts (View as). */
export type PersonId = number | string;

/** A row the field adds to the people: a choice of nobody first, or someone new last ("Add ana@prt.it"). */
type OwnRow = { readonly label: string; readonly onChoose: () => void };

type Row<Id extends PersonId> =
  | { readonly kind: "nobody"; readonly key: string; readonly name: string }
  | { readonly kind: "person"; readonly key: string; readonly name: string; readonly taken?: string | null; readonly person: ComboboxPerson<Id> }
  | { readonly kind: "extra"; readonly key: string; readonly name: string; readonly detail: string };

/**
 * The dashboard's one person field (issues #481 and #511): a text input with
 * a listbox of people, an avatar and a name per row. Clicking or focusing the
 * input opens the list; typing narrows it by name, case-insensitive; Arrow
 * Down and Arrow Up move the active row, past any row that is taken; Enter
 * chooses it and never submits the form under it; and Escape closes the list
 * only, never the drawer, dialog or panel around it.
 *
 * It filters the list it is handed, so it can never offer someone outside the
 * place's reach. A place that searches the server passes `search` instead:
 * the box's text is then the place's own, and the people it hands back are
 * shown as they arrive.
 */
export function PersonCombobox<Id extends PersonId = number>({
  id,
  label,
  people,
  value,
  onChoose,
  placeholder,
  search,
  nobody,
  extra,
  heading,
  note,
  hint,
  photo,
  multi = false,
  autoFocus = false,
  onEscape,
  describedBy,
  invalid = false,
  inline = false,
}: {
  /** The input's id, from the Field that labels it. */
  id?: string;
  /** The input's name when no Field labels it. */
  label?: string;
  people: readonly ComboboxPerson<Id>[];
  /** Who is chosen; none (or nobody, with `nobody`) when null or undefined. */
  value: Id | null | undefined;
  onChoose: (id: Id) => void;
  placeholder: string;
  /** A server search: the text the place keeps, and the people it found for it. */
  search?: { readonly text: string; readonly onText: (text: string) => void };
  /** A first row that chooses nobody, and what the box reads while nobody is chosen. */
  nobody?: OwnRow;
  /** A last row that adds someone new to the team. */
  extra?: (OwnRow & { readonly detail: string }) | null;
  /** Over the people: "In the team". */
  heading?: string;
  /** Under the people: "No one in the team uses this email." */
  note?: string | null;
  /** At the list's foot: what a pick here does. */
  hint?: ReactNode;
  /** The box's circle drawn the place's own way, in place of the chosen person's avatar. */
  photo?: ReactNode;
  /** Each choice adds one person, so the box empties for the next. */
  multi?: boolean;
  autoFocus?: boolean;
  /** Escape also closes what holds the field (a picker under "+ Add lead"). */
  onEscape?: () => void;
  describedBy?: string;
  invalid?: boolean;
  /**
   * The list takes its own room under the box and pushes what follows down,
   * for a place where a list laid over the page would be cut off at the
   * edge of what holds it (the View as dialog's card, issue #618).
   */
  inline?: boolean;
}) {
  const ownId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const chosen = value === null || value === undefined ? undefined : people.find((p) => p.id === value);
  const chosenLabel = chosen?.name ?? (nobody !== undefined && (value === null || value === undefined) ? nobody.label : "");

  // What the box reads: the chosen name until the person types, or the place's own search text.
  const [ownText, setOwnText] = useState(chosenLabel);
  const [seen, setSeen] = useState(chosenLabel);
  if (seen !== chosenLabel) {
    // The place chose someone else (Back to the team record): the box reads them.
    setSeen(chosenLabel);
    if (search === undefined) setOwnText(chosenLabel);
  }
  const text = search === undefined ? ownText : search.text;
  const setText = search === undefined ? setOwnText : search.onText;
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(0);

  const narrowing = search === undefined && filtering(text, chosenLabel);
  const shown = shownPeople(people, text, chosenLabel, search !== undefined);
  const rows: readonly Row<Id>[] = [
    ...(nobody !== undefined && !narrowing ? [{ kind: "nobody" as const, key: "nobody", name: nobody.label }] : []),
    ...shown.map((person) => ({ kind: "person" as const, key: `p${person.id}`, name: person.name, taken: person.taken, person })),
    ...(extra ? [{ kind: "extra" as const, key: "extra", name: extra.label, detail: extra.detail }] : []),
  ];
  const noOne = search === undefined && shown.length === 0;
  const listShown = open && (rows.length > 0 || noOne || Boolean(note) || hint !== undefined);
  const active = listShown ? activeAt(rows, asked) : -1;
  const activeRow = active >= 0 ? rows[active] : undefined;
  const optionId = (row: Row<Id>) => `${listId}-${row.key}`;
  const isChosen = (row: Row<Id>) => (row.kind === "person" ? row.person.id === value : row.kind === "nobody" && (value === null || value === undefined));

  const show = () => {
    if (open) return;
    setAsked(Math.max(rows.findIndex(isChosen), 0));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    // Typed text that chose no one goes back to what is chosen; a search keeps its text.
    if (search === undefined) setOwnText(chosenLabel);
  };
  const choose = (row: Row<Id>) => {
    if (row.kind === "person") {
      if (row.taken) return;
      onChoose(row.person.id);
    } else if (row.kind === "nobody") nobody?.onChoose();
    else extra?.onChoose();
    setOpen(false);
    if (multi) setText("");
    else if (search === undefined) setOwnText(row.kind === "extra" ? chosenLabel : row.name);
  };

  // A drawer or dialog is a Radix layer, which closes on an Escape it hears on
  // the document while capturing. While the list is open, Escape is the
  // list's: this listener on the window hears it first, and a prevented
  // Escape is one the layer leaves alone. With `onEscape`, Escape is the
  // field's even with the list closed, and closes what holds it.
  useEffect(() => {
    if (!open && onEscape === undefined) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.target !== inputRef.current) return;
      e.preventDefault();
      close();
      onEscape?.();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  });

  // The active row stays in view as the arrows move it.
  useEffect(() => {
    if (activeRow) document.getElementById(optionId(activeRow))?.scrollIntoView?.({ block: "nearest" });
  });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) return show();
        setAsked(stepActive(rows, active, 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        if (!open) return show();
        setAsked(stepActive(rows, active, -1));
        return;
      case "Enter":
        // Enter in an open list chooses; it never submits the form under it.
        if (!listShown) return;
        e.preventDefault();
        if (activeRow) choose(activeRow);
        return;
    }
  };

  // Who the box shows, with their avatar before the name, while the list is closed.
  const boxPerson = open ? undefined : chosen;
  const boxPhoto = boxPerson !== undefined;
  const padded = rows.length > 0 || noOne || Boolean(note);

  return (
    <div className="relative">
      <div className="relative">
        {boxPerson && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">{photo ?? <Avatar size="sm" person={boxPerson} />}</span>}
        <input
          ref={inputRef}
          id={id ?? ownId}
          aria-label={label}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listShown}
          aria-controls={listId}
          aria-activedescendant={activeRow ? optionId(activeRow) : undefined}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={text}
          placeholder={placeholder}
          onFocus={show}
          onClick={show}
          onBlur={close}
          onChange={(e) => {
            setText(e.target.value);
            setAsked(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={`h-11 w-full rounded-[10px] border bg-white-5 pr-10 text-[15px] text-prt-text transition-colors duration-300 ease-out placeholder:text-prt-muted focus:outline-none ${
            invalid ? "border-danger" : "border-white-10 focus:border-accent"
          } ${boxPhoto ? "pl-12" : "pl-3"}`}
        />
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-2" />
      </div>
      <div
        className={`${inline ? "relative" : "absolute inset-x-0 top-full z-50"} mt-1.5 max-h-[320px] overflow-y-auto rounded-xl border border-hairline bg-panel text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] ${
          listShown ? "" : "hidden"
        }`}
      >
        <div className={padded ? "p-1.5" : undefined}>
          {heading !== undefined && shown.length > 0 && (
            <p className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-dim">{heading}</p>
          )}
          <ul id={listId} role="listbox" aria-label="People">
            {rows.map((row, at) => (
              <ComboboxRow
                key={row.key}
                row={row}
                id={optionId(row)}
                active={at === active}
                selected={isChosen(row)}
                note={row.kind === "extra" && note ? note : null}
                onHover={() => setAsked(at)}
                onChoose={() => choose(row)}
              />
            ))}
          </ul>
          {note && !extra &&<p className="px-2.5 py-2 text-[13px] text-prt-muted">{note}</p>}
          {noOne && <p className="px-2.5 py-2 text-[13px] text-prt-muted">No one matches</p>}
        </div>
        {hint !== undefined && <p className="border-t border-hairline px-3.5 py-2.5 text-[12px] leading-relaxed text-prt-muted">{hint}</p>}
      </div>
    </div>
  );
}

function ComboboxRow<Id extends PersonId>({
  row,
  id,
  active,
  selected,
  note,
  onHover,
  onChoose,
}: {
  row: Row<Id>;
  id: string;
  active: boolean;
  selected: boolean;
  /** Over someone new: why the email is new. */
  note: string | null;
  onHover: () => void;
  onChoose: () => void;
}) {
  const taken = row.kind === "person" && Boolean(row.taken);
  const option = (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={taken || undefined}
      // A press keeps the focus in the input, so the list is not closed by its blur before the click lands.
      onMouseDown={(e) => e.preventDefault()}
      onMouseMove={taken ? undefined : onHover}
      onClick={onChoose}
      className={`flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors duration-300 ease-out ${
        taken ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${active ? (row.kind === "extra" ? "bg-white-10" : "bg-white-5") : row.kind === "extra" ? "bg-white-5" : ""}`}
    >
      {row.kind === "person" && <Avatar size="md" person={row.person} />}
      {row.kind === "nobody" && <span aria-hidden className="h-8 w-8 shrink-0 rounded-full border border-dashed border-white-10" />}
      {row.kind === "extra" && (
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <MailPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className={`text-[14px] text-prt-text ${row.kind === "person" && row.person.aside ? "shrink-0" : "truncate"}`}>{row.name}</span>
          {row.kind === "person" && row.person.aside && <span className="truncate text-[12px] text-prt-muted">{row.person.aside}</span>}
        </span>
        {row.kind === "person" && (row.taken || row.person.line) && <span className="block truncate text-[12px] text-prt-muted">{row.taken || row.person.line}</span>}
        {row.kind === "extra" && <span className="block truncate text-[12px] text-prt-muted">{row.detail}</span>}
      </span>
      {row.kind === "person" && row.person.trail}
      {row.kind === "extra" && <CornerDownLeft aria-hidden className="h-3.5 w-3.5 shrink-0 text-prt-muted" strokeWidth={1.75} />}
      {selected && <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />}
    </li>
  );
  if (note === null) return option;
  return (
    <>
      <li role="presentation" className="px-2.5 pb-1.5 pt-1 text-[12px] text-prt-muted">
        {note}
      </li>
      {option}
    </>
  );
}
