"use server";

import { createSupabaseClient } from "@/utils/supabase/client";
import { auth } from "@/auth";

/**
 * Get the current authenticated user's member ID
 * @returns Promise<number | null> - Returns member ID or null if not found/authenticated
 */
export async function getCurrentMemberId(): Promise<number | null> {
  const supabase = await createSupabaseClient();
  //! todo remove debug log
  console.log("database request on get member id");
  const session = await auth();

  if (!session?.userId) {
    return null;
  }

  const { data: userData, error } = await supabase
    .from("users")
    .select("member")
    .eq("id", session.userId)
    .single();

  if (error) {
    console.error("Error getting user member ID:", error);
    return null;
  }

  return userData?.member || null;
}
