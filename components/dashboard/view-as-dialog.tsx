"use client";

import { use, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { findViewAsPeople } from "@/app/dashboard/view-as-actions";
import { authClient } from "@/lib/auth-client";
import type { DashboardChrome } from "@/lib/dashboard/chrome";
import { VIEW_AS_PARAM, type ViewAsOpening, type ViewAsPerson } from "@/lib/dashboard/view-as";
import { SHEET_OVERLAY, SheetGrabber } from "./confirm-dialog";
import { PersonCombobox } from "./person-combobox";

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
// The dashboard's one person field (issue #618) over the people the server
// finds by name, nobody chosen until the viewer picks someone, and Cancel
// beside "View as <name>", which starts a View as session
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
  const fieldId = useId();

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
            document.getElementById(fieldId)?.focus();
          }}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[92svh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-panel px-5 pb-6 pt-3 text-prt-text shadow-[0_-16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 max-sm:motion-safe:data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-[15vh] sm:w-[500px] sm:-translate-x-1/2 sm:rounded-2xl sm:border sm:p-6 sm:shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
          <SheetGrabber />
          {open && <ViewAsBody opening={opening} fieldId={fieldId} />}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/**
 * The dialog's body: the person field, why View as could not start, and the
 * buttons. Nobody is chosen when it opens; a pick chooses someone, typing
 * other text unchooses them, and View as starts, by its button or by Enter,
 * only once someone is chosen (issue #618).
 */
export function ViewAsBody({ opening, fieldId }: { opening: ViewAsOpening; fieldId: string }) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<Found>({ kind: "searching" });
  const [chosen, setChosen] = useState<ViewAsPerson | null>(null);
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
  const note =
    found.kind === "failed" ? found.message : found.kind === "people" && people.length === 0 ? (text.trim() === "" ? "There is no one to view as." : "No one by that name.") : null;

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

  // Enter the open list did not take (it chooses there) starts View as for whoever is chosen.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.defaultPrevented) return;
    event.preventDefault();
    void start();
  };

  return (
    <>
      <DialogTitle className="text-[18px] font-semibold leading-snug">View the dashboard as someone</DialogTitle>
      <DialogPrimitive.Description className="mt-1.5 text-[14px] leading-relaxed text-prt-muted">
        You see exactly what they see and can act as them. Changes show as “{opening.actingTitle} as Name Surname”, and every start
        and stop goes to the Activity log.
      </DialogPrimitive.Description>

      <div className="mt-5" onKeyDown={onKeyDown}>
        <label htmlFor={fieldId} className="sr-only">
          Search people by name
        </label>
        <PersonCombobox<string>
          id={fieldId}
          people={people.map((p) => ({ id: p.id, name: p.name, photoUrl: p.photoUrl, line: p.line }))}
          value={chosen?.id ?? null}
          onChoose={(id) => {
            const person = people.find((p) => p.id === id);
            if (person === undefined) return;
            setChosen(person);
            setText(person.name);
            setStartError(null);
          }}
          placeholder="Search by name"
          search={{
            text,
            onText: (next) => {
              setText(next);
              if (chosen !== null && next !== chosen.name) setChosen(null);
            },
          }}
          note={note}
          inline
        />
      </div>

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
