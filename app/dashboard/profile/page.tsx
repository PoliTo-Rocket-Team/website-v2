import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MyProfileView } from "@/components/dashboard/my-profile";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";
import { removePhoto, requestLeave, saveLinkedin, uploadPhoto } from "../actions";

export const metadata: Metadata = {
  title: "My profile · Dashboard · PoliTo Rocket Team",
};

// Board 45: a team member's own profile. Team members reach it
// (lib/dashboard/access.ts); an applicant has My account instead.
export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <LiveProfile />
    </Suspense>
  );
}

async function LiveProfile() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/profile");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer.kind, "my-profile")) notFound();
  const profile = await data.myProfile();
  if (profile === null) notFound();
  return (
    <MyProfileView
      profile={profile}
      session={data.viewer.session}
      saveLinkedin={saveLinkedin}
      uploadPhoto={uploadPhoto}
      removePhoto={removePhoto}
      requestLeave={requestLeave}
    />
  );
}
