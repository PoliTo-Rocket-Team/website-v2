import Image from "next/image";
import Link from "next/link";
import { newsBlur } from "./news-blur";

// Board 05 — "Latest" (track record). Posts will come from the dashboard posts table;
// static seed data until that lands.
type Tag = "LAUNCH" | "COMPETITION" | "OUTREACH" | "TEAM";

const tagStyles: Record<Tag, string> = {
  LAUNCH: "bg-accent-soft text-accent",
  COMPETITION: "bg-warning-soft text-warning",
  OUTREACH: "bg-success-soft text-success",
  TEAM: "bg-white-10 text-prt-text",
};

// A post with no photo still gets a visual, so a card can never open a hole.
// Cropped off-centre from the 2026 wallpaper set to leave the logo out.
// Warm ones only: the wallpaper set ships a grey twin of every design, and a
// grey draw made the whole section read flat.
const textures = [1, 2, 3, 4, 5, 6].map((n) => `/design/news/tex-${n}.jpg`);

// Picked from the title rather than at random: Math.random() would give the
// server and the client different answers and break hydration. Same scattered
// look, but a given post always keeps its texture.
function textureFor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) | 0;
  return textures[Math.abs(hash) % textures.length];
}

type Post = {
  tag: Tag;
  date: string;
  title: string;
  excerpt: string;
  /** A real photo of the event. Falls back to the tag's brand texture. */
  image?: string;
};

const featured: Post & { cta: string } = {
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
          <article className="group relative isolate flex flex-col justify-between overflow-hidden rounded-[10px] border border-hairline bg-panel px-10 pb-6 pt-4 transition-colors hover:border-border-strong">
            {/* Texture fills the card, same as the list cards. */}
            <Image
              src={textureFor(featured.title)}
              alt=""
              fill
              sizes="(min-width: 1024px) 55vw, 100vw"
              placeholder="blur"
              blurDataURL={newsBlur[textureFor(featured.title)]}
              className="-z-10 object-cover opacity-60 transition-opacity duration-300 group-hover:opacity-80"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-panel via-panel/70 to-panel/35" />
            <div>
              <div className="flex items-center gap-4 font-mono text-xs">
                <span className={`rounded-full px-3 py-1 tracking-widest ${tagStyles[featured.tag]}`}>
                  {featured.tag}
                </span>
                <span className="text-dim">{featured.date}</span>
              </div>
              <h3 className="mt-3 text-2xl font-bold leading-snug md:text-3xl">{featured.title}</h3>
              <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-prt-muted">
                {featured.excerpt}
              </p>
            </div>
            {/* The photo sits inset, so the card's texture still shows all the way
                round it. Fixed at 2:1 rather than flex-1: letting it absorb the
                list column's slack made its shape depend on the viewport, which
                squashed it to 5:1 around 820px wide. */}
            {featured.image && (
              <div className="relative mt-6 aspect-[2/1] w-full overflow-hidden rounded-[6px]">
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
            )}
            <Link
              href="#"
              className="mt-5 inline-flex items-center gap-2 self-start text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              {featured.cta} →
            </Link>
          </article>

          {/* List */}
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <article
                key={post.title}
                className="group relative isolate overflow-hidden rounded-[10px] border border-hairline bg-panel p-10 transition-colors hover:border-border-strong"
              >
                {/* Same idea as the featured card, but far dimmer: the type sits
                    on top here, so the texture only tints the panel. */}
                <Image
                  src={post.image ?? textureFor(post.title)}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  placeholder="blur"
                  blurDataURL={newsBlur[post.image ?? textureFor(post.title)]}
                  className="-z-10 object-cover opacity-60 transition-opacity duration-300 group-hover:opacity-80"
                />
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-panel via-panel/70 to-panel/35" />
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
