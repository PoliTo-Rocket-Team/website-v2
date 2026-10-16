import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardPageFallback } from "@/components/dashboard/page-fallback";
import { MyAlumniView } from "@/components/dashboard/my-alumni";
import { canReach } from "@/lib/dashboard/access";
import { openDashboard } from "@/lib/dashboard/open";
import { removeMyAlumniPhoto, setMyAlumniShown, uploadMyAlumniPhoto } from "../actions";

export const metadata: Metadata = {
  title: "My alumni · Dashboard · PoliTo Rocket Team",
};

// Board 56b (issue #317): how a former member shows on the Alumni page.
// Only an alumnus reaches it (lib/dashboard/access.ts).
export default function MyAlumniPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <LiveMyAlumni />
    </Suspense>
  );
}

async function LiveMyAlumni() {
  const opening = await openDashboard();
  if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/my-alumni");
  if (opening.kind === "account-unresolved") return null;
  const { data } = opening;
  if (!canReach(data.viewer, "my-alumni")) notFound();
  const me = await data.myAlumni();
  if (me === null) notFound();
  return <MyAlumniView me={me} setShown={setMyAlumniShown} uploadPhoto={uploadMyAlumniPhoto} removePhoto={removeMyAlumniPhoto} />;
}
