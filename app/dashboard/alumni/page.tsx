import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { AlumniView } from "@/components/dashboard/alumni";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Alumni · Dashboard · PoliTo Rocket Team",
};

// Board 46c: everyone who was on the team, for the full admins and anyone
// with site-content access (issue #234).
export default function AlumniPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="list" />}>
      <LiveAlumni />
    </Suspense>
  );
}

async function LiveAlumni() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/alumni");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "alumni")) notFound();
  return <AlumniView directory={await data.alumni()} editable={data.teamWrites !== null} />;
}
