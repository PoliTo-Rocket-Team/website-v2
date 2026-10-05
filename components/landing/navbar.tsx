import Image from "next/image";
import Link from "next/link";
import { NavMenu, type NavLink } from "./nav-menu";

// Board 04 navbar, with board 21's logo and bar: white PRT logo (64,32)
// 220x32 · links centered y47, 17px, gap 44 · actions right-aligned at
// (1076,35): Apply = paper pill with ink text (10/24), Sign in = white-10
// stroke pill (10/20). The bar is full-width liquid glass fixed to the top
// edge (`.glass-bar`); its contents stay on the 1440 board's columns.
//
// Board 24 (phone, below md): a 64px bar with 20px sides, the PRT mark only
// (32px tall), then the Apply pill and a menu icon. The links and Sign in
// move into the menu. From md to lg the menu also stands in for the link
// row, which does not clear the logo yet; Sign in is back on the bar there.
const links: NavLink[] = [
  { href: "/projects", label: "Projects" },
  { href: "/about/the-team", label: "About" },
  { href: "/outreach", label: "Outreach" },
  { href: "/partners", label: "Partners" },
];

const menuLinks: NavLink[] = [...links, { href: "/sign-in", label: "Sign in", phoneOnly: true }];

export function LandingNavbar() {
  return (
    <header className="glass-bar fixed inset-x-0 top-0 z-40">
      <div className="relative mx-auto h-16 w-full max-w-[1440px] md:h-[100px]">
        <Link
          href="/"
          aria-label="Polito Rocket Team"
          className="absolute left-5 top-4 block md:left-16 md:top-8"
        >
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

        <nav className="absolute left-0 top-[47px] hidden w-full items-center justify-center gap-[44px] lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-[17px] text-prt-text transition-colors hover:text-accent">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="absolute right-5 top-3 flex items-center gap-1.5 md:right-[64px] md:top-[35px] md:gap-3">
          <Link
            href="/apply"
            className="rounded-full bg-prt-text px-[18px] py-[5px] text-[15px] font-semibold text-ground transition-opacity hover:opacity-90 active:opacity-80 md:px-6 md:py-2.5"
          >
            Apply
          </Link>
          <Link
            href="/sign-in"
            className="hidden rounded-full border border-white-10 px-5 py-2.5 text-[15px] font-medium text-prt-text transition-colors hover:border-border-strong md:inline-block"
          >
            Sign in
          </Link>
          <NavMenu links={menuLinks} className="-mr-2 lg:hidden" />
        </div>
      </div>
    </header>
  );
}
