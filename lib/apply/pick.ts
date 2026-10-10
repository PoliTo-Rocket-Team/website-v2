import { dummyDataOn, type DummyModeEnv } from "@/lib/dummy-data/mode";
import { NO_OWN_CHANGES, ownApplicationsStartOf, parseOwnChanges, type OwnApplicationsStart, type OwnChanges } from "@/lib/dummy-data/own";
import { dummyRecruitmentOf } from "@/lib/dummy-data/recruitment";
import type { ViewerKind } from "@/lib/dashboard/viewer";
import { testDeveloperViewer } from "@/lib/test-developer";
import type { ApplyData } from "./data";
import type { Recruitment } from "./positions";

/** What one request brings to the choice: its environment and the dummy selectors. */
export type ApplyRequest = {
  readonly env: DummyModeEnv;
  /** The test developer cookie: who is signed in, in dummy mode. */
  readonly viewerCookie: string | null | undefined;
  /** The `open` query value on /apply: how many positions are open, in dummy mode. */
  readonly openSelector: string | null | undefined;
  /** The dummy recruitment cookie: the switch as a test developer left it (lib/dummy-data/recruitment.ts). */
  readonly recruitmentCookie?: string | null | undefined;
  /** The test developer's own changes (lib/dummy-data/own.ts): their saved details and withdrawn applications. */
  readonly ownCookie?: string | null | undefined;
  /** Which own applications the test developer starts with (lib/dummy-data/own.ts): "none" or the sample set. */
  readonly ownStartCookie?: string | null | undefined;
};

export type ApplySides = {
  database(): ApplyData;
  dummy(
    viewer: ViewerKind | null,
    openSelector: string | null,
    recruitment: Recruitment,
    own: OwnChanges,
    ownStart: OwnApplicationsStart,
  ): ApplyData;
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
    request.ownCookie == null ? NO_OWN_CHANGES : parseOwnChanges(request.ownCookie),
    ownApplicationsStartOf(request.ownStartCookie),
  );
}

/** What a request to /apply carries that can change its list: the `open` query value and the dummy recruitment cookie. */
export type ApplyListRequest = Pick<ApplyRequest, "env" | "openSelector" | "recruitmentCookie">;

/**
 * Whether /apply has to be rendered for this request (issue #163). Only in
 * dummy mode, and only when the request carries the `open` selector or the
 * dummy recruitment cookie: those are the only request data that change the
 * list. Every other visit gets the prerendered page, which reads the
 * environment alone (plainApplyRequest).
 */
export function applyListIsPerRequest(request: ApplyListRequest): boolean {
  if (!dummyDataOn(request.env)) return false;
  return (request.openSelector ?? null) !== null || (request.recruitmentCookie ?? null) !== null;
}

/** The request the prerendered /apply stands for: this environment, and no viewer, selector or cookie. */
export function plainApplyRequest(env: DummyModeEnv): ApplyRequest {
  return { env, viewerCookie: null, openSelector: null, recruitmentCookie: null, ownCookie: null, ownStartCookie: null };
}
