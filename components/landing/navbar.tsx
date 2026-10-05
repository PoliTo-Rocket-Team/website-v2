import Image from "next/image";
import Link from "next/link";

// Board 04 navbar, with board 21's logo and bar: white PRT logo (64,32)
// 220x32 · links centered y47, 17px, gap 44 · actions right-aligned at
// (1076,35): Apply = paper pill with ink text (10/24), Sign in = white-10
// stroke pill (10/20). The bar is full-width liquid glass fixed to the top
// edge (`.glass-bar`); its contents stay on the 1440 board's columns.
const links = [
  { href: "/projects", label: "Projects" },
  { href: "/about/the-team", label: "About" },
  { href: "/outreach", label: "Outreach" },
  { href: "/partners", label: "Partners" },
];

export function LandingNavbar() {
  return (
    <header className="glass-bar fixed inset-x-0 top-0 z-40">
      <div className="relative mx-auto h-16 w-full max-w-[1440px] md:h-[100px]">
        <Link href="/" className="absolute left-6 top-[23px] block md:left-16 md:top-8">
          <Image
            src="/brand/prt-logo-white.svg"
            alt="Polito Rocket Team"
            width={943}
            height={137}
            priority
            className="h-auto w-[120px] md:w-[220px]"
          />
        </Link>

        {/* The board has no mobile frame. Below md the bar is 64px and shows
            the logo and actions only, and the link row waits for lg, where it
            clears the logo. */}
        <nav className="absolute left-0 top-[47px] hidden w-full items-center justify-center gap-[44px] lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-[17px] text-prt-text transition-colors hover:text-accent">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="absolute right-6 top-3 flex items-center gap-2 md:right-[64px] md:top-[35px] md:gap-3">
          <Link
            href="/apply"
            className="rounded-full bg-prt-text px-4 py-2 text-[14px] font-semibold md:px-6 md:py-2.5 md:text-[15px] text-ground transition-opacity hover:opacity-90 active:opacity-80"
          >
            Apply
          </Link>
          <Link
            href="/sign-in"
            className="rounded-full border border-white-10 px-4 py-2 text-[14px] font-medium md:px-5 md:py-2.5 md:text-[15px] text-prt-text transition-colors hover:border-border-strong"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
