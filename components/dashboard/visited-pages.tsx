"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { backTo, cameFrom, NO_TRAIL, visited, type BackLink, type Trail } from "@/lib/dashboard/came-from";

// The dashboard pages this tab has visited (issue #510), kept for as long as
// the tab keeps the app loaded: the dashboard shell records each page as it
// shows, and an editor's back arrow reads where it was opened from. A reload
// or a new tab loads the app afresh, with no trail.

let trail: Trail = NO_TRAIL;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Records each dashboard page as it shows. Drawn once, in the dashboard shell. */
export function VisitedPages() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === null) return;
    const next = visited(trail, pathname);
    if (next === trail) return;
    trail = next;
    for (const listener of listeners) listener();
  }, [pathname]);
  return null;
}

/** Where the back arrow of the page at `here` goes: the dashboard page it was opened from, else the dashboard home. */
export function useBackLink(here: string): BackLink {
  const from = useSyncExternalStore(
    subscribe,
    () => cameFrom(trail, here),
    // The server knows no trail; the first client render reads the same, then the trail.
    () => null,
  );
  return backTo(from, here);
}
