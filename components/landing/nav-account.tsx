"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore, type ComponentProps } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ExternalLink, LayoutDashboard, LogOut } from "lucide-react";
import { Avatar } from "@/components/dashboard/avatar";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/components/use-sign-out";
import { parseNavViewer, type NavViewer } from "@/lib/nav-viewer-shape";
import { PAGES, WIKI, opensOf } from "@/lib/landing-links";

// The navbar's account end. A visitor sees "Sign in" (issue #157). Once
// signed in, the viewer's round avatar opens a menu with Dashboard, Wiki and
// Log out (board 01b, issues #261, #683). Who is signed in comes from GET /api/viewer,
// asked from the browser, so the pages that carry the navbar never read a
// cookie and stay prerendered: the prerendered bar shows "Sign in", and the
// avatar replaces it once the answer lands. The answer is kept for the tab,
// so the next page shows it at once and asks again behind it.

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

// Both "Sign in" pills share the outline of board 04; the bar's is as tall as the avatar's place.
const PILL = "items-center rounded-full border border-white-10 font-medium text-prt-text transition-colors duration-300 ease-out hover:border-border-strong";
const BAR = `hidden h-11 px-5 text-[15px] md:inline-flex ${PILL}`;
const FOOT = `flex h-[50px] justify-center text-base ${PILL}`;

/** Right of the bar: the ghost "Sign in" pill from md, or, signed in, the avatar and its menu at every width. */
export function NavAccount() {
  const viewer = useNavViewer();
  if (viewer === null) {
    return (
      <Link href={PAGES.login} className={BAR}>
        Sign in
      </Link>
    );
  }
  return <AccountMenu viewer={viewer} />;
}

const ITEM =
  "flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] outline-none transition-colors data-[highlighted]:bg-white-5";

/**
 * Board 01b: a 38px avatar (photo, else the PRT mark on the accent) that opens a
 * menu below it, aligned right: who is signed in (the sign-in address), then
 * Dashboard, Wiki and a red Log out. It is the repo's Radix dropdown, so Escape, an outside click,
 * focus and arrow keys come with it. The avatar wears an accent ring while
 * the menu is open.
 */
function AccountMenu({ viewer }: { viewer: NavViewer }) {
  const signOut = useSignOut();
  const logOut = async () => {
    await signOut();
    ask();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex shrink-0 rounded-full ring-offset-1 ring-offset-ground transition-shadow duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white-10 data-[state=open]:ring-2 data-[state=open]:ring-accent"
      >
        <Avatar person={viewer} size="nav" accent />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          align="end"
          alignOffset={-20}
          sideOffset={25}
          collisionPadding={12}
          className="z-50 w-60 rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          <DropdownMenuPrimitive.Label className="px-2.5 pb-2.5 pt-2">
            <span className="block truncate text-[14px] font-semibold">{viewer.name}</span>
            <span className="mt-0.5 block truncate text-[12px] font-normal text-prt-muted">{viewer.email}</span>
          </DropdownMenuPrimitive.Label>
          <DropdownMenuPrimitive.Separator className="-mx-1.5 mb-1 h-px bg-hairline" />
          <DropdownMenuPrimitive.Item asChild>
            <Link href={PAGES.dashboard} className={`${ITEM} text-text-2 data-[highlighted]:text-prt-text`}>
              <LayoutDashboard aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              Dashboard
            </Link>
          </DropdownMenuPrimitive.Item>
          <DropdownMenuPrimitive.Item asChild>
            <a href={WIKI} {...opensOf(WIKI)} className={`${ITEM} text-text-2 data-[highlighted]:text-prt-text`}>
              <ExternalLink aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              Wiki
            </a>
          </DropdownMenuPrimitive.Item>
          <DropdownMenuPrimitive.Item onSelect={() => void logOut()} className={`${ITEM} text-danger`}>
            <LogOut aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Log out
          </DropdownMenuPrimitive.Item>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

/**
 * The sidebar foot (board 24b) for a visitor: the full-width "Sign in". Signed
 * in, the menu has no foot: the avatar on the bar carries the account.
 * The menu wraps it in `DialogClose asChild`, which hands down the close
 * `onClick` and a `ref`; they go onto the link, so a click closes the menu.
 */
export function NavMenuSignIn(link: Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link {...link} href={PAGES.login} className={FOOT}>
      Sign in
    </Link>
  );
}
