import { Mail } from "lucide-react";
import { partnersPage } from "@/lib/partners";

// "Become a partner" (boards 31 and 31m): a glass box with the eyebrow, the
// title and the body on the left, and from md the white "Write to us" pill
// with the address under it on the right. On phones the pill is full width
// under the body, the address centred under it. The pill is the navbar
// Apply's paper pill (manifest, Components); it opens a mail to the Team.
export function BecomePartner() {
  const { eyebrow, title, body, cta, email } = partnersPage.become;
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="glass-card mx-auto flex max-w-[1312px] flex-col gap-6 rounded-xl p-6 md:flex-row md:items-center md:justify-between md:gap-12 md:p-14">
        <div className="max-w-[640px]">
          <p className="font-mono text-xs tracking-[0.3em] text-accent">{eyebrow}</p>
          <h2 className="mt-3 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] md:mt-2 md:text-[40px]">{title}</h2>
          <p className="mt-4 text-[15px] leading-[1.6] text-text-2 md:text-[16px]">{body}</p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-4 md:items-end">
          <a
            href={`mailto:${email}`}
            className="inline-flex items-center justify-center gap-2.5 rounded-full bg-prt-text px-6 py-3 text-[15px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 md:py-2.5"
          >
            {cta}
            <Mail aria-hidden className="h-4 w-4" />
          </a>
          <p className="text-center font-mono text-[12px] text-prt-muted md:text-right">{email}</p>
        </div>
      </div>
    </section>
  );
}
