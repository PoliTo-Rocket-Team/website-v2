import Image from "next/image";
import Link from "next/link";

// Board 21, apply band: the accent with the apply-band texture multiplied on
// top at 60%. The headline is centred against the right block, which is the
// taller of the two. The eyebrow is just "APPLY", with no year, at every
// width. Board 24 below md: stacked, 20px sides, 64px top and bottom, a 44px
// heading and a full-width "Apply to join" button.
export function ApplyBand() {
  return (
    <section className="relative isolate overflow-hidden bg-accent px-5 py-section text-accent-on-accent md:px-16">
      <Image
        src="/textures/apply-band.webp"
        alt=""
        fill
        sizes="100vw"
        className="-z-10 object-cover opacity-60 mix-blend-multiply"
      />
      <div className="mx-auto flex max-w-[1312px] flex-col justify-between gap-6 md:gap-12 lg:flex-row lg:items-center">
        <div className="lg:shrink-0">
          <p className="font-mono text-xs tracking-[0.3em]">APPLY</p>
          <h2 className="mt-4 text-[44px] font-extrabold leading-[0.95] tracking-[-0.035em] md:text-6xl md:leading-[0.95] xl:text-[80px]">
            Build the
            <br className="hidden md:inline" /> next one with us.
          </h2>
        </div>

        <div className="md:max-w-[480px] xl:mr-[60px]">
          <p className="text-[17px] leading-normal md:text-[22px]">
            Open to every Politecnico student. No rocketry experience needed. We learn together.
          </p>
          <Link
            href="/apply"
            className="mt-6 block rounded-full bg-ground px-10 py-[13px] text-center text-[17px] md:mt-8 md:inline-block md:py-[17px] font-semibold text-prt-text transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            Apply to join
          </Link>
        </div>
      </div>
    </section>
  );
}
