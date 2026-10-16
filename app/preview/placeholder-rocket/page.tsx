import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { HomeProjectCard } from "@/components/landing/project-card";
import { ProjectHero } from "@/components/project-page/hero";
import { dummyDataOn } from "@/lib/dummy-data/mode";
import type { HomeCardView } from "@/lib/project-content/record";
import type { Hero } from "@/lib/project-pages";

export const metadata: Metadata = {
  title: "Placeholder rocket · PoliTo Rocket Team",
  robots: { index: false },
};

// The placeholder rocket (issue #296) on a project with no model of its own:
// its home card and its page hero, drawn by the same components as the real
// projects. No project draws the placeholder until New project adds one, so
// this sample lets a preview show it. Off dummy mode the route does not exist.

const card: HomeCardView = {
  num: "04",
  year: { text: "2026" },
  status: "IN DESIGN",
  statusTone: "light",
  name: "New project",
  desc: { text: "Student-built rocket, in design." },
  specs: [
    { label: { text: "APOGEE" }, value: { text: "3 000 m" } },
    { label: { text: "MOTOR" }, value: { text: "Solid · M", phone: "Solid M" } },
    { label: { text: "SPEED" }, value: { text: "300 m/s" } },
  ],
  texture: "/textures/project-ves.webp",
};

const hero: Hero = {
  intro: { text: "Student-built rocket, in design." },
  status: "IN DESIGN",
  dates: "2026 –",
  visual: { caption: "NEW PROJECT · FLIGHT CONFIGURATION", rocket: {} },
  facts: [
    { value: "130 mm", label: { text: "DIAMETER" } },
    { value: "3 000 m", label: { text: "TARGET APOGEE" } },
    { value: "Solid M", label: { text: "MOTOR" } },
  ],
};

export default function PlaceholderRocketPreview() {
  if (!dummyDataOn()) notFound();
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="pb-section">
          <ProjectHero project={{ index: "04", name: card.name, texture: card.texture }} hero={hero} />
          <section className="px-5 pt-section md:px-16">
            <div className="mx-auto grid max-w-[1312px] md:gap-8 lg:grid-cols-3 lg:gap-4">
              <HomeProjectCard project={card} />
            </div>
          </section>
        </main>
      </PageSky>
    </div>
  );
}
