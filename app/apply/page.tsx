import { getAllPositions } from "@/app/actions/get-apply-positions";
import { ApplyPageClient } from "@/components/apply-page-client";

export default async function Apply() {
  const openPositions = (await getAllPositions()).positions.filter(
    position => position.status
  );
  
  return (
    <div>
      <div className="flex flex-col space-y-4 md:space-y-8 mb-8 md:mb-16">
        <h2 className="text-4xl md:text-7xl font-bold text-primary border-b pt-5 pb-10">
          Apply
        </h2>

        <p className="text-muted-foreground w-3/4">
          Get Involved! PoliTo Rocket Team has numerous positions available for
          undergraduate and graduate students of Politecnico di Torino. Here you
          can find our Open Positions and some Frequently Asked Questions about
          our recruitment process or about the Team. If you still have some
          questions, don't hesitate to reach out to us on social media or at{" "}
          <a
            href="mailto:recruitment@politorocketteam.it"
            className="underline text-orange-500"
          >
            recruitment@politorocketteam.it
          </a>
        </p>
      </div>
      
      <ApplyPageClient positions={openPositions} />
    </div>
  );
}
