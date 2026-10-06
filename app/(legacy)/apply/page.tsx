"use server";

import { Suspense } from "react";
import { connection } from "next/server";
import { getPublicPositions } from "@/app/actions/get-apply-positions";
import { ApplyPositionsList } from "@/components/apply-positions-list";
import { Button } from "@/components/ui/button";

// Positions are read on request only, so `next build` never queries the
// database and a deployment without one still builds.
async function OpenPositions() {
  await connection();
  const result = await getPublicPositions();

  if (result.status === "database-not-configured") {
    return (
      <p className="text-center text-muted-foreground px-4 py-5">
        Open positions are not available right now.
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:visible md:grid md:grid-cols-[3fr_2fr_2fr_auto] text-center md:justify-items-start text-base px-4 py-5">
        <h3>Position</h3>
        <h3>Department</h3>
        <h3>Division</h3>
        <Button className="invisible h-4 w-10"></Button>
      </div>
      <ApplyPositionsList
        positions={result.positions}
        pageContext="apply"
        disclaimer="true"
      />
    </>
  );
}

export default async function Apply() {
  return (
    <div>
      <div className="flex flex-col space-y-4 md:space-y-8 mb-8 md:mb-16">
        <h2 className="text-4xl md:text-7xl font-bold text-primary border-b pt-5 pb-10 ">
          Apply
        </h2>

        <p className="text-muted-foreground w-3/4">
          Get Involved! PoliTo Rocket Team has numerous positions available for
          undergraduate and graduate students of Politecnico di Torino. Here you
          can find our Open Positions and some Frequently Asked Questions about
          our recruitment process or about the Team. If you still have some
          questions, don’t hesitate to reach out to us on social media or at{" "}
          <a
            href="mailto:recruitment@politorocketteam.it"
            className="underline text-orange-500"
          >
            recruitment@politorocketteam.it
          </a>
        </p>
      </div>
      <div className=" max-w-5xl mx-auto">
        <h2 className="text-lg md:text-4xl font-bold text-center text-primary mb-4 md:mb-8">
          Open Positions
        </h2>
        <Suspense
          fallback={
            <p className="text-center text-muted-foreground px-4 py-5">
              Loading open positions…
            </p>
          }
        >
          <OpenPositions />
        </Suspense>
      </div>
    </div>
  );
}
