"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SectionHead } from "@/components/about/section-head";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard, type PostCardData } from "./post-card";

// Boards 32 and 32m, "Where we've been": a centred title, a year filter (All,
// then each year that has posts, newest first) and the post cards, newest
// first: three columns from lg, two from md, one on phones. The pills are the
// repo's Radix tabs, so the arrow keys move between years, in one track that
// swipes sideways when it does not fit the screen. A list longer than its first cards
// (9 from md, 5 on phones) shows those and a "Show N more" button.

/** How many cards show before "Show N more": on phones, and from md. */
const FIRST = { phone: 5, desktop: 9 } as const;

const ALL = "all";

/**
 * Which cards show before "Show N more", on phones and from md. Cards past
 * them stay in the page, hidden, so the button moves nothing above it.
 */
function displayOf(i: number, everyone: boolean): string {
  if (everyone || i < FIRST.phone) return "flex";
  if (i < FIRST.desktop) return "hidden md:flex";
  return "hidden";
}

function List({ posts }: { posts: readonly PostCardData[] }) {
  const [everyone, setEveryone] = useState(false);
  const count = posts.length;
  const moreOnPhone = count - FIRST.phone;
  const moreOnDesktop = count - FIRST.desktop;
  // The button shows at the widths where cards are still hidden.
  const button = everyone || moreOnPhone <= 0 ? undefined : moreOnDesktop > 0 ? "flex" : "flex md:hidden";
  return (
    <>
      <ul className="mt-6 grid gap-4 md:mt-10 md:grid-cols-2 md:gap-x-6 md:gap-y-8 lg:grid-cols-3">
        {posts.map((p, i) => (
          <li key={p.slug} className={displayOf(i, everyone)}>
            <PostCard post={p} className="flex w-full" />
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

export function Posts({ title, posts, years }: { title: string; posts: readonly PostCardData[]; years: readonly number[] }) {
  const [year, setYear] = useState(ALL);
  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead title={title} align="centre" />
        <Tabs value={year} onValueChange={setYear}>
          <div className="mt-5 flex justify-center md:mt-6">
            <TabsList
              aria-label="Years"
              className="min-w-0 max-w-full gap-0.5 overflow-x-auto rounded-full border border-white-10 bg-white-5 p-1 [scrollbar-width:none] md:gap-1 [&::-webkit-scrollbar]:hidden"
            >
              {[ALL, ...years.map(String)].map((y) => (
                <TabsTrigger
                  key={y}
                  value={y}
                  className="h-9 shrink-0 whitespace-nowrap rounded-full px-4 font-mono text-[13px] tracking-[0.04em] text-text-2 transition-colors duration-300 ease-out hover:text-prt-text data-[state=active]:bg-prt-text data-[state=active]:text-ground md:h-[38px] md:px-5 md:text-[14px]"
                >
                  {y === ALL ? "All" : y}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value={ALL}>
            <List posts={posts} />
          </TabsContent>
          {years.map((y) => (
            <TabsContent key={y} value={String(y)}>
              <List posts={posts.filter((p) => p.year === y)} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
