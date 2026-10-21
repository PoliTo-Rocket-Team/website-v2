"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Avatar } from "./avatar";

/** Someone the combobox can offer: the page's own people, already in the viewer's reach. */
export type ComboboxPerson = { readonly id: number; readonly name: string };

/**
 * A type-to-search person field (issue #481): a text input with a listbox of
 * the people it is given, in PeoplePicker's look (an avatar and a name per
 * row, the dropdown panel). Clicking or focusing the input opens the list;
 * typing narrows it by name, case-insensitive; Arrow Down and Arrow Up move
 * the active row, Enter chooses it, and Escape closes the list only, never the
 * drawer around it. It filters the list it is handed and asks the server for
 * nothing, so it can never offer someone outside the caller's reach.
 */
export function PersonCombobox({
  id,
  people,
  value,
  onChoose,
  placeholder,
}: {
  /** The input's id, from the Field that labels it. */
  id: string;
  people: readonly ComboboxPerson[];
  value: number | undefined;
  onChoose: (id: number) => void;
  placeholder: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const chosen = people.find((p) => p.id === value);
  // What the input shows: the chosen name until the person types.
  const [text, setText] = useState(chosen?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // The whole list while the input still reads the chosen name, else the names that hold what was typed.
  const needle = text.trim().toLowerCase();
  const shown = needle === "" || text === chosen?.name ? people : people.filter((p) => p.name.toLowerCase().includes(needle));
  const activeRow = open ? shown[Math.min(active, shown.length - 1)] : undefined;
  const optionId = (personId: number) => `${listId}-${personId}`;

  const show = () => {
    if (open) return;
    const at = chosen === undefined ? 0 : shown.findIndex((p) => p.id === chosen.id);
    setActive(Math.max(at, 0));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setText(chosen?.name ?? "");
  };
  const choose = (person: ComboboxPerson) => {
    onChoose(person.id);
    setText(person.name);
    setOpen(false);
  };

  // The drawer is a Radix dialog, which closes on an Escape it hears on the
  // document while capturing. While the list is open, Escape is the list's:
  // this listener on the window hears it first, and a prevented Escape is one
  // the dialog leaves alone.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.target !== inputRef.current) return;
      e.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  });

  // The active row stays in view as the arrows move it.
  useEffect(() => {
    if (activeRow) document.getElementById(optionId(activeRow.id))?.scrollIntoView({ block: "nearest" });
  });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) return show();
        setActive((i) => Math.min(Math.min(i, shown.length - 1) + 1, shown.length - 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        if (!open) return show();
        setActive((i) => Math.max(Math.min(i, shown.length - 1) - 1, 0));
        return;
      case "Enter":
        // Enter in an open list chooses; it never submits the form under it.
        if (!open) return;
        e.preventDefault();
        if (activeRow) choose(activeRow);
        return;
    }
  };

  return (
    <div className="relative">
      {chosen && !open && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
          <Avatar size="sm" />
        </span>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeRow ? optionId(activeRow.id) : undefined}
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onFocus={show}
        onClick={show}
        onBlur={close}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={`h-11 w-full rounded-[10px] border border-white-10 bg-white-5 pr-10 text-[15px] text-prt-text transition-colors duration-300 ease-out placeholder:text-prt-muted focus:border-accent focus:outline-none ${
          chosen && !open ? "pl-12" : "pl-3"
        }`}
      />
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-2" />
      <div
        className={`absolute inset-x-0 top-full z-50 mt-1.5 max-h-[320px] overflow-y-auto rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] ${
          open ? "" : "hidden"
        }`}
      >
        <ul id={listId} role="listbox" aria-label="People">
          {shown.map((p) => {
            const isActive = activeRow?.id === p.id;
            return (
              <li
                key={p.id}
                id={optionId(p.id)}
                role="option"
                aria-selected={p.id === value}
                // A press keeps the focus in the input, so the list is not closed by its blur before the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => setActive(shown.indexOf(p))}
                onClick={() => choose(p)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors duration-300 ease-out ${isActive ? "bg-white-5" : ""}`}
              >
                <Avatar size="md" />
                <span className="min-w-0 flex-1 truncate text-[14px] text-prt-text">{p.name}</span>
                {p.id === value && <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />}
              </li>
            );
          })}
        </ul>
        {shown.length === 0 && <p className="px-2.5 py-2 text-[13px] text-prt-muted">No one matches</p>}
      </div>
    </div>
  );
}
