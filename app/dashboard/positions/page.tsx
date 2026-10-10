import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { PositionsView } from "@/components/dashboard/positions";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Positions · Dashboard · PoliTo Rocket Team",
};

// Boards 41 (the operations lead, with the recruitment switch) and 41c (a
// division lead, their division's roles). Replaces the legacy page here
// (issue #142). Members and applicants do not reach it.
export default function PositionsPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <LivePositions />
    </Suspense>
  );
}

async function LivePositions() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/positions");
  // The layout shows the sign-out screen in place of this page.
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer.kind, "positions")) notFound();
  const [page, recruitment] = await Promise.all([data.positions(), data.recruitment()]);
  return <PositionsView page={page} recruitment={recruitment} />;
}
