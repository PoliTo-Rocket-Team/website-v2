import type { Metadata } from "next";
import { ApplyContent, ApplyFrame } from "@/components/apply/apply-page";
import { plainApplyData } from "@/lib/apply/open";
import { applyPage } from "@/lib/apply/page";
import { applyListing } from "@/lib/apply/positions";

export const metadata: Metadata = {
  title: "Apply · PoliTo Rocket Team",
  description: applyPage.description,
};

// The whole page is prerendered, positions included, so it is all there in
// the first paint (issue #163). It reads no request data: the positions come
// from the environment's side (lib/apply/open.ts), which on the database is
// the cached public read the dashboard refreshes when a position or the
// recruitment switch changes. In dummy mode, a request carrying `?open=` or
// the dummy recruitment cookie is sent to ./dummy-state by proxy.ts instead.
export default async function ApplyPage() {
  const listing = applyListing(await plainApplyData().publicPositions());
  return (
    <ApplyFrame>
      <ApplyContent listing={listing} />
    </ApplyFrame>
  );
}
