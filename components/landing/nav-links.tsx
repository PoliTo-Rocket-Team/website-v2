"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavHoverMenu } from "./nav-hover-menu";
import { isCurrentNavLink, type NavLink } from "./nav-menu";

// The navbar's link row from lg. On a page under one of the links (board 26:
// About on /about/the-team) that link is paper and the rest grey; on a page
// under none, the homepage among them, every link is paper, as board 21 draws.
// A link with pages under it (About) opens its board 27 hover menu.
export function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  const anyCurrent = links.some((l) => isCurrentNavLink(pathname, l));
  return (
    <>
      {links.map((l) => {
        const current = isCurrentNavLink(pathname, l);
        const className = `pointer-events-auto text-[17px] transition-colors hover:text-accent ${
          current ? "font-medium text-prt-text" : anyCurrent ? "text-text-2" : "text-prt-text"
        }`;
        if ("pages" in l) return <NavHoverMenu key={l.label} section={l} className={className} />;
        return (
          <Link key={l.href} href={l.href} aria-current={current ? "page" : undefined} className={className}>
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
