/**
 * File Serving API Route for Application Documents (File Hash Based)
 *
 * Serves CV and cover letter files with authentication and permission validation.
 * URL format: /docs/applications/[filehash]/[filename]
 * Example: /docs/applications/abc123def456/john_doe_cv.pdf
 *
 * Features:
 * - Single database query for optimal performance
 * - Role-based access control (owner, admin, division/department permissions)
 * - Direct file streaming from R2/MinIO storage using hash-based keys
 * - Support for both inline viewing and downloads
 * - Proper caching headers
 */

import { NextRequest, NextResponse } from "next/server";
import { getFile } from "@/utils/r2";
import { auth } from "@/auth";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getUserScope, ScopeInfo } from "@/app/actions/get-user-scope";

/**
 * Validates user access to a specific file by file hash
 *
 * Uses a SINGLE optimized database query to fetch:
 * - Application data with position/division/department info
 * - File data based on file_hash match
 *
 * @param fileHash - File hash (16 character hash)
 * @param requestingUserId - ID of the user requesting access
 * @returns Object with validation result, application data, and matched file
 */
//! todo get cached getApplicationsByMemberScope function and check that if there are any match with file hash, if yes show the file, if no show unkown page
async function validateFileAccessByFileHash(
  fileHash: string,
  requestingUserId: string
): Promise<{ isValid: boolean; application?: any; matchedFile?: any }> {
  const supabase = await createSupabaseClient();

  console.log("database request on docs route (file hash based)");

  // SINGLE OPTIMIZED QUERY: Find file by file_hash AND get associated application in one query
  // Use JOIN to get both file data and application data with permissions in one request
  const { data: result, error } = await supabase
    .from("application_files")
    .select(
      `
      id,
      r2_key,
      original_filename,
      file_hash,
      user_id,
      cv_applications:applications!cv_file_id(
        id,
        user_id,
        apply_position_id,
        apply_positions!inner(
          id,
          title,
          division_id,
          divisions!inner(
            id,
            name,
            dept_id,
            departments!inner(
              id,
              name
            )
          )
        )
      ),
      cover_applications:applications!cover_letter_file_id(
        id,
        user_id,
        apply_position_id,
        apply_positions!inner(
          id,
          title,
          division_id,
          divisions!inner(
            id,
            name,
            dept_id,
            departments!inner(
              id,
              name
            )
          )
        )
      )
    `
    )
    .eq("file_hash", fileHash)
    .single();

  if (error || !result) {
    console.log(
      `❌ File with hash ${fileHash} not found or no associated application`
    );
    return { isValid: false };
  }

  const matchedFile = result;
  const allApplications = [
    ...(result.cv_applications || []),
    ...(result.cover_applications || []),
  ];

  if (allApplications.length === 0) {
    console.log(`❌ No applications found using file with hash ${fileHash}`);
    return { isValid: false };
  }

  console.log(`📄 File is used by ${allApplications.length} application(s)`);

  // Log which applications use this file for debugging
  allApplications.forEach(app => {
    const position = app.apply_positions as any;
    console.log(
      `  - Application ${app.id} by user ${app.user_id} for ${position?.title || "unknown position"}`
    );
  });

  // Check if user has access to ANY of the applications that use this file
  console.log(
    `🔐 Checking access across ${allApplications.length} application(s)...`
  );

  for (const application of allApplications) {
    // PERMISSION CHECK 1: Application Owner
    // Users can always access their own application files
    if (application.user_id === requestingUserId) {
      const position = application.apply_positions as any;
      console.log(
        `✅ Owner access: User ${requestingUserId} owns application ${application.id} for ${position?.title || "unknown position"}`
      );
      return { isValid: true, application, matchedFile };
    }
  }

  // PERMISSION CHECK 2 & 3: Administrative Access for any application
  // Check if user has admin/manager permissions for any of these applications
  const { scope } = await getUserScope("applications");

  if (Array.isArray(scope)) {
    return { isValid: false };
  }

  const scopeInfo = scope as ScopeInfo;

  // Admin or org-wide access
  if (scopeInfo.hasAdminAccess || scopeInfo.hasOrgAccess) {
    console.log(
      `✅ Admin/Org access: User ${requestingUserId} has org-wide access to file used by ${allApplications.length} application(s)`
    );
    return { isValid: true, application: allApplications[0], matchedFile };
  }

  // Check division/department level access for each application
  for (const application of allApplications) {
    const applyPosition = application.apply_positions as any;
    const division = applyPosition.divisions as any;
    const divisionId = applyPosition.division_id;
    const deptId = division?.dept_id;

    // Check if user has permission specifically for THIS application's division/department
    const hasPermission =
      (divisionId && scopeInfo.divisionIds.has(divisionId)) ||
      (deptId && scopeInfo.departmentIds.has(deptId));

    if (hasPermission) {
      console.log(
        `✅ Division/Dept access: User ${requestingUserId} can view application ${application.id} - ${applyPosition.title} (division: ${division?.name}, dept: ${division?.departments?.[0]?.name})`
      );
      return { isValid: true, application, matchedFile };
    } else {
      console.log(
        `❌ No permission: User ${requestingUserId} cannot access application ${application.id} - ${applyPosition.title} (division: ${division?.name}, dept: ${division?.departments?.[0]?.name})`
      );
    }
  }

  console.log(
    `❌ Access denied: User ${requestingUserId} cannot access file used by ${allApplications.length} application(s)`
  );
  return { isValid: false };
}

