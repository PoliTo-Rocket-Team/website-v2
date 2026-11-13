import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { MyAccountView } from "@/components/dashboard/my-account";
import { canReach } from "@/lib/dashboard/access";
import { googleAccountsNoticeOf, searchValue } from "@/lib/dashboard/google-accounts";
import { openDashboard } from "@/lib/dashboard/open";
import { deleteAccount, saveDetails } from "../actions";

export const metadata: Metadata = {
  title: "My account · Dashboard · PoliTo Rocket Team",
};

// Adding a Google account comes back here; `error` is set when Google or Better Auth refused it (issue #906),
// and `google_merge` names what a merge of another login came to (issue #907).
type Search = Promise<{ error?: string | string[]; google_merge?: string | string[] }>;

// Board 51 (issue #169): an applicant's own account. Only an applicant reaches it
// (lib/dashboard/access.ts); a team member has My profile instead.
export default function AccountPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<PageSkeleton kind="form" />}>
      <LiveAccount searchParams={searchParams} />
    </Suspense>
  );
}

async function LiveAccount({ searchParams }: { searchParams: Search }) {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/account");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "my-account")) notFound();
  const [account, query] = await Promise.all([data.myAccount(), searchParams]);
  if (account === null) notFound();
  return (
    <MyAccountView
      account={account}
      googleAccountsNotice={googleAccountsNoticeOf({ error: searchValue(query.error), merge: searchValue(query.google_merge) })}
      saveDetails={saveDetails}
      deleteAccount={deleteAccount}
    />
  );
}
