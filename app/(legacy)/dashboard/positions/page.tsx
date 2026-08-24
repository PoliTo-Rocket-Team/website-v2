import { Suspense } from "react";
import { getPositionsPageData } from "@/app/actions/get-apply-positions";
import { ApplyPositionsList } from "@/components/apply-positions-list";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import {
  handleDelete,
  handleEditPosition,
  handleAddPosition,
} from "./server-actions";

async function PositionsContent() {
  const { positions, editableDivisions } = await getPositionsPageData();

  return (
    <ApplyPositionsList
      positions={positions}
      handleDelete={handleDelete}
      handleEditPosition={handleEditPosition}
      handleAddPosition={handleAddPosition}
      editableDivisions={editableDivisions}
      pageContext="dashboard"
    />
  );
}

function PositionsFallback() {
  return (
    <div className="w-full relative max-w-5xl mx-auto">
      <div
        className="absolute top-0 right-0 -translate-y-12 h-10 w-[132px] rounded-md border border-border bg-muted/40 animate-pulse"
        aria-hidden="true"
      />
      <LoadingSkeleton className="space-y-2 md:space-y-4" />
    </div>
  );
}

export default function Positions() {
  return (
    <div className="w-full">
      <div className="flex flex-col space-y-4 md:space-y-8 mb-8 md:mb-16">
        <h2 className="text-lg md:text-2xl font-bold text-primary">
          Positions
        </h2>
        <p className="text-muted-foreground w-3/4">
          Manage recruitment positions for your divisions. You can create new
          positions, edit existing ones, and control their visibility to
          applicants. Active positions are displayed to potential candidates on
          the application page.
        </p>
      </div>
      <Suspense fallback={<PositionsFallback />}>
        <PositionsContent />
      </Suspense>
    </div>
  );
}
