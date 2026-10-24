import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { OverviewView } from "@/components/dashboard/overview";
import { canReach } from "@/lib/dashboard/access";
import { showsAliasCard } from "@/lib/dashboard/alias-setup";
import { applicantOverview } from "@/lib/dashboard/applicant-overview";
import type { DashboardData } from "@/lib/dashboard/data";
import { alumniOverview } from "@/lib/dashboard/my-alumni";
import { openDashboard } from "@/lib/dashboard/open";
import type { Overview } from "@/lib/dashboard/overview";

export const metadata: Metadata = {
  title: "Overview · Dashboard · PoliTo Rocket Team",
};

// Board 40 (the operations lead), 72 (the team leader), 56 (a division
// lead), 52 (a member), 50e and 50f (a non-member, with and without an
// application shown) and issue #317's board 56 (an alumnus). Every viewer
// reaches it and lands on it (lib/dashboard/access.ts); what it shows is the
// viewer's own overview.
export default function OverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="overview" />}>
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
  if (!canReach(data.viewer, "overview")) notFound();
  // The viewer's own email alias card (board 94f, issue #542), on every Overview that shows one.
  const [overview, alias] = await Promise.all([overviewOf(data), data.myAlias()]);
  return <OverviewView overview={overview} aliasCard={showsAliasCard(alias) ? alias : null} />;
}

// Off the team, the Overview reads the applications My applications shows
// (issue #211) and lists no open positions (issue #317); an alumnus's adds
// their Alumni entry.
async function overviewOf(data: DashboardData): Promise<Overview> {
  switch (data.viewer.kind) {
    case "non-member": {
      const mine = await data.myApplications();
      if (mine === null) notFound();
      return applicantOverview(data.viewer, mine);
    }
    case "alumni": {
      const [mine, me] = await Promise.all([data.myApplications(), data.myAlumni()]);
      if (mine === null || me === null) notFound();
      return alumniOverview(data.viewer, me, mine);
    }
    default:
      return data.overview();
  }
}
