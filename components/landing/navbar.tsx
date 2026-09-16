import Image from "next/image";
import Link from "next/link";

// Board 04 navbar: logo (64,24) 40x50 · links centered y47, 17px, gap 44 ·
// actions right-aligned at (1076,35): Apply = accent pill (10/24), Sign in = white-10 stroke pill (10/20).
const links = [
  { href: "/projects", label: "Projects" },
  { href: "/about/the-team", label: "About" },
  { href: "/outreach", label: "Outreach" },
  { href: "/partners", label: "Partners" },
];

export function LandingNavbar() {
  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="relative mx-auto h-[100px] w-full max-w-[1440px]">
        <Link href="/" className="absolute left-16 top-6 block h-[50px] w-[40px]">
          <Image src="/design/prt-mark.png" alt="Polito Rocket Team" width={40} height={50} priority />
        </Link>

        {/* star-dimming fade behind the link row (invisible on the black sky) */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-10px] h-[150px] w-[780px] -translate-x-1/2"
          style={{ background: "radial-gradient(ellipse 50% 50% at 50% 50%, #010101 30%, #01010100 70%)" }}
        />
        <nav className="absolute left-0 top-[47px] flex w-full items-center justify-center gap-[44px]">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-[17px] text-prt-text transition-colors hover:text-accent">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="absolute right-[64px] top-[35px] flex items-center gap-3">
          <Link
            href="/apply"
            className="rounded-full bg-accent px-6 py-2.5 text-[15px] font-semibold text-accent-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed"
          >
            Apply
          </Link>
          <Link
            href="/sign-in"
            className="rounded-full border border-white-10 px-5 py-2.5 text-[15px] font-medium text-prt-text transition-colors hover:border-border-strong"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
