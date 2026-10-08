"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RocketArrow } from "./rocket-arrow";

export type NavPage = { href: string; label: string };
/**
 * A navbar entry with pages under it (About). It has no page of its own: it
 * opens a hover menu from lg and lists its pages in the sidebar.
 */
export type NavSection = { label: string; pages: readonly [NavPage, ...NavPage[]] };
export type NavLink = NavPage | NavSection;

/** A link is current on its own page and on every page under it. */
export function isCurrentLink(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/** A link is current on its page and the pages under it; a section, on any of its pages (About on /about/alumni). */
export function isCurrentNavLink(pathname: string | null, link: NavLink): boolean {
  return "pages" in link ? link.pages.some((p) => isCurrentLink(pathname, p.href)) : isCurrentLink(pathname, link.href);
}

// Board 24b: below the width where the link row fits, the menu icon opens a
// 330px glass sidebar from the right, full height, over a dimmed page. Top:
// the PRT mark and a close icon. Then the links at 28px with a RocketArrow,
// the current page in accent. A link with pages under it (About) lists them
// below it, indented, at 17px in grey. At the foot: the white "Apply" and the outlined
// "Sign in", with no email. It is the repo's Radix dialog
// (components/ui/dialog), so focus, Escape and scroll lock come with it; the
// content is the primitive itself because the shadcn DialogContent is a
// centred modal. It slides in and goes at once on close, so Radix unmounts it
// without waiting on an `animationend` that a frameless tab never sends
// (issue #79); the slide runs only under `motion-safe:` (issue #80).
export function NavMenu({ links, className }: { links: NavLink[]; className?: string }) {
  const pathname = usePathname();
  return (
    <Dialog>
      <DialogTrigger
        aria-label="Open menu"
        className={`flex h-10 w-10 items-center justify-center rounded-full text-prt-text transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white-10 ${className ?? ""}`}
      >
        <Menu aria-hidden className="h-6 w-6" strokeWidth={2} />
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="bg-ground/55 backdrop-blur-[3px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="glass-sidebar fixed inset-y-0 right-0 z-50 flex w-[330px] max-w-full flex-col pb-8 pl-7 pr-6 text-prt-text duration-300 ease-out focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-right"
        >
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <div className="flex h-16 shrink-0 items-center justify-between">
            <DialogClose asChild>
              <Link href="/" aria-label="Polito Rocket Team, home">
                <Image src="/brand/prt-mark-white.svg" alt="" width={444} height={220} className="h-8 w-auto" />
              </Link>
            </DialogClose>
            <DialogClose
              aria-label="Close menu"
              className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white-10"
            >
              <X aria-hidden className="h-6 w-6" strokeWidth={2} />
            </DialogClose>
          </div>

          <nav className="mt-9">
            <ul>
              {links.map((l) => {
                const current = isCurrentNavLink(pathname, l);
                return (
                  <li key={l.label} className="border-b border-white-10">
                    {"pages" in l ? (
                      // A section is a heading over its pages, not a link.
                      <p className={`flex h-[66px] items-center text-[28px] font-bold tracking-[-0.02em] ${current ? "text-accent" : ""}`}>
                        {l.label}
                      </p>
                    ) : (
                      <DialogClose asChild>
                        <Link
                          href={l.href}
                          aria-current={current ? "page" : undefined}
                          className={`group flex h-[66px] items-center justify-between text-[28px] font-bold tracking-[-0.02em] transition-colors hover:text-accent ${current ? "text-accent" : ""}`}
                        >
                          {l.label}
                          <RocketArrow className="text-[15px] opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
                        </Link>
                      </DialogClose>
                    )}
                    {"pages" in l && (
                      <ul className="-mt-1.5 pb-3 pl-5">
                        {l.pages.map((p) => {
                          const currentPage = isCurrentLink(pathname, p.href);
                          return (
                            <li key={p.href}>
                              <DialogClose asChild>
                                <Link
                                  href={p.href}
                                  aria-current={currentPage ? "page" : undefined}
                                  className={`flex h-10 items-center text-[17px] transition-colors hover:text-accent ${currentPage ? "text-accent" : "text-text-2"}`}
                                >
                                  {p.label}
                                </Link>
                              </DialogClose>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto flex flex-col gap-3">
            <DialogClose asChild>
              <Link
                href="/apply"
                className="block rounded-full bg-prt-text py-3 text-center text-base font-semibold text-ground transition-opacity hover:opacity-90 active:opacity-80"
              >
                Apply
              </Link>
            </DialogClose>
            <DialogClose asChild>
              <Link
                href="/sign-in"
                className="block rounded-full border border-white-10 py-3 text-center text-base font-medium transition-colors hover:border-border-strong"
              >
                Sign in
              </Link>
            </DialogClose>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
