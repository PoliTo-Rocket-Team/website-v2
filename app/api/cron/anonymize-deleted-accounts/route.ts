import { cronAuthorized, cronRefused } from "@/lib/cron";
import { anonymizeDeletedAccounts } from "@/lib/dashboard/anonymize";
import { databaseAnonymizationStore } from "@/lib/dashboard/database-anonymize";

// Daily (vercel.json `crons`, issue #191): anonymizes the accounts deleted at
// least a year ago. Answers with how many it anonymized and how many it left
// for the next run.
export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return cronRefused();
  const run = await anonymizeDeletedAccounts(new Date(), databaseAnonymizationStore);
  return Response.json(
    { anonymized: run.anonymized.length, failed: run.failed.length },
    { status: run.failed.length === 0 ? 200 : 500, headers: { "Cache-Control": "no-store" } },
  );
}
