"use server";

import { uploadFileToStorage } from "@/lib/storage";
import { createSupabaseClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

/**
 * Submit an application for a position
 * @param formData - FormData containing application fields
 * @returns Success or error response
 */
export async function submitApplication(formData: FormData) {
  try {
    // Extract form fields
    const name = formData.get("name") as string;
    const surname = formData.get("surname") as string;
    const studentNumber = formData.get("studentNumber") as string;
    const email = formData.get("email") as string;
    const major = formData.get("major") as string;
    const graduationYear = formData.get("graduationYear") as string;
    const positionId = formData.get("positionId") as string;
    const cv = formData.get("cv") as File;
    const motivation = formData.get("motivation") as File | null;

    // Validate required fields
    if (
      !name ||
      !surname ||
      !studentNumber ||
      !email ||
      !major ||
      !graduationYear ||
      !positionId ||
      !cv
    ) {
      throw new Error("All required fields must be filled");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    // Validate graduation year (reasonable range: 2020-2030)
    const year = parseInt(graduationYear, 10);
    if (isNaN(year) || year < 2020 || year > 2030) {
      throw new Error("Graduation year must be between 2020 and 2030");
    }

    // Extract custom answers
    const customAnswers: Array<{ questionIndex: number; answer: string }> =
      [];
    let index = 0;
    while (true) {
      const answer = formData.get(`customAnswer-${index}`) as string | null;
      if (answer === null) {
        break;
      }
      customAnswers.push({
        questionIndex: index,
        answer: answer.trim(),
      });
      index++;
    }

    // Upload CV file
    const cvName = await uploadFileToStorage(cv, "cv/");

    // Upload motivation letter if provided
    let mlName: string | null = null;
    if (motivation && motivation.size > 0) {
      mlName = await uploadFileToStorage(motivation, "motivation-letters/");
    }

    // Get Supabase client
    const supabase = await createSupabaseClient();

    // Insert application record
    const { error } = await supabase.from("applications").insert({
      apply_position_id: parseInt(positionId, 10),
      user_id: null, // Authentication will be added later
      ml_name: mlName,
      cv_name: cvName,
      custom_answers: customAnswers.length > 0 ? customAnswers : null,
      status: "received",
    });

    if (error) {
      throw new Error(`Failed to submit application: ${error.message}`);
    }

    // Redirect to success page or apply page
    redirect("/apply?success=true");
  } catch (error) {
    console.error("Error submitting application:", error);
    throw error;
  }
}

