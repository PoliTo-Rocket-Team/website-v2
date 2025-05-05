"use server";
import { createClient } from "@/utils/supabase/server";

export async function changeApplicationStatus(applicationId: string, newStatus: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };
  
  const { error } = await supabase
    .from("applications")
    .update({ status: newStatus })
    .eq("id", applicationId);
  
  return error 
    ? { success: false, error: error.message } 
    : { success: true };
}