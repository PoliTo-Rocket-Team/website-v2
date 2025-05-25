"use server";

import { Database } from "@/types/supabase";
import { createClient } from "@/utils/supabase/server";

export type ApplicationData = {
  positionId: number;
  customAnswers: string[];
  cvName?: string;
  mlName?: string;
};

export async function applyToPosition(data: ApplicationData) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "User not authenticated" };
  }

  // Check if user already applied to this position
  const { data: existingApplication } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("open_position_id", data.positionId)
    .single();

  if (existingApplication) {
    return { error: "You have already applied to this position" };
  }

  // Insert new application record to public.applications
  const { data: application, error } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      open_position_id: data.positionId,
      custom_answers: data.customAnswers,
      cv_name: data.cvName,
      ml_name: data.mlName,
      status: "pending" as Database["public"]["Enums"]["application_status"],
    })
    .select()
    .single();

  if (error) {
    console.error("[applyToPosition] Error inserting application:", error);
    return { error: "Failed to submit application" };
  }

  return { success: true, application };
}

export async function createUserFromLocalStorage(userData: {
  email: string;
  firstName: string;
  lastName: string;
  levelOfStudy?: string;
  linkedin?: string;
  politoId?: string;
  program?: string;
  origin?: string;
}) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "User not authenticated" };
  }

  // Check if user already exists in database
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .single();

  if (existingUser) {
    return { success: true, user: existingUser };
  }

  // Add Record in public.users (create new user from localStorage data)
  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      id: user.id,
      email: userData.email,
      first_name: userData.firstName,
      last_name: userData.lastName,
      level_of_study: userData.levelOfStudy,
      linkedin: userData.linkedin,
      polito_id: userData.politoId,
      program: userData.program,
      origin: userData.origin,
    })
    .select()
    .single();

  if (error) {
    console.error("[createUserFromLocalStorage] Error creating user:", error);
    return { error: "Failed to create user profile" };
  }

  return { success: true, user: newUser };
}

export async function checkIfAlreadyApplied(positionId: number) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { hasApplied: false };
  }

  const { data: application } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("open_position_id", positionId)
    .single();

  return { hasApplied: !!application };
}

// Get all open positions (no role filtering) - for public apply page
export async function getAllOpenPositions() {
  const supabase = await createClient();

  const { data: positions, error } = await supabase
    .from("apply_positions")
    .select(`
      *,
      divisions(
        *,
        departments(name)
      )
    `)
    .eq("status", true); // Only get open positions

  if (error) {
    console.error("[getAllOpenPositions] Error fetching positions:", error);
    return { positions: [] };
  }

  return { positions: positions || [] };
} 