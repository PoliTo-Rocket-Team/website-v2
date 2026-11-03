import { mayExportMembers, membersExportFileName, membersWorkbook, XLSX_TYPE } from "@/lib/dashboard/members-export";
import { openDashboard } from "@/lib/dashboard/open";

// The Members page's "Export to Excel" (issue #539): every member of the team
// with all their data, as one .xlsx. It checks the viewer before it reads
// anything: signed out is 401, anyone without full access 403. The file is
// built here from the whole-team directory the server reads, never from rows
// the browser sent, so the page's search, filters and pages never narrow it.

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function refusal(status: 401 | 403, text: string): Response {
  return new Response(text, { status, headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(): Promise<Response> {
  const opening = await openDashboard();
  if (opening.kind !== "open") return refusal(401, "Sign in to export members.");
  const { data } = opening;
  if (!mayExportMembers(data.viewer)) return refusal(403, "Only full access may export members.");

  const directory = await data.members();
  if (directory.scope !== "whole-team") return refusal(403, "Only full access may export members.");

  const file = await membersWorkbook(directory.people);
  return new Response(new Uint8Array(file), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": XLSX_TYPE,
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(file.byteLength),
      "Content-Disposition": `attachment; filename="${membersExportFileName(new Date())}"`,
    },
  });
}
