import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { PositionsView } from "@/components/dashboard/positions";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";
import { divisionTabFor } from "@/lib/dashboard/recruitment";

export const metadata: Metadata = {
  title: "Positions · Dashboard · PoliTo Rocket Team",
};

type SearchParams = Promise<{ division?: string | string[] }>;

// Boards 41 (the operations lead, with the recruitment switch), 41c (a
// division lead, their division's roles) and 63 (a department head, every
// division of their department under division tabs, issue #230). Replaces the
// legacy page here (issue #142). `?division=<id>` opens a head's page on that
// division's tab, as the Overview's Divisions panel links it. Members and
// applicants do not reach it.
export default function PositionsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <LivePositions searchParams={searchParams} />
    </Suspense>
  );
}

async function LivePositions({ searchParams }: { searchParams: SearchParams }) {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/positions");
  // The layout shows the sign-out screen in place of this page.
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer.kind, "positions")) notFound();
  const [page, recruitment, { division }] = await Promise.all([data.positions(), data.recruitment(), searchParams]);
  const asked = typeof division === "string" ? division : null;
  const initialDivision = page.scope === "department" ? divisionTabFor(page.department, asked) : null;
  return <PositionsView page={page} recruitment={recruitment} initialDivision={initialDivision} />;
}
