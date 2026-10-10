import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { DivisionOrdersView } from "@/components/dashboard/division-orders";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";
import { cancelOrder, editOrder, placeOrder } from "../actions";

export const metadata: Metadata = {
  title: "Orders · Dashboard · PoliTo Rocket Team",
};

// Boards 61 to 61d: the division's Orders page. Only a division lead reaches it
// (lib/dashboard/access.ts), and only with Orders access in the division
// (issue #213); anyone else gets the dashboard's not found.
export default function OrdersPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <LiveOrders />
    </Suspense>
  );
}

async function LiveOrders() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/orders");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer.kind, "orders")) notFound();
  const orders = await data.divisionOrders();
  if (orders === null) notFound();
  return <DivisionOrdersView data={orders} writes={{ placeOrder, editOrder, cancelOrder }} />;
}
