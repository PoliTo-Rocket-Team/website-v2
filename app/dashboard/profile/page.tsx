import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { MyProfileView } from "@/components/dashboard/my-profile";
import { canReach } from "@/lib/dashboard/access";
import { linkErrorMessage } from "@/lib/dashboard/google-accounts";
import { openDashboard } from "@/lib/dashboard/open";
import { deleteAccount, leaveTeam, removePhoto, saveDetails, saveLinkedin, sendHandOver, uploadPhoto } from "../actions";

export const metadata: Metadata = {
  title: "My profile · Dashboard · PoliTo Rocket Team",
};

// Board 55 (issue #169): a team member's own profile. Team members reach it
// (lib/dashboard/access.ts); an applicant has My account instead.
// Adding a Google account comes back here; `error` is set when Google or Better Auth refused it (issue #906).
type Search = Promise<{ error?: string | string[] }>;

export default function ProfilePage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<PageSkeleton kind="form" />}>
      <LiveProfile searchParams={searchParams} />
    </Suspense>
  );
}

async function LiveProfile({ searchParams }: { searchParams: Search }) {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/profile");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "my-profile")) notFound();
  const [profile, alias, { error }] = await Promise.all([data.myProfile(), data.myAlias(), searchParams]);
  if (profile === null) notFound();
  return (
    <MyProfileView
      profile={profile}
      alias={alias}
      linkError={linkErrorMessage(typeof error === "string" ? error : null)}
      saveLinkedin={saveLinkedin}
      uploadPhoto={uploadPhoto}
      removePhoto={removePhoto}
      saveDetails={saveDetails}
      leaveTeam={leaveTeam}
      sendHandOver={sendHandOver}
      deleteAccount={deleteAccount}
    />
  );
}
