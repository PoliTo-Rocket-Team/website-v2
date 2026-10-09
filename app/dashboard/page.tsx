import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OverviewView } from "@/components/dashboard/overview";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Overview · Dashboard · PoliTo Rocket Team",
};

// Boards 40 (a lead) and 40m (a member). Every viewer reaches it
// (lib/dashboard/access.ts); what it shows is the viewer's own overview.
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
  return <OverviewView overview={await data.overview()} />;
}
