import { cronAuthorized, cronRefused } from "@/lib/cron";
import { databaseWithdrawnFilesStore } from "@/lib/dashboard/database-withdrawn-files";
import { deleteWithdrawnFiles } from "@/lib/dashboard/withdrawn-files";

// Daily (vercel.json `crons`, issue #178): deletes the files of applications
// withdrawn at least 30 days ago. Answers with how many files it deleted and
// how many it left for the next run.
export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return cronRefused();
  const run = await deleteWithdrawnFiles(new Date(), databaseWithdrawnFilesStore);
  return Response.json(
    { deleted: run.deleted.length, failed: run.failed.length },
    { status: run.failed.length === 0 ? 200 : 500, headers: { "Cache-Control": "no-store" } },
  );
}
