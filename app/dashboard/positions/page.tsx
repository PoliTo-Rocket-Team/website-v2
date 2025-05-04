import { InfoIcon } from "lucide-react";
import { ApplyPositions } from "@/components/apply-positions-list";

export default async function PositionsPage() {
  return (
      <div className="w-full">
        <h2 className="text-2xl font-bold text-center mb-6 text-primary">
          Positions
        </h2>
        <ApplyPositions />
      </div>
  );
}
