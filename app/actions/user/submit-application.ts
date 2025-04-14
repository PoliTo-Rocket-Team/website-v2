"use server";

import { createClient } from "@/utils/supabase/server";

interface CustomAnswer {
  question: string;
  answer: string;
}

interface ApplicationData {
  open_position_id: number;
  cv_name: string;
  ml_name: string;
  applied_at: string;
  status: string;
  custom_answers: CustomAnswer[];
  user_id: string;
}

export async function submitApplication(applicationData: ApplicationData) {
  try {
    const supabase = await createClient();
    
    // First, get the highest ID to determine the next ID
    const { data: maxIdData, error: maxIdError } = await supabase
      .from("applications")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);
    
    if (maxIdError) {
      console.error("Error getting max ID:", maxIdError);
      return { success: false, error: maxIdError.message };
    }
    
    // Calculate the next ID (start with 1 if no records exist)
    const nextId = maxIdData && maxIdData.length > 0 ? maxIdData[0].id + 1 : 1;
    
    // Add the ID to the application data
    const completeData = {
      id: nextId,
      ...applicationData
    };
    
    console.log("Inserting application with ID:", nextId);
    
    // Insert with explicit ID
    const { data, error } = await supabase
      .from("applications")
      .insert(completeData)
      .select();
    
    if (error) {
      console.error("Error submitting application:", error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error("Error in submitApplication:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "An unknown error occurred" 
    };
  }
}