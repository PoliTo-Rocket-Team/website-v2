import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { DivisionAccessView } from "@/components/dashboard/division-access";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";
import { removeAllAccess, saveAccess } from "../actions";

export const metadata: Metadata = {
  title: "Access · Dashboard · PoliTo Rocket Team",
};

// Boards 60 to 60m: the division lead's Access page. Only a division lead reaches it
// (lib/dashboard/access.ts); anyone else gets the dashboard's not found.
export default function AccessPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <LiveAccess />
    </Suspense>
  );
}

async function LiveAccess() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/access");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "division-access")) notFound();
  const access = await data.divisionAccess();
  if (access === null) notFound();
  return <DivisionAccessView access={access} saveAccess={saveAccess} removeAllAccess={removeAllAccess} />;
}
