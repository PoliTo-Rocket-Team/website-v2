import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { PartnersView } from "@/components/dashboard/partners";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "Partners · Dashboard · PoliTo Rocket Team",
};

// Boards 76 and 76b (issue #256): the partners on /partners and the home logo
// strip, in site order, with drafts and Publish. Full access and anyone with
// site-content access reach it (lib/content/gate.ts); everyone else gets the
// dashboard's not found.
export default function PartnersPage() {
  return (
    <Suspense fallback={<PageSkeleton kind="list" />}>
      <LivePartners />
    </Suspense>
  );
}

async function LivePartners() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/partners");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "partners")) notFound();
  const items = await data.partners.list();
  if (items === null) notFound();
  return <PartnersView items={items} />;
}
