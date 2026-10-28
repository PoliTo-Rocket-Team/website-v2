import { eq, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { applicationFiles, applications } from "@/db/schema";
import { documentHeaders, type DocumentKind, type StoredDocument } from "@/lib/dashboard/application-documents";
import { DashboardRefused } from "@/lib/dashboard/data";
import { openDashboard } from "@/lib/dashboard/open";
import { getCurrentUserId } from "@/lib/current-user";
import { parsePrivatePathname } from "@/lib/storage/pathname";
import { readPrivateFile } from "@/lib/storage/private-store";

// The old address of an application's CV or motivation letter, by the file's
// hash. The applicant opens their own file here. Anyone else opens it only
// when the dashboard's document rule lets them (`applicationDocument`,
// lib/dashboard/data.ts, the rule app/dashboard/applications/[id]/[document]
// answers by): the same viewers, the same units, nothing withdrawn, and no
// scope row that outlived its holder's roles (issue #477).

type FileApplication = { id: number; userId: string | null; kind: DocumentKind };

/** The stored file the hash names, and every application that sent it, each with the document it is there. */
async function readFile(fileHash: string): Promise<{ file: StoredDocument; applications: FileApplication[] } | null> {
  const db = getDb();
  const [matched] = await db
    .select({ id: applicationFiles.id, pathname: applicationFiles.pathname, name: applicationFiles.originalFilename })
    .from(applicationFiles)
    .where(eq(applicationFiles.fileHash, fileHash))
    .limit(1);
  const pathname = matched ? parsePrivatePathname(matched.pathname) : null;
  if (!matched || pathname === null) return null;
  const rows = await db
    .select({ id: applications.id, userId: applications.userId, cvFileId: applications.cvFileId })
    .from(applications)
    .where(or(eq(applications.cvFileId, matched.id), eq(applications.coverLetterFileId, matched.id)));
  return {
    file: { pathname, name: matched.name },
    applications: rows.map((r) => ({ id: r.id, userId: r.userId, kind: r.cvFileId === matched.id ? "cv" : "motivation-letter" })),
  };
}

/**
 * The file the viewer may open: the matched file when one of its applications
 * is theirs, else the document the dashboard's rule hands them for one of its
 * applications; null when neither lets them.
 */
async function openableFile(fileHash: string, userId: string): Promise<StoredDocument | null> {
  const found = await readFile(fileHash);
  if (found === null) return null;
  if (found.applications.some((a) => a.userId === userId)) return found.file;
  const opening = await openDashboard();
  if (opening.kind !== "open") return null;
  for (const application of found.applications) {
    try {
      const stored = await opening.data.applicationDocument(application.id, application.kind);
      if (stored !== null && stored.pathname === found.file.pathname) return stored;
    } catch (error) {
      if (!(error instanceof DashboardRefused)) throw error;
    }
  }
  return null;
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

    const openable = await openableFile(fileHash, userId);
    if (openable === null) {
      return new NextResponse("Access denied", { status: 403 });
    }

    // The bytes are streamed from the private store; its URL never leaves the server.
    const file = await readPrivateFile(openable.pathname);
    if (file === null) {
      return new NextResponse("File not found", { status: 404 });
    }

    // The dashboard document route's headers (issue #831): never cached, a PDF the browser may not re-type, and an escaped name.
    return new NextResponse(file.stream, { status: 200, headers: documentHeaders(filename, file.size, download ? "attachment" : "inline") });
  } catch (error) {
    console.error("File serving error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
