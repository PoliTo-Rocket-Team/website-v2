"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  CircleUserRound,
  GraduationCap,
  Inbox,
  KeyRound,
  LayoutGrid,
  Network,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { DashboardPageKey, MenuPage, NavSection } from "@/lib/dashboard/access";
import type { DashboardViewer } from "@/lib/dashboard/viewer";
import { UserCard } from "./user-card";

const ICONS: Readonly<Record<DashboardPageKey, LucideIcon>> = {
  overview: LayoutGrid,
  "my-profile": CircleUserRound,
  "team-tree": Network,
  positions: BriefcaseBusiness,
  applications: Inbox,
  members: Users,
  alumni: GraduationCap,
  orders: ShoppingCart,
  "division-access": KeyRound,
  "my-applications": Inbox,
  "my-account": CircleUserRound,
};

/** Overview is current on /dashboard only; any other page also on the pages under it. */
function isCurrent(pathname: string | null, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

// Boards 51b, 52 and 56: the full PRT logo, linking to the site home, then
// the "Dashboard" title on the group headings' left edge, 22px apart; then
// the viewer's groups of pages (a small mono heading over each group but the
// first), and the user card and its menu at the foot. The current page sits
// on white-5 with its icon in accent.
export function Sidebar({
  viewer,
  sections,
  menuPage,
  onNavigate,
}: {
  viewer: DashboardViewer;
  sections: readonly NavSection[];
  menuPage: MenuPage | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col px-3 pb-[18px] pt-6">
      <Link
        href="/"
        aria-label="PoliTo Rocket Team home"
        className="block w-[220px] max-w-full shrink-0 rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white-10"
      >
        <Image src="/brand/prt-logo-white.svg" alt="" width={943} height={137} priority className="h-auto w-full" />
      </Link>
      <p className="mt-[22px] shrink-0 text-[18px] font-bold leading-5">Dashboard</p>

      <nav aria-label="Dashboard" className="mt-[22px] flex-1 overflow-y-auto">
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

      <UserCard viewer={viewer} menuPage={menuPage} onNavigate={onNavigate} />
    </div>
  );
}
