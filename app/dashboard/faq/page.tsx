import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FaqView } from "@/components/dashboard/faq";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";

export const metadata: Metadata = {
  title: "FAQ · Dashboard · PoliTo Rocket Team",
};

// Boards 79 and 79b (issue #258): the questions at the bottom of /apply, in
// site order, with drafts and Publish. Full access and anyone with
// site-content access reach it (lib/content/gate.ts); everyone else gets the
// dashboard's not found.
export default function FaqPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <LiveFaq />
    </Suspense>
  );
}

async function LiveFaq() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/faq");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "faq")) notFound();
  const list = await data.faqs.list();
  if (list === null) notFound();
  return <FaqView items={list.items} now={list.now} />;
}
