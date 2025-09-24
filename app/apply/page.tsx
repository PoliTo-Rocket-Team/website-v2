"use server";

import { getAllPositions } from "@/app/actions/get-apply-positions";
import { ApplyPositionsList } from "@/components/apply-positions-list";

export default async function Apply() {
  const openPositions = (await getAllPositions()).positions.filter(
    position => position.status
  );
  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-center mb-6 text-primary">
        Positions
      </h2>
      <ApplyPositionsList positions={openPositions} pageContext="apply" />
    </div>
  );
}
