import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { MyAccountView } from "@/components/dashboard/my-account";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";
import { deleteAccount, saveDetails } from "../actions";

export const metadata: Metadata = {
  title: "My account · Dashboard · PoliTo Rocket Team",
};

// Board 51 (issue #169): an applicant's own account. Only an applicant reaches it
// (lib/dashboard/access.ts); a team member has My profile instead.
export default function AccountPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <LiveAccount />
    </Suspense>
  );
}

async function LiveAccount() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/account");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "my-account")) notFound();
  const account = await data.myAccount();
  if (account === null) notFound();
  return (
    <MyAccountView account={account} session={data.viewer.session} saveDetails={saveDetails} deleteAccount={deleteAccount} />
  );
}
