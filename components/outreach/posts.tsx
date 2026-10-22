"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { SectionHead } from "@/components/about/section-head";
import { Button } from "@/components/ui/button";
import { PostCard, type PostCardData } from "./post-card";

// Boards 32 and 32m, "Where we've been": a centred title and the post cards,
// newest first: three columns from lg, two from md, one on phones. The year
// filter the boards draw is gone (Owner decision, 2026-10-19). A list longer
// than its first cards (9 from md, 5 on phones) shows those and a "Show N
// more" button.

/** How many cards show before "Show N more": on phones, and from md. */
const FIRST = { phone: 5, desktop: 9 } as const;

/**
 * Which cards show before "Show N more", on phones and from md. Cards past
 * them stay in the page, hidden, so the button moves nothing above it.
 */
function displayOf(i: number, everyone: boolean): string {
  if (everyone || i < FIRST.phone) return "flex";
  if (i < FIRST.desktop) return "hidden md:flex";
  return "hidden";
}

/**
 * Wraps one post card in the dashboard's edit shell (issue #294); `layout`
 * holds the classes that place the card in its grid cell.
 */
export type PostCardFrame = (post: PostCardData, card: ReactNode, layout: string) => ReactNode;

type Framing = { frame?: PostCardFrame; keepInView?: PostCardData };

const CARD_LAYOUT = "flex w-full";

function List({ posts, frame, keepInView }: { posts: readonly PostCardData[] } & Framing) {
  // A card the editor must see opens the list past "Show N more".
  const [everyone, setEveryone] = useState(() => keepInView !== undefined && posts.indexOf(keepInView) >= FIRST.phone);
  const count = posts.length;
  const moreOnPhone = count - FIRST.phone;
  const moreOnDesktop = count - FIRST.desktop;
  // The button shows at the widths where cards are still hidden.
  const button = everyone || moreOnPhone <= 0 ? undefined : moreOnDesktop > 0 ? "flex" : "flex md:hidden";
  return (
    <>
      <ul className="mt-6 grid gap-4 md:mt-10 md:grid-cols-2 md:gap-x-6 md:gap-y-8 lg:grid-cols-3">
        {posts.map((p, i) => (
          <li key={i} className={displayOf(i, everyone)}>
            {frame === undefined ? (
              <PostCard post={p} className={CARD_LAYOUT} />
            ) : (
              frame(p, <PostCard post={p} className={CARD_LAYOUT} />, CARD_LAYOUT)
            )}
          </li>
        ))}
      </ul>
      {button !== undefined && (
        <div className={`mt-6 justify-center md:mt-10 ${button}`}>
          <Button
            type="button"
            variant="outline"
            onClick={() => setEveryone(true)}
            className="h-11 w-full rounded-full border-white-10 bg-transparent px-6 text-[15px] font-medium text-prt-text hover:border-border-strong hover:bg-transparent hover:text-prt-text focus-visible:ring-1 focus-visible:ring-prt-text/60 focus-visible:ring-offset-0 md:w-auto"
          >
            <span className="md:hidden">Show {moreOnPhone} more</span>
            <span className="hidden md:inline">Show {moreOnDesktop} more</span>
            <ChevronDown aria-hidden strokeWidth={1.75} />
          </Button>
        </div>
      )}
    </>
  );
}

export function Posts({ title, posts, ...framing }: { title: string; posts: readonly PostCardData[] } & Framing) {
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead title={title} align="centre" />
        <List posts={posts} {...framing} />
      </div>
    </section>
  );
}
