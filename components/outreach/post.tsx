import Link from "next/link";
import { ArrowUpRight, Award, Instagram, Linkedin } from "lucide-react";
import { RocketArrow } from "@/components/landing/rocket-arrow";
import { CopyText } from "@/components/project-page/parts";
import {
  channelsOf,
  longDate,
  monthYear,
  readingMinutes,
  shortMonthYear,
  slugOf,
} from "@/lib/outreach";
import type { BodyBlock, Channel, ChannelName, OutreachPhoto, OutreachPost } from "@/lib/outreach-types";
import { Photo } from "./photo";

// Boards 33 and 33m: one outreach post, Medium-style. Everything shares one
// width, 1116px from lg (Huey's ruling, issue #110): the back link, the
// title block, the top photo, the photo grid and the older / newer cards. It
// is the 760px text column plus the 300px column of original-post cards
// beside it, sticky, 56px apart. Below lg the cards follow the article, after
// the photo grid.

const width = "mx-auto max-w-[1116px]";

export function PostHeader({ post }: { post: OutreachPost }) {
  const date = longDate(post.date);
  const minutes = readingMinutes(post.body);
  const dot = <span aria-hidden className="text-dim">·</span>;
  return (
    <header className={width}>
      <Link
        href="/outreach"
        className="group inline-flex items-center gap-2 text-[14px] text-text-2 transition-colors duration-300 ease-out hover:text-accent"
      >
        <RocketArrow className="rotate-180 opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:-translate-x-1.5 group-hover:opacity-100" />
        All outreach
      </Link>
      <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3 font-mono text-[11px] tracking-[0.2em] text-prt-muted md:mt-12">
        <time dateTime={post.date} className="text-accent">
          <CopyText copy={date} />
        </time>
        {post.place !== undefined && (
          <>
            {dot}
            <span>
              <CopyText copy={{ text: post.place.toUpperCase(), phone: post.place.split(",")[0].toUpperCase() }} />
            </span>
          </>
        )}
        {dot}
        <span>{minutes} MIN READ</span>
        <ul className="flex basis-full gap-2 font-display tracking-normal md:ml-1 md:basis-auto">
          {post.tags.map((t) => (
            <li key={t} className="rounded-full border border-white-10 px-3 py-1 text-[11px] leading-none text-text-2">
              {t}
            </li>
          ))}
        </ul>
      </div>
      <h1 className="mt-4 text-[30px] font-bold leading-[1.08] tracking-[-0.025em] md:mt-5 md:text-[56px] md:leading-[1.05]">
        {post.title}
      </h1>
      <p className="mt-4 max-w-[760px] text-[16px] leading-[1.55] text-text-2 md:mt-5 md:text-[20px]">{post.lead}</p>
      <div className="relative mt-8 aspect-[3/2] overflow-hidden rounded-xl md:mt-12 md:aspect-[9/5]">
        <Photo photo={post.photos[0]} sizes="(min-width: 1246px) 1116px, 100vw" priority />
      </div>
    </header>
  );
}

function Block({ block }: { block: BodyBlock }) {
  switch (block.kind) {
    case "paragraph":
      return <p>{block.text}</p>;
    case "heading":
      return (
        <h2 className="!mt-10 text-[22px] font-bold leading-[1.25] tracking-[-0.02em] text-prt-text md:!mt-12 md:text-[26px]">
          {block.text}
        </h2>
      );
    case "highlight":
      return (
        <aside className="glass-card flex items-center gap-4 rounded-xl px-5 py-4 md:px-6 md:py-5">
          <Award aria-hidden className="h-6 w-6 shrink-0 text-accent" strokeWidth={1.75} />
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-accent">{block.label}</p>
            <p className="mt-1 text-[15px] font-semibold leading-snug text-prt-text md:text-[16px]">{block.text}</p>
          </div>
        </aside>
      );
  }
}

