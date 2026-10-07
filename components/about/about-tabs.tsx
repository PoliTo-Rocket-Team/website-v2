import Link from "next/link";

// Boards 26 and 26m: the About pages' tabs under the navbar, the current one
// in paper with an accent rule under it, the rest in grey, all over one
// hairline. Board 26m draws the row running off the right edge, but the page
// may have no sideways scroll besides the departments carousel (issue #90), so
// on phones the row is spread edge to edge in smaller type and fits at 360.
// Only The Team is built; the other tabs are plain links.

const tabs = [
  { href: "/about/the-team", label: "The Team" },
  { href: "/about/alumni", label: "Alumni" },
  { href: "/about/our-university", label: "Our University" },
  { href: "/about/mission-vision", label: "Mission & Vision" },
] as const;

export type AboutTab = (typeof tabs)[number]["href"];

export function AboutTabs({ current }: { current: AboutTab }) {
  return (
    <nav aria-label="About">
      <ul className="flex justify-between gap-3 border-b border-white-10 md:justify-start md:gap-8">
        {tabs.map((t) => {
          const isCurrent = t.href === current;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`-mb-px block whitespace-nowrap border-b-2 py-[18px] text-[13px] transition-colors duration-300 ease-out md:py-6 md:text-[15px] ${
                  isCurrent ? "border-accent font-semibold text-prt-text" : "border-transparent text-prt-muted hover:text-prt-text"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
