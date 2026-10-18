import { LandingNavbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Latest } from "@/components/landing/latest";
import { Projects } from "@/components/landing/projects";
import { InsideTeam } from "@/components/landing/inside-team";
import { Partners } from "@/components/landing/partners";
import { ApplyBand } from "@/components/landing/apply-band";
import { SiteFooter } from "@/components/landing/site-footer";
import { PageSky } from "@/components/landing/page-sky";
import { trackRecord } from "@/lib/outreach";
import { publishedOutreach } from "@/lib/outreach-public";

// Approved landing page per Pencil board 21 ("Home v3, footer background
// throughout"). One sky runs behind every section from below the hero to the
// apply band: a repeating streak tile, a grain layer and stars. The sections
// inside it paint no background of their own. Every section pads its top and
// bottom by the `section` token. The hero has no pad of its own, so the sky
// adds one, less the empty hero already below its last line of text: the gap
// from that line to the Track record eyebrow matches every other section gap.
// Track record shows the newest published Outreach posts (issue #293).
export default async function LandingPage() {
  const outreach = await publishedOutreach();
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <main>
        <Hero />
        <PageSky fadeTop className="pt-[calc(var(--section-pad)-var(--hero-bottom-space))]">
          <Latest cards={trackRecord(outreach.posts)} tags={outreach.tags} />
          <Projects />
          <InsideTeam />
          <Partners />
        </PageSky>
        <ApplyBand />
      </main>
      <SiteFooter />
    </div>
  );
}
