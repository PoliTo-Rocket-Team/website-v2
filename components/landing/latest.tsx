import Image from "next/image";
import Link from "next/link";
import { newsBlur } from "./news-blur";
import { RocketArrow } from "./rocket-arrow";

// Board 21, track record. Posts will come from the dashboard posts table;
// static seed data until that lands. The cards are liquid glass over the page
// sky, with no texture of their own.
type Tag = "LAUNCH" | "COMPETITION" | "OUTREACH" | "TEAM";

const tagStyles: Record<Tag, string> = {
  LAUNCH: "bg-accent-soft text-accent",
  COMPETITION: "bg-warning-soft text-warning",
  OUTREACH: "bg-success-soft text-success",
  TEAM: "bg-white-10 text-prt-text",
};

type Post = {
  tag: Tag;
  date: string;
  title: string;
  excerpt: string;
};

const featured: Post & { cta: string; image: string } = {
  tag: "LAUNCH",
  date: "12 OCT 2025",
  title: "VES Mark II static fire complete",
  excerpt:
    "Full-duration burn on the VES test stand. Next: flight qualification at EuRoC 2026.",
  image: "/design/news/team-photo.jpg",
  cta: "Read the record",
};

const posts: Post[] = [
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

function TagLine({ post }: { post: Post }) {
  return (
    <div className="flex items-center gap-4 font-mono text-[12px] md:gap-5 md:text-[13px]">
      <span className={`rounded-full px-3.5 py-1 tracking-widest ${tagStyles[post.tag]}`}>
        {post.tag}
      </span>
      <span className="tracking-wider text-prt-muted">{post.date}</span>
    </div>
  );
}

export function Latest() {
  return (
    // Board 24 below md: 20px sides, 56px top and bottom, 26px heading, one
    // column: the featured card (photo 150px tall) and only the first news
    // card (IREC 2025). The other two news cards are desktop-only.
    // Board 21 from lg: the section fits one 1440 x 900 screen below the
    // navbar, so the gaps around the cards are 40px and the cards row is
    // 560px tall.
    <section className="px-5 py-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end md:gap-8">
          <div className="md:max-w-[760px]">
            <p className="font-mono text-xs tracking-[0.3em] text-accent">TRACK RECORD</p>
            <h2 className="mt-4 text-[26px] font-bold leading-[1.25] tracking-[-0.025em] md:text-[48px]">
              <span className="md:block">We fly against the best</span> student teams on earth.
            </h2>
          </div>
          <p className="max-w-[460px] text-[15px] leading-relaxed text-text-2 md:text-[17px]">
            Four international campaigns since 2021. Every vehicle designed, built and qualified
            in-house.
          </p>
        </div>

        {/* Grid: featured card + list. From lg the row is at least 560px and
            both columns stretch to it; it grows only if the list needs more. */}
        <div className="mt-6 grid gap-5 md:mt-10 lg:grid-cols-[1.58fr_1fr] lg:grid-rows-[minmax(560px,auto)]">
          {/* Featured */}
          <article className="glass-card flex flex-col gap-3.5 rounded-xl p-5 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <TagLine post={featured} />
              <Link
                href="#"
                className="group/cta inline-flex shrink-0 items-center gap-3 text-[14px] font-medium text-accent transition-colors hover:text-accent-hover md:text-base"
              >
                {featured.cta}
                {/* No room for the arrow beside the tag line on a phone. */}
                <RocketArrow className="hidden opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover/cta:translate-x-1.5 group-hover/cta:opacity-100 md:inline-block" />
              </Link>
            </div>
            <h3 className="text-[20px] font-bold leading-[1.2] tracking-[-0.02em] md:text-[34px]">
              {featured.title}
            </h3>
            <p className="text-[14px] leading-[22px] text-text-2 md:text-[17px] md:leading-relaxed">
              {featured.excerpt}
            </p>
            {/* From lg the photo takes what the card has left after the text,
                so the card matches the list column. Below lg the card has no
                set height, so the photo keeps a fixed shape. */}
            <div className="relative h-[150px] w-full overflow-hidden rounded-[6px] md:aspect-[2.2/1] md:h-auto lg:aspect-auto lg:min-h-0 lg:flex-1">
              <Image
                src={featured.image}
                alt=""
                fill
                sizes="(min-width: 1024px) 50vw, 90vw"
                placeholder="blur"
                blurDataURL={newsBlur[featured.image]}
                className="object-cover"
              />
            </div>
          </article>

          {/* List */}
          <div className="flex flex-col gap-5 lg:gap-3">
            {posts.map((post, i) => (
              <article
                key={post.title}
                className={`glass-card flex-1 flex-col justify-center gap-2.5 rounded-xl p-5 md:flex md:p-8 lg:py-0 ${i === 0 ? "flex" : "hidden"}`}
              >
                <TagLine post={post} />
                <h3 className="text-[16px] font-semibold leading-[1.2] md:text-[21px] md:leading-snug">{post.title}</h3>
                <p className="text-[14px] leading-[21px] text-text-2 md:text-[17px] md:leading-relaxed">{post.excerpt}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center md:mt-10">
          <Link
            href="#"
            className="group inline-flex items-center gap-3 font-mono text-base tracking-wide text-prt-text transition-colors hover:text-accent"
          >
            All news
            <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
          </Link>
        </div>
      </div>
    </section>
  );
}