const platform: Record<ChannelName, { label: string; Icon: typeof Instagram; account: string }> = {
  instagram: { label: "Instagram", Icon: Instagram, account: "politorocketteam" },
  linkedin: { label: "LinkedIn", Icon: Linkedin, account: "PoliTo Rocket Team" },
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/**
 * Our own card for a post as first shared, not the platform's embed: the
 * account, the platform, the photo on Instagram, the caption's start and a
 * link out.
 */
function ChannelCard({ name, channel, post }: { name: ChannelName; channel: Channel; post: OutreachPost }) {
  const { label, Icon, account } = platform[name];
  const ours = channel.account === undefined;
  return (
    <article className="glass-card overflow-hidden rounded-xl">
      <div className="flex items-center gap-2.5 p-3.5">
        {ours ? (
          <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[8px] font-extrabold text-accent-on-accent">
            PRT
          </span>
        ) : (
          <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white-10 text-[10px] font-bold text-prt-text">
            {initialsOf(channel.account ?? "")}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-prt-text">{channel.account ?? account}</p>
          <p className="mt-0.5 text-[10px] leading-tight text-prt-muted">
            {label} · {shortMonthYear(post.date)}
          </p>
        </div>
        <Icon aria-hidden className="h-4 w-4 shrink-0 text-text-2" strokeWidth={1.75} />
      </div>
      {name === "instagram" && (
        <div className="relative h-[200px] lg:h-[220px]">
          <Photo photo={post.photos[0]} sizes="(min-width: 1024px) 300px, 100vw" />
        </div>
      )}
      <div className="p-3.5">
        <p className="text-[12px] leading-[1.55] text-text-2">{channel.caption}</p>
        <a
          href={channel.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-prt-text transition-colors duration-300 ease-out hover:text-accent"
        >
          View on {label}
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
        </a>
      </div>
    </article>
  );
}

/** The photos after the top one: one big and up to two small beside it (under it on phones). */
function PhotoGrid({ photos }: { photos: readonly OutreachPhoto[] }) {
  const [big, ...small] = photos.slice(0, 3);
  if (big === undefined) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:h-[420px] md:grid-cols-2 md:grid-rows-2 md:gap-4">
      <div className={`relative col-span-2 aspect-[3/2] overflow-hidden rounded-xl md:aspect-auto ${small.length > 0 ? "md:col-span-1 md:row-span-2" : "md:row-span-2"}`}>
        <Photo photo={big} sizes="(min-width: 1246px) 550px, 100vw" />
      </div>
      {small.map((p) => (
        <div
          key={p.src}
          className={`relative h-[120px] overflow-hidden rounded-xl md:h-auto ${small.length === 1 ? "col-span-2 md:col-span-1 md:row-span-2" : ""}`}
        >
          <Photo photo={p} sizes="(min-width: 1246px) 550px, 50vw" />
        </div>
      ))}
    </div>
  );
}

export function PostBody({ post }: { post: OutreachPost }) {
  const channels = channelsOf(post);
  const more = post.photos.slice(1);
  return (
    <div className={`${width} mt-10 grid gap-y-14 md:mt-14 lg:grid-cols-[minmax(0,760px)_300px] lg:gap-x-14 lg:gap-y-24`}>
      <article className="space-y-5 text-[16px] leading-[1.75] text-text-2 md:text-[17px] md:leading-[1.8] lg:col-start-1 lg:row-start-1">
        {post.body.map((b, i) => (
          <Block key={i} block={b} />
        ))}
      </article>

      {more.length > 0 && (
        <div className="lg:col-span-2 lg:row-start-2">
          <h2 className="sr-only">Photos</h2>
          <PhotoGrid photos={more} />
        </div>
      )}

      <aside aria-label="Original posts" className="lg:col-start-2 lg:row-start-1">
        <div className="space-y-3 lg:sticky lg:top-[96px]">
          <p className="font-mono text-[10px] tracking-[0.2em] text-dim">ORIGINAL POSTS</p>
          {channels.map(({ name, channel }) => (
            <ChannelCard key={name} name={name} channel={channel} post={post} />
          ))}
        </div>
      </aside>
    </div>
  );
}

function Neighbour({ post, side }: { post: OutreachPost; side: "older" | "newer" }) {
  const arrow = "h-[1em] w-[2.4em] opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:opacity-100";
  return (
    <article
      className={`glass-card glass-linked group flex h-[96px] overflow-hidden rounded-xl md:h-[150px] ${side === "newer" ? "order-first md:order-none" : ""}`}
    >
      <div className="relative w-[120px] shrink-0 md:w-[190px]">
        <Photo photo={post.photos[0]} sizes="190px" />
      </div>
      <div className="flex min-w-0 flex-col justify-center px-4 md:px-6">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-prt-muted">
          {side === "older" && <RocketArrow className={`rotate-180 group-hover:-translate-x-1 ${arrow}`} />}
          {side === "older" ? "OLDER" : "NEWER"} · {monthYear(post.date)}
          {side === "newer" && <RocketArrow className={`group-hover:translate-x-1 ${arrow}`} />}
        </p>
        <h2 className="mt-2 truncate text-[17px] font-bold leading-tight text-prt-text md:text-[20px]">
          <Link
            href={`/outreach/${slugOf(post)}`}
            className="after:absolute after:inset-0 after:z-[2] after:rounded-xl focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent"
          >
            {post.title}
          </Link>
        </h2>
      </div>
    </article>
  );
}

export function Neighbours({ older, newer }: { older?: OutreachPost; newer?: OutreachPost }) {
  if (older === undefined && newer === undefined) return null;
  return (
    <nav aria-label="More outreach" className={`${width} mt-14 grid gap-3 md:mt-20 md:grid-cols-2 md:gap-4`}>
      {older !== undefined ? <Neighbour post={older} side="older" /> : <div className="hidden md:block" />}
      {newer !== undefined && <Neighbour post={newer} side="newer" />}
    </nav>
  );
}
