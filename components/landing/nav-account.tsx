"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore, type ComponentProps } from "react";
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

// Both ends of each place share one height, so swapping them moves nothing.
const PILL = "items-center rounded-full border border-white-10 font-medium text-prt-text transition-colors duration-300 ease-out hover:border-border-strong";
const BAR = `hidden h-11 text-[15px] md:inline-flex ${PILL}`;
const FOOT = `flex h-[50px] justify-center text-base ${PILL}`;

/** Right of the bar, from md: the ghost "Sign in" pill, or the viewer's pill of the same height. */
export function NavAccount() {
  const viewer = useNavViewer();
  if (viewer === null) {
    return (
      <Link href="/login" className={`px-5 ${BAR}`}>
        Sign in
      </Link>
    );
  }
  return (
    <Link
      href="/dashboard"
      className={`gap-2.5 pl-[7px] pr-4 ${BAR}`}
    >
      <Avatar name={viewer.name} size="sm" accent />
      <span className="max-w-[180px] truncate">{viewer.name}</span>
    </Link>
  );
}

/**
 * The sidebar foot (board 24b): the full-width "Sign in", or the viewer's pill in its place.
 * The menu wraps it in `DialogClose asChild`, which hands down the close
 * `onClick` and a `ref`; they go onto the link, so a click closes the menu.
 */
export function NavMenuAccount({
  viewer,
  ...link
}: { viewer: NavViewer | null } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  if (viewer === null) {
    return (
      <Link {...link} href="/login" className={FOOT}>
        Sign in
      </Link>
    );
  }
  return (
    <Link {...link} href="/dashboard" className={`gap-2.5 px-5 ${FOOT}`}>
      <Avatar name={viewer.name} size="sm" accent />
      <span className="min-w-0 truncate">{viewer.name}</span>
    </Link>
  );
}
