import Link from "next/link";

// Boards 26 and 26m: the About pages' tabs under the navbar, the current one
// in paper with an accent rule under it, the rest in grey, all over one
// hairline. On phones the row is wider than the screen, so it scrolls on its
// own, with no scrollbar, as board 26m draws it running off the right edge.
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
    <nav aria-label="About" className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex min-w-max gap-6 border-b border-white-10 md:min-w-0 md:gap-8">
        {tabs.map((t) => {
          const isCurrent = t.href === current;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`-mb-px block border-b-2 py-[18px] text-[15px] transition-colors duration-300 ease-out md:py-6 ${
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
