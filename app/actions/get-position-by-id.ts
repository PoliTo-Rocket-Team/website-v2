"use server";

import { createSupabaseClient } from "@/utils/supabase/client";
import { ApplyPosition } from "./types";

/**
 * Get a single position by ID with division and department info
 * @param id - The position ID
 * @returns The position data or null if not found
 */
export async function getPositionById(id: number): Promise<ApplyPosition | null> {
  const supabase = await createSupabaseClient();

  const { data: position, error } = await supabase
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
    .eq("id", id)
    .eq("is_deleted", false)
    .single();

  if (error) {
    console.error("Error getting position:", error);
    return null;
  }

  if (!position) {
    return null;
  }

  // Transform to match ApplyPosition type
  const applyPosition: ApplyPosition = {
    ...position,
    div_name: position.divisions?.name || "",
    div_code: position.divisions?.code || "",
    dept_id: position.divisions?.departments?.id || 0,
    dept_name: position.divisions?.departments?.name || "",
    dept_code: position.divisions?.departments?.code || "",
  };

  return applyPosition;
}

