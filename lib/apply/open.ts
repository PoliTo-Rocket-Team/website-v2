import "server-only";

import { cookies } from "next/headers";
import { dummyApplyData } from "@/lib/dummy-data/apply";
import { processDummyModeEnv } from "@/lib/dummy-data/mode";
import { TEST_DEVELOPER_COOKIE } from "@/lib/test-developer";
import type { ApplyData } from "./data";
import { databaseApplyData } from "./database";
import { pickApplyData } from "./pick";

/**
 * This request's apply data (./pick.ts decides which side). `openSelector`
 * is /apply's `open` query value; other callers have none.
 */
export async function openApplyData(openSelector: string | null = null): Promise<ApplyData> {
  return pickApplyData(
    {
      env: processDummyModeEnv(),
      viewerCookie: (await cookies()).get(TEST_DEVELOPER_COOKIE)?.value,
      openSelector,
    },
    { database: () => databaseApplyData, dummy: dummyApplyData },
  );
}
