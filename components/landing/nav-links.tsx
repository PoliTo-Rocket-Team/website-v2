"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrentLink, type NavLink } from "./nav-menu";

// The navbar's link row from lg. On a page under one of the links (board 26:
// About on /about/the-team) that link is paper and the rest grey; on a page
// under none, the homepage among them, every link is paper, as board 21 draws.
export function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  const anyCurrent = links.some((l) => isCurrentLink(pathname, l.href));
  return (
    <>
      {links.map((l) => {
        const current = isCurrentLink(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current ? "page" : undefined}
            className={`pointer-events-auto text-[17px] transition-colors hover:text-accent ${
              current ? "font-medium text-prt-text" : anyCurrent ? "text-text-2" : "text-prt-text"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
