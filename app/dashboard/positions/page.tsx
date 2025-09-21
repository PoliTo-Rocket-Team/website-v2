"use server";

import { createClient } from "@/utils/supabase/server";
import {
  getApplyPositionsByUserRole,
  ApplyPosition,
} from "@/app/actions/user/get-apply-positions";
import { ApplyPositions } from "@/components/apply-positions-list";

export async function handleDelete(id: number) {
  const supabase = await createClient();

  const { error: posError } = await supabase
    .from("apply_positions")
    .delete()
    .eq("id", id);

  if (posError) {
    console.error("[handleDelete] could not delete position:", posError);
    throw new Error(`Failed to delete position ${id}: ${posError.message}`);
  }
}

export async function handleOpenClosePosition(id: number, isOpen: boolean) {
  const supabase = await createClient();

  const { error: posError } = await supabase
    .from("apply_positions")
    .update({ status: !isOpen })
    .eq("id", id);

  if (posError) {
    console.error(
      "[handleOpenClosePosition] could not update position:",
      posError
    );
    throw new Error(`Failed to update position ${id}: ${posError.message}`);
  }
}

export async function handleEditPosition(
  id: number,
  updatedData: Partial<{ title: string; description: string; status: boolean }>
) {
  const supabase = await createClient();

  const { error: posError } = await supabase
    .from("apply_positions")
    .update(updatedData)
    .eq("id", id);

  if (posError) {
    console.error("[handleEditPosition] could not update position:", posError);
    throw new Error(`Failed to update position ${id}: ${posError.message}`);
  }

  console.log(`Position ${id} updated successfully`);
}

export default async function PositionsPage() {
  const { positions } = await getApplyPositionsByUserRole();
  return (
      <div className="w-full">
        <h2 className="text-2xl font-bold text-center mb-6 text-primary">
          Positions
        </h2>
        <ApplyPositions />
      </div>
  );
}
