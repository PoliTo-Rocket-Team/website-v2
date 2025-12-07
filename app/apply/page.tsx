"use server";

import { getPublicPositions } from "@/app/actions/get-apply-positions";
import { ApplyPositionsList } from "@/components/apply-positions-list";

export default async function Apply() {
  const { positions: openPositions } = await getPublicPositions();
  return (
    <div>
      <div className="flex flex-col space-y-4 md:space-y-8 mb-8 md:mb-16">
        <h2 className="text-4xl md:text-7xl font-bold border-b pt-5 pb-10 ">
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
            className="underline text-primary"
          >
            recruitment@politorocketteam.it
          </a>
        </p>
      </div>
      <div className=" max-w-5xl w-full relative mx-auto">
        <h2 className="text-lg md:text-4xl font-bold text-center mb-4 md:mb-8">
          Open Positions
        </h2>
      </div>
      {/* //! todo add some display-only positions when there are no open positions */}
      {/* //! todo remove border color for apply positions list on apply page */}
      <ApplyPositionsList
        positions={openPositions}
        pageContext="apply"
        disclaimer="true"
      />
    </div>
  );
}
