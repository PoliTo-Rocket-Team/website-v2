import "server-only";

import { cookies } from "next/headers";
import { dummyApplyData } from "@/lib/dummy-data/apply";
import { processDummyModeEnv } from "@/lib/dummy-data/mode";
import { DUMMY_RECRUITMENT_COOKIE } from "@/lib/dummy-data/recruitment";
import { TEST_DEVELOPER_COOKIE } from "@/lib/test-developer";
import type { ApplyData } from "./data";
import { databaseApplyData } from "./database";
import { pickApplyData } from "./pick";

/**
 * This request's apply data (./pick.ts decides which side). `openSelector`
 * is /apply's `open` query value; other callers have none.
 */
export async function openApplyData(openSelector: string | null = null): Promise<ApplyData> {
  const jar = await cookies();
  return pickApplyData(
    {
      env: processDummyModeEnv(),
      viewerCookie: jar.get(TEST_DEVELOPER_COOKIE)?.value,
      openSelector,
      recruitmentCookie: jar.get(DUMMY_RECRUITMENT_COOKIE)?.value,
    },
    { database: () => databaseApplyData, dummy: dummyApplyData },
  );
}
