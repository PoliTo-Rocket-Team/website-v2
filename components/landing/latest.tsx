import Link from "next/link";

// Board 05 — "Latest" (track record). Posts will come from the dashboard posts table;
// static seed data until that lands.
const tagStyles: Record<string, string> = {
  LAUNCH: "bg-accent-soft text-accent",
  COMPETITION: "bg-warning-soft text-warning",
  OUTREACH: "bg-success-soft text-success",
  TEAM: "bg-white-10 text-prt-text",
};

const featured = {
  tag: "LAUNCH",
  date: "12 OCT 2025",
  title: "VES Mark II static fire complete",
  excerpt:
    "Full-duration burn on the VES test stand. Next stop: flight qualification at EuRoC 2026.",
  cta: "Read the record",
};

const posts = [
  {
    tag: "COMPETITION",
    date: "24 JUN 2025",
    title: "1st place Design & Build at IREC 2025",
    excerpt: "Out of 140+ universities at Spaceport America, New Mexico.",
  },
  {
    tag: "OUTREACH",
    date: "03 MAY 2025",
    title: "Rockets in classrooms: Liceo Cattaneo",
    excerpt: "A morning of model rockets and Q&A with 80 high-school students.",
  },
  {
    tag: "TEAM",
    date: "15 MAR 2025",
    title: "Recruiting is open for 2025/26",
    excerpt: "12 open positions across propulsion, avionics, structures and ops.",
  },
];

export function Latest() {
  return (
    <section className="px-6 py-24 md:px-16">
      <div className="mx-auto max-w-[1312px]">
        {/* Header */}
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-accent">TRACK RECORD</p>
            <h2 className="mt-4 max-w-[16ch] text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              We fly against the best student teams on earth.
            </h2>
          </div>
          <p className="max-w-[380px] text-sm leading-relaxed text-prt-muted">
            Four international campaigns since 2021. Every vehicle designed, built and qualified
            in-house.
          </p>
        </div>

        {/* Grid: featured card + list */}
        <div className="mt-14 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          {/* Featured */}
          <article className="group flex flex-col justify-between rounded-[10px] border border-hairline bg-panel p-10 transition-colors hover:border-border-strong">
            <div>
              <div className="flex items-center gap-4 font-mono text-xs">
                <span className={`rounded-full px-3 py-1 tracking-widest ${tagStyles[featured.tag]}`}>
                  {featured.tag}
                </span>
                <span className="text-dim">{featured.date}</span>
              </div>
              <h3 className="mt-8 text-2xl font-bold leading-snug md:text-3xl">{featured.title}</h3>
              <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-prt-muted">
                {featured.excerpt}
              </p>
            </div>
            <Link
              href="#"
              className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              {featured.cta} →
            </Link>
          </article>

          {/* List */}
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <article
                key={post.title}
                className="group rounded-[10px] border border-hairline bg-panel p-7 transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                <div className="flex items-center gap-4 font-mono text-xs">
                  <span className={`rounded-full px-3 py-1 tracking-widest ${tagStyles[post.tag]}`}>
                    {post.tag}
                  </span>
                  <span className="text-dim">{post.date}</span>
                </div>
                <h3 className="mt-4 font-semibold leading-snug">{post.title}</h3>
                <p className="mt-1.5 text-sm text-prt-muted">{post.excerpt}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="#" className="font-mono text-sm tracking-wide text-text-2 transition-colors hover:text-accent">
            All news →
          </Link>
        </div>
      </div>
    </section>
  );
}
