import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { MembersView } from "@/components/dashboard/members";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Members · Dashboard · PoliTo Rocket Team",
};

// Boards 46 (operations lead: the whole team) and 59 (division lead: their
// division, the people joining it, and the member panel). It replaces the legacy members page.
export default function MembersPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <LiveMembers />
    </Suspense>
  );
}

async function LiveMembers() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/members");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer.kind, "members")) notFound();
  return <MembersView directory={await data.members()} editable={data.teamWrites !== null} />;
}
