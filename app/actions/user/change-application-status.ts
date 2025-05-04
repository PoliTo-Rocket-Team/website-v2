"use server";
import { createClient } from "@/utils/supabase/server";

export async function changeApplicationStatus(applicationId: string, newStatus: string) {
  try {
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }
    
    const { data: userData } = await supabase
      .from("users")
      .select("member")
      .eq("id", user.id)
      .single();
    
    if (!userData?.member) {
      return { success: false, error: "Unauthorized" };
    }

    const { data: userRoles } = await supabase
      .from("roles")
      .select("type")
      .eq("member_id", userData.member);
    
    const hasPermission = userRoles && userRoles.some(role => 
      ["president", "head", "lead"].includes(role.type)
    );
    
    if (!hasPermission) {
      return { success: false, error: "Unauthorized" };
    }
    
    // Update the application status
    const { error } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", applicationId);
    
    if (error) {
      console.error("Error updating application status:", error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error in changeApplicationStatus:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}