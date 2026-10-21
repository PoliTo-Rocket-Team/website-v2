import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import type { Neighbouring } from "@/lib/outreach";
import type { OutreachDraft } from "@/lib/outreach-types";
import { siteFooterOf, type PageChrome } from "@/lib/page-chrome";
import { Neighbours, PostBody, PostGallerySection, PostHeader, type PostFrame } from "./post";

// Boards 33 (desktop) and 33m (phone): one outreach post's whole page, as
// /outreach/<slug> shows it and as the dashboard's edit shell shows it with
// its parts outlined (`frame`), redrawn as the editor types (issue #290). No
// apply band on this page (issue #110). `neighbours` are the published posts
// either side of it (`neighboursOf` in lib/outreach.ts). The editor draws it
// with no navbar and no footer (`chrome="none"`, issue #495), so its top
// keeps no room for the fixed bar.
export function PostPage(
  props: {
    post: OutreachDraft;
    neighbours: Neighbouring;
    frame?: PostFrame;
    /** The editor's page: a blank part says what goes there (board 74f). */
    hints?: boolean;
  } & PageChrome,
) {
  const { post, neighbours, frame, hints } = props;
  const footer = siteFooterOf(props);
  return (
    <div className="relative bg-ground">
      {footer !== null && <LandingNavbar />}
      <PageSky>
        {/* No bottom padding: the footer's own top padding is the gap under the last section (Owner decision, 2026-10-19).
            With no footer, the section rhythm closes the page instead. */}
        <main className={footer !== null ? "px-5 pt-16 md:px-16 md:pt-[72px]" : "px-5 pb-section md:px-16"}>
          <div className="pt-8 md:pt-16">
            <PostHeader post={post} frame={frame} hints={hints} />
            <PostBody post={post} frame={frame} hints={hints} />
            <PostGallerySection post={post} frame={frame} hints={hints} />
            <Neighbours {...neighbours} />
          </div>
        </main>
        {footer !== null && <LandingFooter inSky projects={footer} />}
      </PageSky>
    </div>
  );
}
