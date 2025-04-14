"use server";

import { createClient } from "@/utils/supabase/server";

export async function updateApplicationStatus(applicationId: number, newStatus: string) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", applicationId)
      .select();

    if (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }

    return { 
      success: true, 
      data 
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    };
  }
}