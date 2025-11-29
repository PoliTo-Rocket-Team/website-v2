"use server";

import { createSupabaseClient } from "@/utils/supabase/server";
import { ApplyPosition } from "./types";
import { filterItemsByScope } from "./get-scopes";

export async function getAllPositions() {
  const supabase = await createSupabaseClient();

  // Get all positions with division and department info (exclude deleted positions)
  const { data: positions, error } = await supabase
    .from("apply_positions")
    .select(
      `
      *,
      divisions(
        id,
        name,
        code,
        dept_id,
        departments(
          id,
          name,
          code
        )
      )
    `
    )
    .eq("is_deleted", false)
    .order("divisions(dept_id)", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    console.error("Error getting positions:", error);
    return { positions: [] };
  }

  if (!positions) {
    return { positions: [] };
  }

  // Transform to match ApplyPosition type
  const applyPositions: ApplyPosition[] = positions.map(position => ({
    ...position,
    div_name: position.divisions?.name || "",
    div_code: position.divisions?.code || "",
    dept_id: position.divisions?.departments?.id || 0,
    dept_name: position.divisions?.departments?.name || "",
    dept_code: position.divisions?.departments?.code || "",
  }));

  return {
    positions: applyPositions,
  };
}

/**
 * Get all apply positions filtered by the current user's scope permissions with embedded canEdit
 * @returns Filtered array of apply positions based on user's scope (includes canEdit property)
 */
export async function getPositionsByMemberScope(): Promise<{
  positions: ApplyPosition[];
}> {
  // Get all positions first
  const { positions: allPositions } = await getAllPositions();

  // Filter by current user's scope and embed canEdit property
  const filteredPositions = await filterItemsByScope(allPositions);

  return {
    positions: filteredPositions,
  };
}
