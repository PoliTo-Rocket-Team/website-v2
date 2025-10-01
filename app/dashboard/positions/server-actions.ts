"use server";

import { ApplyPosition } from "@/app/actions/types";
import { createSupabaseClient } from "@/utils/supabase/client";

export async function handleDelete(id: number) {
  const supabase = await createSupabaseClient();

  const { error: posError } = await supabase
    .from("apply_positions")
    .delete()
    .eq("id", id);

  if (posError) {
    console.error("[handleDelete] could not delete position:", posError);
    throw new Error(`Failed to delete position ${id}: ${posError.message}`);
  }
}

export async function handleEditPosition(
  id: number,
  updatedData: Partial<{ title: string; description: string; status: boolean }>
) {
  const supabase = await createSupabaseClient();

  const { error: posError } = await supabase
    .from("apply_positions")
    .update(updatedData)
    .eq("id", id);

  if (posError) {
    console.error("[handleEditPosition] could not update position:", posError);
    throw new Error(`Failed to update position ${id}: ${posError.message}`);
  }
}

export async function handleAddPosition(data: {
  title: string;
  description: string;
  required_skills: string[];
  desirable_skills: string[];
  custom_questions: string[];
  requires_motivation_letter: boolean;
  division_id: number;
}): Promise<ApplyPosition> {
  const supabase = await createSupabaseClient();

  const { data: insertedData, error: posError } = await supabase
    .from("apply_positions")
    .insert({
      title: data.title,
      description: data.description,
      required_skills: data.required_skills,
      desirable_skills: data.desirable_skills,
      custom_questions: data.custom_questions,
      requires_motivation_letter: data.requires_motivation_letter,
      division_id: data.division_id,
      status: true, // New positions are open by default
    })
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
    .single();

  if (posError) {
    console.error("[handleAddPosition] could not add position:", posError);
    throw new Error(`Failed to add position: ${posError.message}`);
  }

  if (!insertedData) {
    throw new Error("No data returned after inserting position");
  }

  // Transform to match ApplyPosition type
  const applyPosition: ApplyPosition = {
    ...insertedData,
    div_name: insertedData.divisions?.name || "",
    div_code: insertedData.divisions?.code || "",
    dept_id: insertedData.divisions?.departments?.id || 0,
    dept_name: insertedData.divisions?.departments?.name || "",
    dept_code: insertedData.divisions?.departments?.code || "",
    canEdit: true, // User can edit positions they just created
  };

  return applyPosition; // return the complete position data
}
