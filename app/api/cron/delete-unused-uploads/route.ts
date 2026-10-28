import { cronAuthorized, cronRefused } from "@/lib/cron";
import { databasePublicFiles } from "@/lib/dashboard/database-public-files";
import { listPublicFiles } from "@/lib/storage/public-store";
import { sweepUnusedUploads } from "@/lib/storage/upload-sweep";

// Daily (vercel.json `crons`, issue #831): deletes the content editors'
// uploads that are a day old or more and that no row names, the photos a
// panel uploaded and no save kept. Answers how many it deleted and how many
// deletes failed, which the next run tries again.
export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return cronRefused();
  const run = await sweepUnusedUploads(new Date(), { list: listPublicFiles, ...databasePublicFiles });
  return Response.json(run, { status: run.failed === 0 ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}
