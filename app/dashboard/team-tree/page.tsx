import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { TeamTreeView } from "@/components/dashboard/team-tree";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Team tree · Dashboard · PoliTo Rocket Team",
};

// Board 54c (the family tree on a pan and zoom canvas) and, on phones, 54c-m.
export default function TeamTreePage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <LiveTeamTree />
    </Suspense>
  );
}

async function LiveTeamTree() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/team-tree");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "team-tree")) notFound();
  return <TeamTreeView tree={await data.teamTree()} />;
}
