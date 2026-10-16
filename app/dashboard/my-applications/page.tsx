import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { MyApplicationsView } from "@/components/dashboard/my-applications";
import { canReach } from "@/lib/dashboard/access";
import { hasNoneShown } from "@/lib/dashboard/my-applications";
import { openDashboard } from "@/lib/dashboard/open";
import { chooseInterviewSlot, withdrawApplication } from "../actions";

export const metadata: Metadata = {
  title: "My applications · Dashboard · PoliTo Rocket Team",
};

// Boards 50 and 53 (issue #169): the viewer's own applications. Every viewer
// kind reaches it (lib/dashboard/access.ts, issue #183), but only while one
// of their applications is shown (issue #317): the sidebar lists it only
// then, and with none shown the page opens their Overview instead, where
// board 50f says why.
export default function MyApplicationsPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <LiveApplications />
    </Suspense>
  );
}

async function LiveApplications() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/my-applications");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "my-applications")) notFound();
  const applications = await data.myApplications();
  if (applications === null) notFound();
  if (hasNoneShown(applications)) redirect("/dashboard");
  return (
    <MyApplicationsView applications={applications} withdrawApplication={withdrawApplication} chooseInterviewSlot={chooseInterviewSlot} />
  );
}
