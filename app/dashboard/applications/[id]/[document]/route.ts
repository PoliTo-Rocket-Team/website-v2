import { applicationIdOf, DOCUMENT_NO_STORE, documentHeaders, documentKindOf, type StoredDocument } from "@/lib/dashboard/application-documents";
import { DashboardRefused } from "@/lib/dashboard/data";
import { openDashboard } from "@/lib/dashboard/open";
import { readPrivateFile } from "@/lib/storage/private-store";

// An application's CV or motivation letter, opened from the Applications
// panel (issue #406). It answers only a viewer whose Applications page lists
// the application (`applicationDocument`, lib/dashboard/data.ts) and streams
// the bytes from the private Blob store, so the file's store URL never leaves
// the server.

function refusal(status: 401 | 403 | 404, text: string): Response {
  return new Response(text, { status, headers: { ...DOCUMENT_NO_STORE, "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string; document: string }> }): Promise<Response> {
  const params = await context.params;
  const applicationId = applicationIdOf(params.id);
  const kind = documentKindOf(params.document);
  if (applicationId === null || kind === null) return refusal(404, "Not found");

  const opening = await openDashboard();
  if (opening.kind !== "open") return refusal(401, "Sign in to open this file.");

  let stored: StoredDocument | null;
  try {
    stored = await opening.data.applicationDocument(applicationId, kind);
  } catch (error) {
    if (error instanceof DashboardRefused) return refusal(403, "You do not have access to this application.");
    throw error;
  }
  const file = stored === null ? null : await readPrivateFile(stored.pathname);
  if (stored === null || file === null) return refusal(404, "This file is not stored.");

  return new Response(file.stream, { status: 200, headers: documentHeaders(stored.name, file.size) });
}
