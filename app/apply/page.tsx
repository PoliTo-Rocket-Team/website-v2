import type { Metadata } from "next";
import { ApplyContent, ApplyFrame } from "@/components/apply/apply-page";
import { databaseApplyData } from "@/lib/apply/database";
import { applyPage } from "@/lib/apply/page";
import { applyListing } from "@/lib/apply/positions";

export const metadata: Metadata = {
  title: "Apply · PoliTo Rocket Team",
  description: applyPage.description,
};

// The whole page is prerendered, positions included, so it is all there in
// the first paint (issue #163). It reads no request data: the positions come
// from the database's cached public read, which the dashboard refreshes when
// a position or the recruitment switch changes. The questions are read the
// same way, and a question write refreshes their cached read (issue #258).
export default async function ApplyPage() {
  const data = databaseApplyData;
  const [positions, faqs] = await Promise.all([data.publicPositions(), data.faqs()]);
  return (
    <ApplyFrame>
      <ApplyContent listing={applyListing(positions)} faqs={faqs} />
    </ApplyFrame>
  );
}
