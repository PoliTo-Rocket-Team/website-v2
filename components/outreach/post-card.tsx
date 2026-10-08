import Link from "next/link";
import { RocketArrow } from "@/components/landing/rocket-arrow";
import { CopyText } from "@/components/project-page/parts";
import type { Copy } from "@/lib/projects";
import type { OutreachPhoto } from "@/lib/outreach-types";
import { Photo } from "./photo";

/** What a post card shows, worked out on the server from the record. */
export type PostCardData = {
  slug: string;
  year: number;
  /** "MAY 2025". */
  date: string;
  title: string;
  summary: Copy;
  photo: OutreachPhoto;
};

// Boards 32 and 32m: one post in "Where we've been". A glass card with the
// photo on top, then the date, the title, the summary and "Read more". The
// title is the link, and its ::after covers the card, so the whole card opens
// the post; its edge brightens on hover and on keyboard focus (.glass-linked).
export function PostCard({ post, className = "" }: { post: PostCardData; className?: string }) {
  return (
    <article className={`glass-card glass-linked group flex-col overflow-hidden rounded-xl ${className}`}>
      <div className="relative h-[190px] shrink-0 md:h-[220px]">
        <Photo photo={post.photo} sizes="(min-width: 1440px) 421px, (min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw" />
      </div>
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <p className="font-mono text-[11px] tracking-[0.2em] text-accent">{post.date}</p>
        <h3 className="mt-2.5 text-[18px] font-bold leading-[1.25] tracking-[-0.01em] text-prt-text md:mt-3 md:text-[20px]">
          <Link
            href={`/outreach/${post.slug}`}
            className="after:absolute after:inset-0 after:z-[2] after:rounded-xl focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent"
          >
            {post.title}
          </Link>
        </h3>
        <p className="mt-2 text-[14px] leading-[1.5] text-text-2">
          <CopyText copy={post.summary} />
        </p>
        <p
          aria-hidden
          className="mt-auto flex items-center gap-2 pt-4 text-[14px] font-medium text-prt-text transition-colors duration-300 ease-out group-hover:text-accent"
        >
          Read more
          <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
        </p>
      </div>
    </article>
  );
}
