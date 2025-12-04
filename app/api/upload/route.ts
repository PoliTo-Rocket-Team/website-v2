import { NextRequest, NextResponse } from "next/server";
import { uploadFileWithType } from "@/utils/r2";
import { createHash } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folder = formData.get("folder") as string;

    // Generate unique key for R2 storage
    const fileExtension = file.name.split(".").pop();

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file size limit (50MB = 50 * 1024 * 1024 bytes)
    const maxFileSize = 20 * 1024 * 1024; // 20MB in bytes
    if (file.size > maxFileSize) {
      return NextResponse.json(
        {
          error: "File too large",
          message: `File size must be less than 20MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        },
        { status: 413 } // 413 Payload Too Large
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate content hash for deduplication and integrity (16 characters)
    const contentHash = createHash("sha256").update(buffer).digest("hex").substring(0, 16);

    // Use content hash for storage key (enables deduplication)
    const key = `${folder}/${contentHash}.${fileExtension}`;

    // Upload file to R2 only
    const uploadResponse = await uploadFileWithType(buffer, key, file.type);

    // Return file metadata without saving to database
    //! todo make sure to handle database insertion on apply form especially for hash
    // The apply form will handle database insertion
    return NextResponse.json({
      success: true,
      file: {
        r2_key: key,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        file_hash: contentHash,
      },
      etag: uploadResponse.ETag,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Error uploading file" },
      { status: 500 }
    );
  }
}
