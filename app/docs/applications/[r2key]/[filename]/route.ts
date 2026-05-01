import { and, eq, isNull, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getUserScope, type ScopeInfo } from "@/app/actions/get-user-scope";
import { getDb } from "@/db/client";
import {
  applicationFiles,
  applications,
  applyPositions,
  departments,
  divisions,
} from "@/db/schema";
import { getCurrentUserId } from "@/lib/current-user";
import { getFile } from "@/utils/r2";

type MatchedFile = {
  id: number;
  r2Key: string;
  originalFilename: string;
  fileHash: string | null;
};

async function readResponseBodyAsBuffer(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  ) {
    return Buffer.from(await body.transformToByteArray());
  }

  if (
    body &&
    typeof body === "object" &&
    "arrayBuffer" in body &&
    typeof body.arrayBuffer === "function"
  ) {
    return Buffer.from(await body.arrayBuffer());
  }

  throw new Error("Unsupported file response body");
}

type ApplicationAccessRow = {
  id: number;
  userId: string | null;
  positionTitle: string | null;
  divisionId: number | null;
  divisionName: string;
  departmentId: number | null;
  departmentName: string;
};

async function validateFileAccessByFileHash(
  fileHash: string,
  requestingUserId: string,
): Promise<{
  isValid: boolean;
  application?: ApplicationAccessRow;
  matchedFile?: MatchedFile;
}> {
  const db = getDb();

  const [matchedFile] = await db
    .select({
      id: applicationFiles.id,
      r2Key: applicationFiles.r2Key,
      originalFilename: applicationFiles.originalFilename,
      fileHash: applicationFiles.fileHash,
    })
    .from(applicationFiles)
    .where(eq(applicationFiles.fileHash, fileHash))
    .limit(1);

  if (!matchedFile) {
    return { isValid: false };
  }

  const fileApplications = await db
    .select({
      id: applications.id,
      userId: applications.userId,
      positionTitle: applyPositions.title,
      divisionId: divisions.id,
      divisionName: divisions.name,
      departmentId: departments.id,
      departmentName: departments.name,
    })
    .from(applications)
    .innerJoin(applyPositions, eq(applications.applyPositionId, applyPositions.id))
    .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    .where(
      and(
        isNull(divisions.closedAt),
        isNull(departments.closedAt),
        or(
          eq(applications.cvFileId, matchedFile.id),
          eq(applications.coverLetterFileId, matchedFile.id),
        ),
      ),
    );

  if (fileApplications.length === 0) {
    return { isValid: false };
  }

  for (const application of fileApplications) {
    if (application.userId === requestingUserId) {
      return { isValid: true, application, matchedFile };
    }
  }

  const { scope } = await getUserScope("applications");
  if (Array.isArray(scope)) {
    return { isValid: false };
  }

  const scopeInfo = scope as ScopeInfo;

  if (scopeInfo.hasAdminAccess || scopeInfo.hasOrgAccess) {
    return { isValid: true, application: fileApplications[0], matchedFile };
  }

  for (const application of fileApplications) {
    const hasPermission =
      (application.divisionId !== null &&
        scopeInfo.divisionIds.has(application.divisionId)) ||
      (application.departmentId !== null &&
        scopeInfo.departmentIds.has(application.departmentId));

    if (hasPermission) {
      return { isValid: true, application, matchedFile };
    }
  }

  return { isValid: false };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ r2key: string; filename: string }> },
) {
  try {
    const params = await context.params;
    const fileHash = params.r2key;
    const filename = params.filename;

    const userId = await getCurrentUserId();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "true";

    const { isValid, application, matchedFile } =
      await validateFileAccessByFileHash(fileHash, userId);

    if (!isValid || !application || !matchedFile) {
      return new NextResponse("Access denied", { status: 403 });
    }

    const response = await getFile(matchedFile.r2Key);
    if (!response.Body) {
      return new NextResponse("File not found", { status: 404 });
    }

    const buffer = await readResponseBodyAsBuffer(response.Body);

    const headers = new Headers();
    headers.set("Content-Type", response.ContentType || "application/pdf");
    headers.set("Content-Length", buffer.length.toString());
    headers.set(
      "Content-Disposition",
      download ? `attachment; filename="${filename}"` : "inline",
    );
    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("ETag", response.ETag || "");

    return new NextResponse(buffer, { status: 200, headers });
  } catch (error) {
    console.error("File serving error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
