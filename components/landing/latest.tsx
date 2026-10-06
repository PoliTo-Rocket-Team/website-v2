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
    "Full-duration burn on the VES test stand. Next stop: flight qualification at EuRoC 2026.",
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
    <section className="px-5 py-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end md:gap-8">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] text-accent">TRACK RECORD</p>
            <h2 className="mt-4 text-[26px] font-bold leading-[1.25] tracking-[-0.025em] md:max-w-[16ch] md:text-[48px]">
              We fly against the best student teams on earth.
            </h2>
          </div>
          <p className="max-w-[460px] text-[15px] leading-relaxed text-text-2 md:text-[17px]">
            Four international campaigns since 2021. Every vehicle designed, built and qualified
            in-house.
          </p>
        </div>

        {/* Grid: featured card + list */}
        <div className="mt-6 grid gap-5 md:mt-16 lg:grid-cols-[1.58fr_1fr]">
          {/* Featured */}
          <article className="glass-card flex flex-col justify-between rounded-xl p-5 md:p-11">
            <div>
              <TagLine post={featured} />
              <h3 className="mt-4 text-[20px] font-bold leading-[1.2] tracking-[-0.02em] md:mt-6 md:text-[34px] md:leading-snug">
                {featured.title}
              </h3>
              <p className="mt-3 max-w-[46ch] text-[14px] leading-[22px] text-text-2 md:mt-5 md:text-[17px] md:leading-relaxed">
                {featured.excerpt}
              </p>
            </div>
            {/* Fixed at 2.2:1 rather than flex-1: letting it absorb the list
                column's slack made its shape depend on the viewport. */}
            <div className="relative mt-4 h-[150px] w-full overflow-hidden rounded-[6px] md:mt-10 md:aspect-[2.2/1] md:h-auto">
              <Image
                src={featured.image}
                alt=""
                fill
                // The featured card's inner width: from lg the 1.58fr of
                // (content − 20px gap), content 100vw − 128px up to 1312px,
                // less its 2 × 44px padding; below lg the whole column.
                sizes="(min-width: 1440px) 703px, (min-width: 1024px) calc(61.2vw - 179px), (min-width: 768px) calc(100vw - 216px), calc(100vw - 80px)"
                placeholder="blur"
                blurDataURL={newsBlur[featured.image]}
                className="object-cover"
              />
            </div>
            <Link
              href="#"
              className="group/cta mt-3 inline-flex items-center gap-3 self-start text-[15px] font-medium md:mt-10 md:text-base text-accent transition-colors hover:text-accent-hover"
            >
              {featured.cta}
              <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover/cta:translate-x-1.5 group-hover/cta:opacity-100" />
            </Link>
          </article>

          {/* List */}
          <div className="flex flex-col gap-5">
            {posts.map((post, i) => (
              <article
                key={post.title}
                className={`glass-card flex-1 flex-col justify-center rounded-xl p-5 md:flex md:py-10 ${i === 0 ? "flex" : "hidden"} md:pl-10 md:pr-16 lg:min-h-[250px]`}
              >
                <TagLine post={post} />
                <h3 className="mt-3 text-[16px] font-semibold leading-[1.2] md:text-[21px] md:leading-snug">{post.title}</h3>
                <p className="mt-2 text-[14px] leading-[21px] text-text-2 md:mt-3 md:text-[17px] md:leading-relaxed">{post.excerpt}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center md:mt-16">
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
