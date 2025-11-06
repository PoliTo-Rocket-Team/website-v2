"use server";

import { createSupabaseClient } from "@/utils/supabase/client";
import { revalidatePath } from "next/cache";

type SubmitApplicationResult = {
  success: boolean;
  error?: string;
  applicationId?: number;
};

// Mock user ID for testing - will be replaced with actual auth later
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Submit a new application for a position
 * @param formData - Form data containing CV file, position ID, motivation letter, and custom answers
 * @returns Result object with success status and optional error message
 */
export async function submitApplication(
  formData: FormData
): Promise<SubmitApplicationResult> {
  const supabase = await createSupabaseClient();

  try {
    // Extract form data
    const cvFile = formData.get("cv") as File;
    const positionId = parseInt(formData.get("positionId") as string);
    const motivationLetter = formData.get("motivationLetter") as string;
    const customAnswersJson = formData.get("customAnswers") as string;
    const customAnswers = customAnswersJson ? JSON.parse(customAnswersJson) : [];

    // Use mock user ID for now (authentication will be added later)
    const userId = MOCK_USER_ID;

    // Validate inputs
    if (!cvFile || !positionId || !userId) {
      return {
        success: false,
        error: "Missing required fields",
      };
    }

    // Check if user has already applied to this position
    const { data: existingApplication } = await supabase
      .from("applications")
      .select("id")
      .eq("apply_position_id", positionId)
      .eq("user_id", userId)
      .single();

    if (existingApplication) {
      return {
        success: false,
        error: "You have already applied to this position",
      };
    }

    // Upload CV to Supabase Storage
    const timestamp = Date.now();
    // Sanitize filename: remove spaces and special characters
    const sanitizedFileName = cvFile.name
      .replace(/\s+/g, '_')  // Replace spaces with underscores
      .replace(/[^a-zA-Z0-9._-]/g, '');  // Remove special characters
    const cvFileName = `${userId}_${positionId}_${timestamp}_${sanitizedFileName}`;
    const cvPath = `applications/${cvFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("cvs")
      .upload(cvPath, cvFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading CV:", uploadError);
      return {
        success: false,
        error: `Failed to upload CV: ${uploadError.message}`,
      };
    }

    // Handle motivation letter (store as text file if provided)
    let mlName: string | null = null;
    if (motivationLetter && motivationLetter.trim()) {
      mlName = `ml_${userId}_${positionId}_${timestamp}`;
      
      // Upload motivation letter as a text file
      const mlBlob = new Blob([motivationLetter], { type: "text/plain" });
      const mlPath = `applications/${mlName}.txt`;
      
      const { error: mlUploadError } = await supabase.storage
        .from("cvs")
        .upload(mlPath, mlBlob, {
          cacheControl: "3600",
          upsert: false,
        });
      
      if (mlUploadError) {
        console.error("Error uploading motivation letter:", mlUploadError);
        // Continue even if motivation letter upload fails
      } else {
        mlName = mlPath;
      }
    }

    // Convert custom answers to JSONB format
    const customAnswersJsonb = customAnswers.map((answer: string, index: number) => ({
      question_index: index,
      answer: answer,
    }));

    // Insert application into database
    const { data: application, error: insertError } = await supabase
      .from("applications")
      .insert({
        apply_position_id: positionId,
        user_id: userId,
        cv_name: cvPath,
        ml_name: mlName,
        custom_answers: customAnswersJsonb,
        status: "received",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error inserting application:", insertError);
      
      // Clean up uploaded files if database insert fails
      await supabase.storage.from("cvs").remove([cvPath]);
      if (mlName) {
        await supabase.storage.from("cvs").remove([mlName]);
      }
      
      return {
        success: false,
        error: "Failed to submit application. Please try again.",
      };
    }

    // Revalidate relevant paths
    revalidatePath("/dashboard/applications");
    revalidatePath("/apply");

    return {
      success: true,
      applicationId: application.id,
    };
  } catch (error) {
    console.error("Unexpected error submitting application:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

