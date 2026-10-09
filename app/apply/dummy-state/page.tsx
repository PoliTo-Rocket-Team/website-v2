import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApplyContent, ApplyFrame } from "@/components/apply/apply-page";
import { openApplyData } from "@/lib/apply/open";
import { applyPage } from "@/lib/apply/page";
import { applyListing } from "@/lib/apply/positions";
import { dummyDataOn } from "@/lib/dummy-data/mode";

export const metadata: Metadata = {
  title: "Apply · PoliTo Rocket Team",
  description: applyPage.description,
  robots: { index: false },
};

// /apply as one dummy-mode request picks it (issue #163): proxy.ts sends
// here only the requests that carry `?open=<n>` or the dummy recruitment
// cookie, and the address bar keeps /apply. Those requests alone pay for a
// request-time render; a plain visit gets the prerendered /apply. Off dummy
// mode the route does not exist.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ApplyDummyStatePage({ searchParams }: { searchParams: SearchParams }) {
  if (!dummyDataOn()) notFound();
  return (
    <ApplyFrame>
      {/* The header's figures and the positions come from one read, so they
          paint together (issue #157). */}
      <Suspense fallback={<div aria-hidden="true" className="min-h-svh" />}>
        <LiveApplyContent searchParams={searchParams} />
      </Suspense>
    </ApplyFrame>
  );
}

async function LiveApplyContent({ searchParams }: { searchParams: SearchParams }) {
  const { open } = await searchParams;
  const data = await openApplyData(typeof open === "string" ? open : null);
  return <ApplyContent listing={applyListing(await data.publicPositions())} />;
}
