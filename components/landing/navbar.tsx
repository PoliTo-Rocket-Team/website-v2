import Image from "next/image";
import Link from "next/link";
import { NavLinks } from "./nav-links";
import { NavMenu, type NavLink } from "./nav-menu";

// Board 04 navbar, with board 21's logo and bar: a 72px bar, white PRT logo
// 220px wide at x64 · links centred on the page, 17px, gap 44 · actions
// right-aligned at x1376: Apply = paper pill with ink text (10/24), Sign in =
// white-10 stroke pill (10/20). Logo, links and actions are all centred on
// the bar's middle by flex, not by offsets. The bar is full-width liquid
// glass fixed to the top edge (`.glass-bar`); its contents stay on the 1440
// board's columns.
//
// Board 24 (phone, below md): a 64px bar with 20px sides, the PRT mark only
// (32px tall) and a menu icon. No Apply or Sign in on the bar: both live in
// the board 24b sidebar with the links (nav-menu.tsx). From md to lg the menu
// also stands in for the link row, which does not clear the logo yet; Apply
// and Sign in are back on the bar there. From lg, About opens the board 27
// hover menu of the About pages (nav-hover-menu.tsx); the other links have
// none (Projects has its own page).
const links: NavLink[] = [
  { href: "/projects", label: "Projects" },
  {
    label: "About",
    pages: [
      { href: "/about/the-team", label: "The Team" },
      { href: "/about/alumni", label: "Alumni" },
      { href: "/about/our-university", label: "Our University" },
      { href: "/about/mission-vision", label: "Mission & Vision" },
    ],
  },
  { href: "/outreach", label: "Outreach" },
  { href: "/partners", label: "Partners" },
];

export function LandingNavbar() {
  return (
    <header className="glass-bar fixed inset-x-0 top-0 z-40">
      <div className="relative mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-5 md:h-[72px] md:px-16">
        <Link href="/" aria-label="Polito Rocket Team" className="relative z-10 block">
          <Image
            src="/brand/prt-mark-white.svg"
            alt=""
            width={444}
            height={220}
            priority
            className="h-8 w-auto md:hidden"
          />
          <Image
            src="/brand/prt-logo-white.svg"
            alt=""
            width={943}
            height={137}
            priority
            className="hidden h-auto w-[220px] md:block"
          />
        </Link>

        {/* Centred on the page, not between logo and actions: the row spans
            the bar, and only its links take the pointer. */}
        <nav className="pointer-events-none absolute inset-0 hidden items-center justify-center gap-[44px] lg:flex">
          <NavLinks links={links} />
        </nav>

        <div className="relative z-10 flex items-center md:gap-3">
          <Link
            href="/apply"
            className="hidden rounded-full bg-prt-text px-6 py-2.5 text-[15px] font-semibold text-ground transition-opacity hover:opacity-90 active:opacity-80 md:inline-block"
          >
            Apply
          </Link>
          <Link
            href="/login"
            className="hidden rounded-full border border-white-10 px-5 py-2.5 text-[15px] font-medium text-prt-text transition-colors hover:border-border-strong md:inline-block"
          >
            Sign in
          </Link>
          <NavMenu links={links} className="-mr-2 lg:hidden" />
        </div>
      </div>
    </header>
  );
}