/**
 * Constructs the storage key for retrieving file from R2/MinIO using r2_key
 *
 * @param matchedFile - File data from database
 * @returns Storage key for R2/MinIO retrieval
 */
function getStorageKeyFromFile(matchedFile: any): string {
  // Use the r2_key directly from the database
  return matchedFile.r2_key;
}

/**
 * Main GET handler for serving application files by file hash
 *
 * URL: /docs/applications/[filehash]/[filename]
 * Example: /docs/applications/abc123def456/john_doe_cv.pdf
 *
 * Query params:
 * - download=true: Forces download instead of inline viewing
 *
 * Response:
 * - 200: File content with appropriate headers
 * - 400: Invalid URL format
 * - 401: Not authenticated
 * - 403: Access denied
 * - 404: File not found in storage
 * - 500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { r2key: string; filename: string } }
) {
  try {
    const fileHash = params.r2key; // Using r2key param but treating it as file hash
    const filename = params.filename;

    console.log("📄 File Request (file hash):", {
      fileHash,
      filename,
    });

    // Check authentication
    const session = await auth();
    if (!session?.userId) {
      console.log("❌ No authentication");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "true";

    // Validate access permissions
    console.log("🔐 Checking access permissions...");
    const { isValid, application, matchedFile } =
      await validateFileAccessByFileHash(fileHash, session.userId);

    if (!isValid || !application || !matchedFile) {
      return new NextResponse("Access denied", { status: 403 });
    }

    console.log("✅ Access granted");

    // Get the storage key from the matched file
    const storageKey = getStorageKeyFromFile(matchedFile);

    console.log("📁 Storage key:", storageKey);

    // Get file from R2
    const response = await getFile(storageKey);

    if (!response.Body) {
      console.log("❌ File not found in storage");
      return new NextResponse("File not found", { status: 404 });
    }

    console.log("✅ File found in storage");

    const bytes = await response.Body.transformToByteArray();
    const buffer = Buffer.from(bytes);

    // PREPARE RESPONSE HEADERS
    // Set appropriate headers for PDF viewing/downloading
    const headers = new Headers();
    headers.set("Content-Type", response.ContentType || "application/pdf");
    headers.set("Content-Length", buffer.length.toString());

    // Handle download vs inline viewing
    if (download) {
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    } else {
      headers.set("Content-Disposition", "inline");
    }

    // CACHING STRATEGY
    // Cache files privately for authenticated users to improve performance
    headers.set("Cache-Control", "private, max-age=3600"); // 1 hour cache
    headers.set("ETag", response.ETag || ""); // Enable conditional requests

    console.log("✅ Serving file successfully");
    return new NextResponse(buffer, { status: 200, headers });
  } catch (error) {
    console.error("❌ File serving error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
