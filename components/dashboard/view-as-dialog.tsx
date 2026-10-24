"use client";

import { use, useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { findViewAsPeople } from "@/app/dashboard/view-as-actions";
import { authClient } from "@/lib/auth-client";
import type { DashboardChrome } from "@/lib/dashboard/chrome";
import { VIEW_AS_PARAM, type ViewAsOpening, type ViewAsPerson } from "@/lib/dashboard/view-as";
import { Avatar } from "./avatar";
import { SHEET_OVERLAY, SheetGrabber } from "./confirm-dialog";

/** How long typing rests before the search asks the server. */
const SEARCH_REST_MS = 200;

/** The address that opens the dialog over this page, keeping what the page's own address holds. */
export function useViewAsHref(): string {
  const pathname = usePathname() ?? "/dashboard";
  const params = new URLSearchParams(useSearchParams()?.toString());
  params.set(VIEW_AS_PARAM, "1");
  return `${pathname}?${params.toString()}`;
}

/**
 * The dialog's place in the frame: mounted only when the chrome gives this
 * account a View as opening (issue #610), so a refused account that opens
 * the dialog's address gets the page alone.
 */
export function ViewAsDialogSlot({ chrome }: { chrome: Promise<DashboardChrome> }) {
  const resolved = use(chrome);
  if (resolved.kind !== "open" || resolved.viewAs === null) return null;
  return <ViewAsDialog opening={resolved.viewAs} />;
}

/** What the list shows: a search on its way, the people it found, or why it failed. */
type Found = { readonly kind: "searching" } | { readonly kind: "people"; readonly people: readonly ViewAsPerson[] } | { readonly kind: "failed"; readonly message: string };

// The View as dialog (board 96, issue #610): who the dashboard is opened as.
// A search field over the people it finds by name, the chosen row on
// white-5, and Cancel beside "View as <name>", which starts a View as session
// through Better Auth's admin plugin and lands on the dashboard as that
// person. The server's View as gate decides the start and the search alike.
// It opens from "View as…" in the user menu, as the `view-as` parameter of the
// page's own address. From sm it is a card near the top of the page; on phones
// a bottom sheet. It fades in only under motion-safe and closes at once, like
// every dialog on a redesigned page (issues #79, #80).
function ViewAsDialog({ opening }: { opening: ViewAsOpening }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";
  const open = params?.has(VIEW_AS_PARAM) ?? false;
  const search = useRef<HTMLInputElement>(null);

  const close = () => {
    const rest = new URLSearchParams(params?.toString());
    rest.delete(VIEW_AS_PARAM);
    const query = rest.toString();
    router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogPortal>
        <DialogOverlay className={SHEET_OVERLAY} />
        {/* Radix moves focus to the content on open, past an `autoFocus` inside
            it; the search field takes it instead, so typing searches at once (issue #650). */}
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            search.current?.focus();
          }}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[92svh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-panel px-5 pb-6 pt-3 text-prt-text shadow-[0_-16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 max-sm:motion-safe:data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-[15vh] sm:w-[500px] sm:-translate-x-1/2 sm:rounded-2xl sm:border sm:p-6 sm:shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
          <SheetGrabber />
          {open && <ViewAsBody opening={opening} search={search} />}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function ViewAsBody({ opening, search }: { opening: ViewAsOpening; search: RefObject<HTMLInputElement | null> }) {
  const listId = useId();
  const [text, setText] = useState("");
  const [found, setFound] = useState<Found>({ kind: "searching" });
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const asked = useRef(0);

  useEffect(() => {
    const ask = ++asked.current;
    setFound({ kind: "searching" });
    const timer = setTimeout(
      () => {
        findViewAsPeople(text).then(
          (answer) => {
            if (ask !== asked.current) return;
            setFound(answer.kind === "people" ? { kind: "people", people: answer.people } : { kind: "failed", message: answer.message });
          },
          () => ask === asked.current && setFound({ kind: "failed", message: "The search could not be read. Try again." }),
        );
      },
      text === "" ? 0 : SEARCH_REST_MS,
    );
    return () => clearTimeout(timer);
  }, [text]);

  const people = found.kind === "people" ? found.people : [];
  // The chosen row stays chosen while a search still finds it, else the first row is.
  const chosen = people.find((p) => p.id === chosenId) ?? people[0] ?? null;
  const optionId = (person: ViewAsPerson) => `${listId}-${person.id}`;

  const start = async () => {
    if (chosen === null || starting) return;
    setStarting(true);
    setStartError(null);
    const { error } = await authClient.admin.impersonateUser({ userId: chosen.id });
    if (error) {
      setStartError(error.message ?? "View as could not start. Try again.");
      setStarting(false);
      return;
    }
    // A full load, so every part of the frame reads the new session.
    window.location.assign("/dashboard");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void start();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (people.length === 0) return;
    const at = chosen === null ? -1 : people.indexOf(chosen);
    const next = Math.min(people.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)));
    setChosenId(people[next].id);
  };

  return (
    <>
      <DialogTitle className="text-[18px] font-semibold leading-snug">View the dashboard as someone</DialogTitle>
      <DialogPrimitive.Description className="mt-1.5 text-[14px] leading-relaxed text-prt-muted">
        You see exactly what they see and can act as them. Changes show as “{opening.actingTitle} as Name Surname”, and every start
        and stop goes to the Activity log.
      </DialogPrimitive.Description>

      <label className="relative mt-5 block">
        <span className="sr-only">Search people by name</span>
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
        <input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={chosen === null ? undefined : optionId(chosen)}
          ref={search}
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search by name"
          className="h-10 w-full rounded-xl border border-hairline bg-transparent pl-10 pr-3 text-[14px] text-prt-text outline-none transition-colors duration-300 ease-out placeholder:text-prt-muted hover:border-border-strong focus:border-border-strong"
        />
      </label>

      <ul id={listId} role="listbox" aria-label="People" aria-busy={found.kind === "searching"} className="mt-4 flex min-h-12 flex-col gap-0.5">
        {people.map((person) => {
          const selected = person === chosen;
          return (
            <li
              key={person.id}
              id={optionId(person)}
              role="option"
              aria-selected={selected}
              onClick={() => setChosenId(person.id)}
              className={`flex h-12 cursor-pointer items-center gap-3 rounded-lg px-2.5 transition-colors duration-300 ease-out ${selected ? "bg-white-5" : "hover:bg-white-5"}`}
            >
              <Avatar person={person} />
              <span className="min-w-0">
                <span className="block truncate text-[14px] leading-5 text-prt-text">{person.name}</span>
                <span className="block truncate text-[12px] leading-4 text-prt-muted">{person.line}</span>
              </span>
            </li>
          );
        })}
        {found.kind === "people" && people.length === 0 && (
          <li role="presentation" className="flex h-12 items-center px-2.5 text-[13px] text-prt-muted">
            {text.trim() === "" ? "There is no one to view as." : "No one by that name."}
          </li>
        )}
        {found.kind === "failed" && (
          <li role="presentation" className="flex h-12 items-center px-2.5 text-[13px] text-danger">
            {found.message}
          </li>
        )}
      </ul>

      {startError !== null && (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {startError}
        </p>
      )}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <DialogClose className="inline-flex h-11 items-center justify-center rounded-full border border-white-10 px-5 text-[14px] font-medium transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-[30px] sm:px-4 sm:text-[13px]">
          Cancel
        </DialogClose>
        <button
          type="button"
          onClick={() => void start()}
          disabled={chosen === null || starting}
          className="inline-flex h-11 items-center justify-center truncate rounded-full bg-prt-text px-5 text-[14px] font-medium text-ground transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 sm:h-[30px] sm:max-w-[60%] sm:px-4 sm:text-[13px]"
        >
          {chosen === null ? "View as" : `View as ${chosen.name}`}
        </button>
      </div>
    </>
  );
}
