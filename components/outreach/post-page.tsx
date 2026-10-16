import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { neighboursOf } from "@/lib/outreach";
import type { OutreachPost } from "@/lib/outreach-types";
import { Neighbours, PostBody, PostHeader, type PostFrame } from "./post";

// Boards 33 (desktop) and 33m (phone): one outreach post's whole page, as
// /outreach/<slug> shows it and as the dashboard's edit shell shows it with
// its parts outlined (`frame`). No apply band on this page (issue #110).
export function PostPage({ post, frame }: { post: OutreachPost; frame?: PostFrame }) {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="px-5 pb-section pt-16 md:px-16 md:pt-[72px]">
          <div className="pt-8 md:pt-16">
            <PostHeader post={post} frame={frame} />
            <PostBody post={post} frame={frame} />
            <Neighbours {...neighboursOf(post)} />
          </div>
        </main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}
