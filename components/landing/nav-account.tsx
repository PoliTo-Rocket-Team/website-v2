"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { parseNavViewer, type NavViewer } from "@/lib/nav-viewer-shape";

// The navbar's account end (issue #157, HANDOFF "Logged in: Apply +
// name+avatar"): "Sign in" for a visitor, the viewer's initials and name,
// linking to the dashboard, once signed in. Who is signed in comes from
// GET /api/viewer, asked from the browser, so the pages that carry the
// navbar never read a cookie and stay prerendered: the prerendered bar shows
// "Sign in", and a signed-in viewer's name replaces it once the answer
// lands. The answer is kept for the tab, so the next page shows it at once
// and asks again behind it.

let known: NavViewer | null = null;
let asking: Promise<void> | null = null;
const listeners = new Set<() => void>();

function ask(): void {
  asking ??= fetch("/api/viewer", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((body: unknown) => {
      known = parseNavViewer(body);
      listeners.forEach((l) => l());
    })
    .catch(() => {})
    .finally(() => {
      asking = null;
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The signed-in viewer, or null: null on the server and until the first answer. */
export function useNavViewer(): NavViewer | null {
  const viewer = useSyncExternalStore(
    subscribe,
    () => known,
    () => null,
  );
  useEffect(ask, []);
  return viewer;
}

const PILL = "rounded-full border border-white-10 font-medium text-prt-text transition-colors duration-300 ease-out hover:border-border-strong";

/** Right of the bar, from md: the ghost "Sign in" pill, or the viewer's pill of the same height. */
export function NavAccount() {
  const viewer = useNavViewer();
  if (viewer === null) {
    return (
      <Link href="/login" className={`hidden px-5 py-2.5 text-[15px] md:inline-block ${PILL}`}>
        Sign in
      </Link>
    );
  }
  return (
    <Link
      href="/dashboard"
      className={`hidden items-center gap-2.5 py-[7px] pl-[7px] pr-4 text-[15px] md:inline-flex ${PILL}`}
    >
      <Avatar name={viewer.name} size="sm" accent />
      <span className="max-w-[180px] truncate">{viewer.name}</span>
    </Link>
  );
}

/** The sidebar foot (board 24b): the full-width "Sign in", or the viewer's pill in its place. */
export function NavMenuAccount({ viewer }: { viewer: NavViewer | null }) {
  if (viewer === null) {
    return (
      <Link href="/login" className={`block py-3 text-center text-base ${PILL}`}>
        Sign in
      </Link>
    );
  }
  return (
    <Link href="/dashboard" className={`flex items-center justify-center gap-2.5 py-[10px] text-base ${PILL}`}>
      <Avatar name={viewer.name} size="sm" accent />
      <span className="min-w-0 truncate">{viewer.name}</span>
    </Link>
  );
}
