import { createSupabaseClient } from "@/utils/supabase/server";

/**
 * Upload a file to Supabase Storage
 * @param file - The file to upload
 * @param path - The path within the bucket (e.g., "cv/" or "motivation-letters/")
 * @param bucketName - The name of the Supabase Storage bucket (default: "cvs")
 * @returns The filename of the uploaded file
 * @throws Error if file type is not PDF, file is too large, or upload fails
 */
export async function uploadFileToStorage(
  file: File,
  path: string,
  bucketName: string = "cvs"
): Promise<string> {
  // Validate file type
  if (file.type !== "application/pdf") {
    throw new Error("Only PDF files are allowed");
  }

  // Validate file size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File size must be less than 10MB");
  }

  // Convert file to buffer
  const buffer = await file.arrayBuffer();

  // Generate unique filename
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;

  // Get Supabase client
  const supabase = await createSupabaseClient();

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from(bucketName)
    .upload(path + fileName, buffer, {
      contentType: "application/pdf",
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return fileName;
}

