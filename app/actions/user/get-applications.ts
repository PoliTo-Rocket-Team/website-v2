"use server";

import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/supabase";

export type Application = Database["public"]["Tables"]["applications"]["Row"] & {
  users?: Partial<Database["public"]["Tables"]["users"]["Row"]> | null;
  apply_positions?: (Partial<Database["public"]["Tables"]["apply_positions"]["Row"]> & {
    divisions?: Partial<Database["public"]["Tables"]["divisions"]["Row"]> | null;
  }) | null;
};

export async function getAllApplications() {
  const supabase = await createClient();
  
  // Get all applications with related data
  const { data: applications, error } = await supabase
    .from("applications")
    .select(`
      *,
      users (
        id,
        first_name,
        last_name,
        email,
        level_of_study,
        program
      ),
      apply_positions (
        id,
        title,
        description,
        division_id,
        divisions (
          id,
          name,
          subteam_id
        )
      )
    `);

  if (error) {
    console.error("Error getting applications:", error);
    return { applications: [] };
  }

  return {
    applications: applications || []
  };
}