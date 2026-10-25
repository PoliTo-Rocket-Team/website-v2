import { PageHeader } from "@/components/about/page-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import type { DataRow, LegalBlock, LegalDocument, LegalSection } from "@/lib/legal/types";

// The Terms of Service and the Privacy Policy (issue #122): one template for
// both. The About page header, then the text on the page sky: from lg a
// sticky column with the date and the section list beside the sections, on
// phones the date and the sections only. The sections are numbered from their
// order, 01, 02 ... No apply band: the footer sits in the sky.

const label = "font-mono text-[10px] tracking-[0.2em] text-prt-muted md:text-[11px]";
const body = "text-[16px] leading-[1.75] text-text-2 md:text-[17px] md:leading-[1.8]";

function updatedOf(iso: LegalDocument["updated"]): string {
  return new Date(`${iso}T00:00:00Z`)
    .toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();
}

const number = (i: number) => String(i + 1).padStart(2, "0");

export function LegalPage({ doc }: { doc: LegalDocument }) {
  const updated = (
    <p className={label}>
      LAST UPDATED <time dateTime={doc.updated} className="text-prt-text">{updatedOf(doc.updated)}</time>
    </p>
  );
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pt-16 md:pt-[72px]">
          <PageHeader {...doc.header} />
          <div className="px-5 md:px-16">
            <div className="mx-auto mt-12 max-w-[1312px] border-t border-white-10 pt-8 md:mt-16 md:pt-12 lg:grid lg:grid-cols-[280px_minmax(0,760px)] lg:gap-x-24">
              <aside className="lg:sticky lg:top-[120px] lg:self-start">
                {updated}
                <nav aria-label="On this page" className="mt-10 hidden lg:block">
                  <p className={label}>ON THIS PAGE</p>
                  <ol className="mt-4 space-y-3">
                    {doc.sections.map((s, i) => (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          className="group flex gap-3 text-[14px] leading-[1.4] text-text-2 transition-colors duration-300 ease-out hover:text-accent"
                        >
                          <span className="font-mono text-[11px] leading-[1.6] tracking-[0.1em] text-dim transition-colors duration-300 ease-out group-hover:text-accent">
                            {number(i)}
                          </span>
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </aside>
              <div className="mt-10 space-y-14 lg:mt-0 md:space-y-16">
                {doc.sections.map((s, i) => (
                  <Section key={s.id} section={s} num={number(i)} />
                ))}
              </div>
            </div>
          </div>
        </main>
        <SiteFooter inSky />
      </PageSky>
    </div>
  );
}

function Section({ section, num }: { section: LegalSection; num: string }) {
  return (
    // scroll-mt: an anchor jump stops below the fixed navbar.
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24 md:scroll-mt-32">
      <p className="font-mono text-xs tracking-[0.2em] text-accent">{num}</p>
      <h2
        id={`${section.id}-title`}
        className="mt-3 text-[22px] font-bold leading-[1.25] tracking-[-0.02em] text-prt-text md:text-[28px]"
      >
        {section.title}
      </h2>
      <div className="mt-5 space-y-5 md:mt-6">
        {section.blocks.map((b, i) => (
          <Block key={i} block={b} />
        ))}
      </div>
    </section>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "paragraph":
      return <p className={body}>{block.text}</p>;
    case "list":
      return (
        <ul className={`${body} list-disc space-y-2 pl-5 marker:text-dim`}>
          {block.items.map((item) => (
            <li key={item} className="pl-1">
              {item}
            </li>
          ))}
        </ul>
      );
    case "data":
      return (
        <ul className="glass-card overflow-hidden rounded-xl">
          {block.rows.map((row) => (
            <Row key={row.what} row={row} />
          ))}
        </ul>
      );
  }
}

function Row({ row }: { row: DataRow }) {
  return (
    <li className="grid gap-5 border-t border-white-10 p-5 first:border-t-0 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8 md:p-7">
      <div>
        <h3 className="text-[17px] font-semibold leading-[1.3] text-prt-text md:text-[18px]">{row.what}</h3>
        <ul className="mt-3 space-y-1.5 text-[14px] leading-[1.55] text-text-2 md:text-[15px]">
          {row.fields.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
      <dl className="space-y-4">
        <div>
          <dt className={label}>WHERE IT IS KEPT</dt>
          <dd className="mt-1.5 text-[14px] leading-[1.6] text-text-2 md:text-[15px]">{row.where}</dd>
        </div>
        <div>
          <dt className={label}>WHO CAN SEE IT</dt>
          <dd className="mt-1.5 text-[14px] leading-[1.6] text-text-2 md:text-[15px]">{row.who}</dd>
        </div>
      </dl>
    </li>
  );
}
