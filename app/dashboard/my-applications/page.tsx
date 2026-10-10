import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MyApplicationsView, NoApplicationsView } from "@/components/dashboard/my-applications";
import { canReach } from "@/lib/dashboard/access";
import { hasNotApplied } from "@/lib/dashboard/my-applications";
import { openDashboard } from "@/lib/dashboard/open";
import { chooseInterviewSlot, withdrawApplication } from "../actions";

export const metadata: Metadata = {
  title: "My applications · Dashboard · PoliTo Rocket Team",
};

// Boards 50 and 53 (issue #169): the viewer's own applications. Applicants
// and members reach it (lib/dashboard/access.ts). Someone who has not applied
// yet gets the empty page with the way to /apply (issue #179).
export default function MyApplicationsPage() {
  return (
    <Suspense fallback={null}>
      <LiveApplications />
    </Suspense>
  );
}

async function LiveApplications() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/my-applications");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer.kind, "my-applications")) notFound();
  const applications = await data.myApplications();
  if (applications === null) notFound();
  if (hasNotApplied(applications)) return <NoApplicationsView />;
  return (
    <MyApplicationsView applications={applications} withdrawApplication={withdrawApplication} chooseInterviewSlot={chooseInterviewSlot} />
  );
}
