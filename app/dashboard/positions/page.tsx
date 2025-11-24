"use server";

import { getPositionsByMemberScope } from "@/app/actions/get-apply-positions";
import { getEditableDivisions } from "@/app/actions/get-member-scopes";
import { ApplyPositionsList } from "@/components/apply-positions-list";
import {
  handleDelete,
  handleEditPosition,
  handleAddPosition,
} from "./server-actions";
import { handleNoAccess } from "@/lib/access-control";
import { ApplyPosition } from "@/app/actions/types";

export default async function Positions() {
  const { positions } = await getPositionsByMemberScope();
  const editableDivisions = await getEditableDivisions();

  //! todo handle no access 
  // // Handle NO_ACCESS redirect
  // await handleNoAccess(positions);

  return (
    <div className="w-full">
      <div className="flex flex-col my-4 border-b pb-4 md:pb-8">
        <h2 className="text-lg md:text-2xl font-bold text-primary pb-2 md:pb-4">
          Positions
        </h2>
        <p className="text-muted-foreground w-3/4">
          Manage recruitment positions for your divisions. You can create new
          positions, edit existing ones, and control their visibility to
          applicants. Active positions are displayed to potential candidates on
          the application page.
        </p>
      </div>
      <ApplyPositionsList
        positions={positions as ApplyPosition[]}
        handleDelete={handleDelete}
        handleEditPosition={handleEditPosition}
        handleAddPosition={handleAddPosition}
        editableDivisions={editableDivisions}
        pageContext="dashboard"
      />
    </div>
  );
}
