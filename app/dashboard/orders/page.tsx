import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { OrdersView } from "@/components/dashboard/division-orders";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";
import { cancelOrder, decideOrder, editOrder, markOrdered, placeOrder } from "../actions";

export const metadata: Metadata = {
  title: "Orders · Dashboard · PoliTo Rocket Team",
};

// Boards 61 to 61d, 61m, 67, 67b, 67m and 70 to 70e: every order in the team (issue
// #233). Full access (issue #238), a division lead, a department head or a holder of
// "Approve orders" (issue #270) reaches it (lib/dashboard/access.ts), and only with
// Orders access somewhere; anyone else gets the dashboard's not found.
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
  if (!canReach(data.viewer, "orders")) notFound();
  const orders = await data.orders();
  if (orders === null) notFound();
  return <OrdersView data={orders} writes={{ placeOrder, editOrder, cancelOrder, decideOrder, markOrdered }} />;
}
