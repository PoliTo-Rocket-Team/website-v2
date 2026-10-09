import { dummyDataOn, type DummyModeEnv } from "@/lib/dummy-data/mode";
import { dummyRecruitmentOf } from "@/lib/dummy-data/recruitment";
import type { ViewerKind } from "@/lib/dashboard/viewer";
import { testDeveloperViewer } from "@/lib/test-developer";
import type { ApplyData } from "./data";
import type { Recruitment } from "./positions";

/** What one request brings to the choice: its environment and the three dummy selectors. */
export type ApplyRequest = {
  readonly env: DummyModeEnv;
  /** The test developer cookie: who is signed in, in dummy mode. */
  readonly viewerCookie: string | null | undefined;
  /** The `open` query value on /apply: how many positions are open, in dummy mode. */
  readonly openSelector: string | null | undefined;
  /** The dummy recruitment cookie: the switch as a test developer left it (lib/dummy-data/recruitment.ts). */
  readonly recruitmentCookie?: string | null | undefined;
};

export type ApplySides = {
  database(): ApplyData;
  dummy(viewer: ViewerKind | null, openSelector: string | null, recruitment: Recruitment): ApplyData;
};

/**
 * The one place the apply pages pick their data: the dummy side when the
 * gate (lib/dummy-data/mode.ts) is on, else the database. Off the gate, the
 * cookies and the query value are never read.
 */
export function pickApplyData(request: ApplyRequest, sides: ApplySides): ApplyData {
  if (!dummyDataOn(request.env)) return sides.database();
  return sides.dummy(
    testDeveloperViewer(request.viewerCookie, request.env),
    request.openSelector ?? null,
    dummyRecruitmentOf(request.recruitmentCookie),
  );
}
