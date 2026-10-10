import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ApplicationsView } from "@/components/dashboard/applications";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Applications · Dashboard · PoliTo Rocket Team",
};

// Board 41b: the applications to the positions the viewer leads, and the
// detail panel of the chosen one. Replaces the legacy page here (issue #142).
// `?position=<ref>` opens it filtered to one position, as the Overview's
// "Review" links do. Members and applicants do not reach it.
export default function ApplicationsPage({ searchParams }: { searchParams: Promise<{ position?: string | string[] }> }) {
  return (
    <Suspense fallback={null}>
      <LiveApplications searchParams={searchParams} />
    </Suspense>
  );
}

async function LiveApplications({ searchParams }: { searchParams: Promise<{ position?: string | string[] }> }) {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/applications");
  // The layout shows the sign-out screen in place of this page.
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer.kind, "applications")) notFound();
  const [page, { position }] = await Promise.all([data.applications(), searchParams]);
  const asked = typeof position === "string" ? position : null;
  const initialPosition = page.positions.some((p) => p.ref === asked) ? asked : null;
  return <ApplicationsView page={page} initialPosition={initialPosition} lead={data.viewer.name} />;
}
