"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** `phoneOnly` items are on the bar itself from md up, so the menu drops them there. */
export type NavLink = { href: string; label: string; phoneOnly?: boolean };

// Board 24: below the width where the link row fits, the links (and Sign in)
// move into this menu. The panel is the same liquid glass as the bar.
export function NavMenu({ links, className }: { links: NavLink[]; className?: string }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label="Menu"
        className={`flex h-10 w-10 items-center justify-center rounded-full text-prt-text transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white-10 ${className ?? ""}`}
      >
        <Menu aria-hidden className="h-6 w-6" strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="min-w-[200px] rounded-xl border-0 bg-transparent p-0 text-prt-text shadow-none"
      >
        {/* The glass sits on an inner box: the primitive's own fill classes
            are utilities and would paint over a component-layer glass fill.
            The darker tint keeps the links readable over any section. */}
        <div
          className="glass-info rounded-xl p-2"
          style={{ "--glass-tint": 0.82 } as React.CSSProperties}
        >
          {links.map((l) => (
            <DropdownMenuItem
              key={l.href}
              asChild
              className={`cursor-pointer rounded-lg px-3 py-2.5 text-[17px] focus:bg-white-5 focus:text-accent ${l.phoneOnly ? "md:hidden" : ""}`}
            >
              <Link href={l.href}>{l.label}</Link>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
