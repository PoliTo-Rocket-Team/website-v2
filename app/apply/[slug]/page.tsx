import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Applicant } from "@/app/actions/get-applicant";
import { ApplicationForm } from "@/components/apply/application-form";
import { ClosedCard, PositionLayout, SentCard, SignInCard, type PositionView } from "@/components/apply/position";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import type { ApplyPosition } from "@/db/types";
import type { ApplyData } from "@/lib/apply/data";
import { openApplyData } from "@/lib/apply/open";
import { isPublic, positionCode, positionIdFromSlug, positionSlug } from "@/lib/apply/positions";
import { sendApplication } from "./actions";

export const metadata: Metadata = {
  title: "Apply · PoliTo Rocket Team",
  description: "Apply for an open position in the PoliTo Rocket Team.",
};

// Positions live in the database, so no page is built ahead. Cache Components
// still needs one param to validate the route's static shell (the navbar
// reads the pathname), so the build renders the shell for a slug that names
// no position; every real slug renders on request.
export function generateStaticParams(): { slug: string }[] {
  return [{ slug: "0" }];
}

// The position page (boards 35, 35b, 35c and 35d; 35m to 35dm on phones),
// inside the page sky like /apply. Signed-out visitors see the page too: the
// sign-in card stands in for the form (issue #120), so proxy.ts lets them in.
export default function PositionPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <div className="relative bg-ground">
      <LandingNavbar />
      <PageSky>
        <main className="min-h-svh pb-section pt-16 md:pt-[72px]">
          <Suspense fallback={null}>
            <LivePosition params={params} />
          </Suspense>
        </main>
        <LandingFooter inSky />
      </PageSky>
    </div>
  );
}

/** The one card under the description, by the page's state, in this order. */
type CardState =
  | { kind: "closed" }
  | { kind: "signed-out" }
  | { kind: "sent"; applicant: Applicant }
  | { kind: "form"; applicant: Applicant };

async function cardState(data: ApplyData, position: ApplyPosition, recruitmentOpen: boolean): Promise<CardState> {
  if (!isPublic(position, { isOpen: recruitmentOpen })) return { kind: "closed" };
  const applicant = await data.applicant();
  if (applicant === null) return { kind: "signed-out" };
  if (await data.hasApplied(applicant.id, position.id)) return { kind: "sent", applicant };
  return { kind: "form", applicant };
}

async function LivePosition({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const id = positionIdFromSlug(slug);
  if (id === null) notFound();

  const data = await openApplyData();
  const read = await data.position(id);
  if (read === null) notFound();
  const { position, recruitment } = read;

  // Only the id resolves a slug; an old title still lands on the current one.
  const canonical = positionSlug(position);
  if (slug !== canonical) redirect(`/apply/${canonical}`);

  const view: PositionView = {
    code: positionCode(position),
    department: position.dept_name,
    division: position.div_name,
    title: position.title ?? "",
    description: position.description ?? "",
    required: position.required_skills ?? [],
    desirable: position.desirable_skills ?? [],
  };
  const state = await cardState(data, position, recruitment.isOpen);

  return (
    <PositionLayout position={view}>
      {state.kind === "closed" && <ClosedCard />}
      {state.kind === "signed-out" && <SignInCard returnTo={`/apply/${canonical}`} />}
      {state.kind === "sent" && (
        <SentCard
          firstName={state.applicant.defaults.firstName}
          title={view.title}
          division={view.division}
          email={state.applicant.email}
        />
      )}
      {state.kind === "form" && (
        <ApplicationForm
          email={state.applicant.email}
          defaults={state.applicant.defaults}
          asks={{
            questions: position.custom_questions ?? [],
            requiresMotivationLetter: position.requires_motivation_letter,
          }}
          send={sendApplication.bind(null, position.id)}
        />
      )}
    </PositionLayout>
  );
}
