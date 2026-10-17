"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  CircleHelp,
  CircleUserRound,
  GraduationCap,
  Handshake,
  History,
  Inbox,
  KeyRound,
  LayoutGrid,
  Megaphone,
  Network,
  Rocket,
  ShoppingCart,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { DashboardPageKey, MenuPage, NavSection } from "@/lib/dashboard/access";
import type { DashboardViewer } from "@/lib/dashboard/viewer";
import { UserCard, type UserMenuForm } from "./user-card";

const ICONS: Readonly<Record<DashboardPageKey, LucideIcon>> = {
  overview: LayoutGrid,
  "my-profile": CircleUserRound,
  "team-tree": Network,
  positions: BriefcaseBusiness,
  applications: Inbox,
  members: Users,
  alumni: GraduationCap,
  "my-alumni": GraduationCap,
  projects: Rocket,
  outreach: Megaphone,
  partners: Handshake,
  faq: CircleHelp,
  "team-page": UsersRound,
  orders: ShoppingCart,
  "division-access": KeyRound,
  "activity-log": History,
  "my-applications": Inbox,
  "my-account": CircleUserRound,
};

/** Which ends of the nav have pages scrolled past them. */
type Overflow = { top: boolean; bottom: boolean };

/** How far the nav fades out at an end with more pages past it; `scroll-py-8` keeps a focused page clear of it. */
const FADE = 32;

/** The fade on each end of the nav with more pages past it; none when it all fits. */
function maskOf({ top, bottom }: Overflow): string | undefined {
  if (!top && !bottom) return undefined;
  const from = top ? `transparent 0, black ${FADE}px` : "black 0";
  const to = bottom ? `black calc(100% - ${FADE}px), transparent 100%` : "black 100%";
  return `linear-gradient(to bottom, ${from}, ${to})`;
}

/**
 * The nav's overflow, kept current as it scrolls or resizes, and the current
 * page brought into view when it sits past an end (issue #353): on a short
 * screen the nav scrolls on its own between the title and the user card.
 */
function useNavOverflow(pathname: string | null) {
  const ref = useRef<HTMLElement>(null);
  const [overflow, setOverflow] = useState<Overflow>({ top: false, bottom: false });

  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const update = () =>
      setOverflow({
        top: nav.scrollTop > 1,
        bottom: nav.scrollTop + nav.clientHeight < nav.scrollHeight - 1,
      });
    update();
    nav.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(nav);
    return () => {
      nav.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, []);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  return { ref, overflow };
}

/** Overview is current on /dashboard only; any other page also on the pages under it. */
function isCurrent(pathname: string | null, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

// Boards 51b, 52 and 56: the full PRT logo, linking to the site home, then
// the "Dashboard" title on the group headings' left edge, 22px apart; then
// the viewer's groups of pages (a small mono heading over each group but the
// first), and the user card and its menu at the foot. On a short screen the
// nav scrolls on its own, faded at an end with more pages past it, and the
// user card stays pinned at the foot. The current page sits
// on white-5 with its icon in accent. On phones it is the menu sheet (board
// 50m-b): the same column with a close button beside the logo, and the user
// card opens its menu as a bottom sheet.
export function Sidebar({
  viewer,
  sections,
  menuPage,
  userMenu,
  onNavigate,
  close,
}: {
  viewer: DashboardViewer;
  sections: readonly NavSection[];
  menuPage: MenuPage | null;
  userMenu: UserMenuForm;
  onNavigate?: () => void;
  /** The sheet's close button, beside the logo; the fixed sidebar has none. */
  close?: ReactNode;
}) {
  const pathname = usePathname();
  const nav = useNavOverflow(pathname);
  return (
    <div className="flex h-full flex-col px-3 pb-[18px] pt-6">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <Link
          href="/"
          aria-label="PoliTo Rocket Team home"
          className="block w-[220px] min-w-0 max-w-full shrink rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white-10"
        >
          <Image src="/brand/prt-logo-white.svg" alt="" width={943} height={137} priority className="h-auto w-full" />
        </Link>
        {close}
      </div>
      <p className="mt-[22px] shrink-0 text-[18px] font-bold leading-5">Dashboard</p>

      <nav
        ref={nav.ref}
        aria-label="Dashboard"
        style={{ maskImage: maskOf(nav.overflow), WebkitMaskImage: maskOf(nav.overflow) }}
        className="mt-[22px] min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections.map((section) => (
          <div key={section.group} className={section.label ? "mt-6" : ""}>
            {section.label && (
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-dim">{section.label}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.key];
                const current = isCurrent(pathname, item.href);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={current ? "page" : undefined}
                      className={`flex h-8 items-center gap-3 rounded-lg px-2.5 text-[14px] transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text focus-visible:outline focus-visible:outline-1 focus-visible:outline-white-10 ${
                        current ? "bg-white-5 text-prt-text" : "text-text-2"
                      }`}
                    >
                      <Icon aria-hidden className={`h-4 w-4 shrink-0 ${current ? "text-accent" : ""}`} strokeWidth={1.75} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.count !== null && (
                        <span className="flex h-4 min-w-5 items-center justify-center rounded-full bg-accent-soft px-1.5 font-mono text-[10px] text-accent">
                          {item.count}
                          <span className="sr-only"> new</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <UserCard viewer={viewer} menuPage={menuPage} form={userMenu} onNavigate={onNavigate} />
    </div>
  );
}
