import Link from "next/link";

// Board 09 — Apply band. Orange ground, dark type. Positions note is a live count
// from the dashboard positions table later; hidden at 0.
export function ApplyBand() {
  const openPositions = 6; // TODO: live count from db
  return (
    <section className="bg-accent px-6 py-24 text-accent-on-accent md:px-16">
      <div className="mx-auto flex max-w-[1312px] flex-col justify-between gap-12 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] opacity-70">APPLY</p>
          <h2 className="mt-4 text-5xl font-bold tracking-tight md:text-6xl">Build with us.</h2>
        </div>

        <div className="max-w-[420px]">
          <p className="text-base font-medium leading-relaxed">
            Open to every student. No rocketry experience required. We learn together.
          </p>
          <Link
            href="/apply"
            className="mt-8 inline-block rounded-full bg-ground px-8 py-3.5 text-sm font-semibold text-prt-text transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            Apply to join
          </Link>
          {openPositions > 0 && (
            <p className="mt-4 font-mono text-xs tracking-widest opacity-70">
              {openPositions} POSITIONS OPEN NOW
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
