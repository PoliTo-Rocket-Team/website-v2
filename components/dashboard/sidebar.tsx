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
import type { DashboardPageKey, NavSection } from "@/lib/dashboard/access";
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

// Boards 40 to 46: the PRT mark and "Dashboard", the viewer's groups of
// pages (a small mono heading over each group but the first), and the user
// card at the foot. The current page sits on white-5 with its icon in accent.
export function Sidebar({
  viewer,
  sections,
  onNavigate,
}: {
  viewer: DashboardViewer;
  sections: readonly NavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col px-3 pb-3">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex h-[76px] shrink-0 items-center gap-3 px-2.5 text-[15px] font-semibold"
      >
        <Image src="/brand/prt-mark-white.svg" alt="" width={444} height={220} className="h-8 w-auto" />
        Dashboard
      </Link>

      <nav aria-label="Dashboard" className="flex-1 overflow-y-auto">
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

      <UserCard viewer={viewer} />
    </div>
  );
}
