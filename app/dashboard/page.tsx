import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OverviewView } from "@/components/dashboard/overview";
import { openApplyData } from "@/lib/apply/open";
import { applyListing } from "@/lib/apply/positions";
import { canReach, dashboardLandingFor } from "@/lib/dashboard/access";
import { applicantOverview } from "@/lib/dashboard/applicant-overview";
import type { DashboardData } from "@/lib/dashboard/data";
import { openDashboard } from "@/lib/dashboard/open";
import type { Overview } from "@/lib/dashboard/overview";

export const metadata: Metadata = {
  title: "Overview · Dashboard · PoliTo Rocket Team",
};

// Board 40 (the operations lead), 56 (a division lead), 52 (a member) and
// 50e (a non-member who has applied). Every viewer reaches it
// (lib/dashboard/access.ts); what it shows is the viewer's own overview. A
// non-member who has not applied yet goes to My applications instead (issue
// #179).
export default function OverviewPage() {
  return (
    <Suspense fallback={null}>
      <LiveOverview />
    </Suspense>
  );
}

async function LiveOverview() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard");
  // The layout shows the sign-out screen in place of this page.
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer.kind, "overview")) notFound();
  const landing = dashboardLandingFor(data.viewer.kind, await data.hasOwnApplications());
  if (landing !== null) redirect(landing);
  return <OverviewView overview={await overviewOf(data)} />;
}

// A non-member's Overview reads their applications as My applications does
// and the open positions as /apply does (issue #211).
async function overviewOf(data: DashboardData): Promise<Overview> {
  if (data.viewer.kind !== "non-member") return data.overview();
  const [mine, apply] = await Promise.all([data.myApplications(), openApplyData()]);
  if (mine === null) notFound();
  return applicantOverview(data.viewer.name, mine, applyListing(await apply.publicPositions()));
}
