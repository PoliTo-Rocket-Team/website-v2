"use server";

import { createSupabaseClient } from "@/utils/supabase/client";

export type UserApplication = {
  id: number;
  applied_at: string;
  status: "pending" | "rejected" | "accepted" | "received" | "accepted_by_another_team";
  position: {
    id: number;
    title: string;
    dept_name: string;
    div_name: string;
  };
};

// Mock user ID for testing - will be replaced with actual auth later
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Get all applications for the mock user (auth will be added later)
 * @returns Array of user applications with position details
 */
export async function getUserApplications(): Promise<UserApplication[]> {
  const supabase = await createSupabaseClient();

  // Use mock user ID for now
  const userId = MOCK_USER_ID;

  const { data: applications, error } = await supabase
    .from("applications")
    .select(
      `
      id,
      applied_at,
      status,
      apply_positions!inner(
        id,
        title,
        divisions(
          name,
          departments(
            name
          )
        )
      )
    `
    )
    .eq("user_id", userId)
    .order("applied_at", { ascending: false });

  if (error) {
    console.error("Error fetching user applications:", error);
    return [];
  }

  if (!applications) {
    return [];
  }

  // Transform data to match UserApplication type
  const userApplications: UserApplication[] = applications.map((app: any) => ({
    id: app.id,
    applied_at: app.applied_at,
    status: app.status,
    position: {
      id: app.apply_positions.id,
      title: app.apply_positions.title,
      dept_name: app.apply_positions.divisions?.departments?.name || "N/A",
      div_name: app.apply_positions.divisions?.name || "N/A",
    },
  }));

  return userApplications;
}

