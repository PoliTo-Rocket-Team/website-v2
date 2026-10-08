import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { Neighbours, PostBody, PostHeader } from "@/components/outreach/post";
import { neighboursOf, postBySlug, postsNewestFirst, slugOf } from "@/lib/outreach";

type Params = { params: Promise<{ slug: string }> };

// Every post page is built ahead from the record's posts; any other address
// finds no post and is a 404.
export function generateStaticParams(): { slug: string }[] {
  return postsNewestFirst.map((p) => ({ slug: slugOf(p) }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = postBySlug((await params).slug);
  if (post === undefined) return {};
  return { title: `${post.title} · Outreach · PoliTo Rocket Team`, description: post.lead };
}

// Boards 33 (desktop) and 33m (phone): one outreach post from the record
// (lib/outreach.ts). No apply band on this page (issue #110).
export default async function OutreachPostPage({ params }: Params) {
  const post = postBySlug((await params).slug);
  if (post === undefined) notFound();
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="px-5 pb-section pt-16 md:px-16 md:pt-[72px]">
          <div className="pt-8 md:pt-16">
            <PostHeader post={post} />
            <PostBody post={post} />
            <Neighbours {...neighboursOf(post)} />
          </div>
        </main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}
