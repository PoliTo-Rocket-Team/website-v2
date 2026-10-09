import assert from "node:assert/strict";
import { test } from "node:test";
import { isPublic, type Recruitment } from "@/lib/apply/positions";
import { pickApplyData } from "@/lib/apply/pick";
import { VIEWER_KINDS } from "@/lib/dashboard/viewer";
import { dummyApplyData } from "./apply";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentCookieValue, dummyRecruitmentOf, type DummyRecruitmentStore } from "./recruitment";

// The recruitment switch on a preview (issue #121): the test developer's flip
// lives in a cookie, and the dummy dashboard and /apply both follow it.

/** A store standing in for the cookie jar: what the switch's action would set. */
function jar(start: string | undefined) {
  const set: string[] = [];
  const store: DummyRecruitmentStore = {
    current: dummyRecruitmentOf(start),
    save: async (r) => void set.push(dummyRecruitmentCookieValue(r)),
  };
  return { store, set };
}

test("the operations lead flips the dummy switch and it is kept; every other viewer is refused and nothing is kept", async () => {
  for (const kind of VIEWER_KINDS) {
    const { store, set } = jar(undefined);
    const data = dummyDashboardData(kind, store);
    const allowed = kind === "operations-lead";
    assert.equal((await data.recruitment()).canSwitch, allowed, kind);
    const result = await data.setRecruitment({ isOpen: false });
    assert.deepEqual(result, allowed ? { status: "switched", recruitment: { isOpen: false } } : { status: "refused" }, kind);
    assert.deepEqual(set, allowed ? ["closed"] : [], kind);
  }
});

test("the cookie reads back what was saved, and anything else reads as recruitment on", () => {
  for (const isOpen of [true, false]) {
    const r: Recruitment = { isOpen };
    assert.deepEqual(dummyRecruitmentOf(dummyRecruitmentCookieValue(r)), r);
  }
  for (const other of [undefined, null, "", "false", "OPEN"]) assert.deepEqual(dummyRecruitmentOf(other), { isOpen: true });
});

test("on a preview, /apply and every position page follow the cookie; in production it is never read", async () => {
  const preview = { NODE_ENV: "production", VERCEL_ENV: "preview" };
  const read = (cookie: string, env = preview) =>
    pickApplyData(
      { env, viewerCookie: null, openSelector: null, recruitmentCookie: cookie },
      { database: () => "database" as never, dummy: dummyApplyData },
    );

  const closed = read("closed");
  assert.deepEqual(await closed.publicPositions(), []);
  for (const id of [1, 2, 3, 4, 5, 6, 7]) {
    const page = (await closed.position(id))!;
    assert.equal(isPublic(page.position, page.recruitment), false, `position ${id}`);
  }
  assert.ok((await read("open").publicPositions()).length >= 5);

  assert.equal(read("closed", { NODE_ENV: "production", VERCEL_ENV: "production" }), "database");
});
