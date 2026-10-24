import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { publicItems, versionRows, type ContentItem } from "../content/versioned";
import { ANONYMIZED_EMAIL, CLEARED_MEMBER } from "../dashboard/anonymize";
import { APPLICATION_STAGES } from "../dashboard/application-flow";
import { TEST_VIEWERS } from "../dashboard/viewer";
import { ACCESS_LEVEL_LABELS, ACCESS_TARGET_LABELS, ACCESS_TARGETS } from "../dashboard/division-access";
import { TESTERS } from "../dev-tester";
import {
  ADMIN_TESTERS,
  SEATS,
  SEEDED_ACCOUNTS,
  seatOf,
  type AdminTester,
  type Seat,
  type SeatGrant,
  type SeatGrantArea,
  type SeatRole,
} from "../seeded-accounts";
import { checkFaqFields, fieldsOf as faqFields } from "../faq/faq";
import { checkPartnerFields, fieldsOf as partnerFields } from "../partners-fields";
import { checkProjectFields, fieldsOf as projectFields } from "../project-content/fields";
import { iressStory } from "../outreach";
import { publicOutreach } from "../outreach-editor";
import { importedOutreach } from "../outreach-import";
import { checkPostFields, draftOfFields, postFieldsOf } from "../outreach-post-fields";
import { CHANNEL_NAMES } from "../outreach-types";
import { orderStatusEnum } from "../../db/schema";
import { ANONYMIZED_KEPT_NAME } from "../../db/seed/alumni";
import {
  alumniOfSeed,
  caseDocRow,
  confirmedAsWritten,
  faqItemsOf,
  isActive,
  memberOfUser,
  orgOf,
  outreachFeaturedOf,
  outreachItemsOf,
  outreachTagsOf,
  partnerItemsOf,
  projectItemsOf,
  publishedTeamPageLayerOf,
  resolvesTo,
  SEED_AREAS,
  SEED_CASES,
  SEED_DATA,
  stageOf,
  teamAdvisorItemsOf,
  teamOf,
  teamPageOfSeed,
  teamRolesOf,
  waitingHandOversOf,
} from "../../db/seed/cases";
import { handOverAttentionFor } from "../dashboard/hand-over-request";
import { ANONYMIZED_ALUMNUS, TESTER_AUTH_ROWS, TEST_VIEWER_PEOPLE } from "../../db/seed/people";
import { teamPageSeed } from "../../db/seed/team-page";
import { getTableName } from "drizzle-orm";
import { advisorOfFields, fieldsOf as advisorFields } from "../about/advisors";
import { ARC_LEADERS, isTeamPageLayer, leadersOnArc, NO_UPLOADS } from "../about/team-layer";

const data = SEED_DATA;

for (const seedCase of SEED_CASES) {
  test(`seed case holds: ${seedCase.area}: ${seedCase.case}`, () => {
    assert.ok(seedCase.holds(data));
  });
}

test("docs/seed-cases.md lists every case, with the issue it exercises, and no other", () => {
  const doc = readFileSync(resolve(process.cwd(), "docs/seed-cases.md"), "utf8");
  const cases = doc.slice(doc.indexOf("## Cases"), doc.indexOf("\n## ", doc.indexOf("## Cases") + 1));
  const areaRow = new RegExp(`^\\| (${SEED_AREAS.join("|")}) \\|`);
  const rows = cases.split("\n").filter((line) => areaRow.test(line));
  assert.deepEqual(rows, SEED_CASES.map(caseDocRow));
});

// Hand-overs (issue #308).

test("the seed holds one waiting and one confirmed hand-over, and the department-head test viewer answers the waiting one", () => {
  assert.deepEqual(
    data.handOvers.map((r) => r.decision ?? null),
    ["confirmed", null],
  );
  const [waiting] = waitingHandOversOf(data);
  const head = memberOfUser(data, TEST_VIEWER_PEOPLE["department-head"]);
  const [row] = handOverAttentionFor(head, [waiting], teamOf(data), orgOf(data), new Date("2026-10-16T12:00:00Z"));
  assert.equal(row?.title, "Tester Division Lead wants to hand over Test Bench lead to Tester Member");
  assert.deepEqual(row?.action, { answerHandOver: waiting.id });
  for (const viewer of ["team-leader", "division-lead", "member"] as const) {
    assert.deepEqual(handOverAttentionFor(memberOfUser(data, TEST_VIEWER_PEOPLE[viewer]), [waiting], teamOf(data), orgOf(data), new Date()), [], viewer);
  }
});

test("the confirmed hand-over's rows read as Confirm writes them, and a moved day breaks it", () => {
  const [confirmed] = data.handOvers;
  assert.ok(confirmedAsWritten(data, confirmed));
  assert.ok(!confirmedAsWritten(data, { ...confirmed, decidedAt: "2022-10-05 10:00:00+00" }));
  assert.ok(!confirmedAsWritten(data, { ...confirmed, decidedBy: confirmed.toId }));
});

// Invariants (issue #304).

test("no closed division has people: no active role and no grant in it", () => {
  const closed = data.divisions.filter((d) => d.closedAt != null);
  assert.ok(closed.length > 0);
  for (const division of closed) {
    assert.deepEqual(data.roles.filter((r) => r.divisionId === division.id && isActive(r)), [], `${division.name} has people`);
    assert.deepEqual(data.scopes.filter((s) => s.divisionId === division.id), [], `${division.name} has grants`);
  }
});

test("every role sits inside its unit's life: started after it opened, ended by the time it closed", () => {
  for (const role of data.roles) {
    for (const unit of [data.divisions.find((d) => d.id === role.divisionId), data.departments.find((d) => d.id === role.deptId)]) {
      if (unit === undefined) continue;
      assert.ok(role.startedAt! >= unit.startedAt!, `${role.title} (member ${role.memberId}) starts before ${unit.name}`);
      if (unit.closedAt != null) {
        assert.ok(role.leavedAt != null && role.leavedAt <= unit.closedAt, `${role.title} outlives ${unit.name}`);
      }
    }
    if (role.leavedAt != null) assert.ok(role.leavedAt >= role.startedAt!, `${role.title} ends before it starts`);
  }
});

test("the anonymized alumnus carries no personal data but keeps its alumni entry", () => {
  const user = data.users.find((u) => u.member === ANONYMIZED_ALUMNUS);
  const member = data.members.find((m) => m.memberId === ANONYMIZED_ALUMNUS);
  assert.ok(user && member);
  assert.equal(user.email, ANONYMIZED_EMAIL);
  for (const key of ["firstName", "lastName", "phone", "linkedin", "politoId"] as const) assert.equal(user[key] ?? null, null, key);
  assert.ok(user.deletedAt != null && user.anonymizedAt != null && user.deletedAt < user.anonymizedAt);
  for (const [key, value] of Object.entries(CLEARED_MEMBER)) assert.equal(member[key as keyof typeof member] ?? null, value, key);
  assert.ok(!TESTER_AUTH_ROWS.rows.some((row) => row.id === user.id), "an anonymized account has no sign-in");

  const entry = data.alumniEntries.find((e) => e.memberId === ANONYMIZED_ALUMNUS);
  assert.ok(entry);
  assert.equal(entry.recordName, ANONYMIZED_KEPT_NAME);
  assert.equal(entry.photo ?? null, null);
  const alumnus = alumniOfSeed(data).find((a) => a.key === `m${ANONYMIZED_ALUMNUS}`);
  assert.ok(alumnus, "the Alumni page still lists them");
  assert.equal(alumnus.name, ANONYMIZED_KEPT_NAME);
  assert.equal(alumnus.email, ANONYMIZED_EMAIL);
});

test("every test viewer resolves to a seeded person read as that viewer", () => {
  for (const viewer of TEST_VIEWERS) {
    assert.ok(data.users.some((u) => u.id === TEST_VIEWER_PEOPLE[viewer]), `${viewer} has no seeded person`);
    assert.ok(resolvesTo(data, viewer), `${viewer} reads as someone else`);
  }
});

test("each local tester is seeded with the id and email lib/dev-tester.ts names, and can sign in", () => {
  for (const tester of Object.values(TESTERS)) {
    assert.ok(data.users.some((u) => u.id === tester.id && u.email === tester.email), tester.key);
    assert.ok(TESTER_AUTH_ROWS.rows.some((row) => row.id === tester.id && row.email === tester.email), tester.key);
  }
});

// The schema: every reference resolves, and every key is unique.

function unique<T>(values: readonly T[], what: string) {
  assert.equal(new Set(values).size, values.length, `${what} repeats`);
}

test("every key the seed sets is unique", () => {
  unique(data.departments.map((d) => d.id), "a department id");
  unique(data.divisions.map((d) => d.id), "a division id");
  unique(data.divisions.map((d) => d.code), "a division code");
  unique(data.members.map((m) => m.memberId), "a member id");
  unique(data.users.map((u) => u.id), "a user id");
  unique(data.users.flatMap((u) => (u.member == null ? [] : [u.member])), "a user's member");
  unique(data.users.map((u) => u.email), "an email");
  unique(data.alumniEntries.map((e) => e.id), "an alumni entry id");
  unique(data.alumniEntries.flatMap((e) => (e.memberId == null ? [] : [e.memberId])), "an alumni entry's member");
  unique(
    data.scopes.map((s) => [s.memberId, s.scope, s.target, s.deptId ?? null, s.divisionId ?? null].join("/")),
    "a grant",
  );
});

test("every reference the seed makes resolves to a seeded row", () => {
  const memberIds = new Set(data.members.map((m) => m.memberId));
  const departmentIds = new Set(data.departments.map((d) => d.id));
  const divisions = new Map(data.divisions.map((d) => [d.id, d]));
  for (const d of data.divisions) assert.ok(departmentIds.has(d.deptId ?? undefined), `division ${d.name}`);
  for (const u of data.users) if (u.member != null) assert.ok(memberIds.has(u.member), `user ${u.id}`);
  for (const m of data.members) assert.ok(data.users.some((u) => u.member === m.memberId), `member ${m.memberId} has no user`);
  for (const r of data.roles) {
    assert.ok(memberIds.has(r.memberId ?? undefined), `role ${r.title}`);
    if (r.deptId != null) assert.ok(departmentIds.has(r.deptId), `role ${r.title}`);
    if (r.divisionId != null) {
      const division = divisions.get(r.divisionId);
      assert.ok(division, `role ${r.title}`);
      assert.equal(r.deptId, division.deptId, `role ${r.title} names another department than its division's`);
    }
  }
  for (const s of data.scopes) {
    assert.ok(memberIds.has(s.memberId ?? undefined), `grant of ${s.memberId}`);
    if (s.givenBy != null) assert.ok(memberIds.has(s.givenBy), `grant given by ${s.givenBy}`);
    if (s.deptId != null) assert.ok(departmentIds.has(s.deptId));
    if (s.divisionId != null) assert.ok(divisions.has(s.divisionId));
  }
  for (const e of data.alumniEntries) {
    if (e.kind !== "member") {
      // An imported person is named on the entry and is no member (drizzle/0021).
      assert.ok(e.memberId == null && e.recordName != null, `alumni entry ${e.id}`);
      continue;
    }
    assert.ok(memberIds.has(e.memberId ?? undefined), `alumni entry ${e.id}`);
    assert.ok(!data.roles.some((r) => r.memberId === e.memberId && isActive(r)), `alumni entry ${e.id} is someone on the team`);
  }
  const entryIds = new Set(data.alumniEntries.map((e) => e.id));
  for (const line of data.alumniImportedRoles) assert.ok(entryIds.has(line.entryId), `imported line ${line.position}`);
});

// Orders, recruitment, partners and FAQ (issue #305).

const day = (at: string) => new Date(at).toISOString().slice(0, 10);

test("invariant: every order status is present", () => {
  for (const status of orderStatusEnum.enumValues) assert.ok(data.orders.some((o) => o.status === status), status);
});

test("each order is made by a member who holds a role in its division, and only answered ones carry an answer", () => {
  const answered = new Set(["changes_requested", "rejected", "accepted", "ordered"]);
  for (const order of data.orders) {
    assert.ok(
      data.roles.some(
        (r) => r.memberId === order.requester && r.divisionId === order.divisionId && isActive(r) && r.startedAt! <= day(order.createdAt!),
      ),
      `order ${order.id}: requester ${order.requester} holds no role in division ${order.divisionId}`,
    );
    if (answered.has(order.status!)) {
      assert.ok(data.members.some((m) => m.memberId === order.reviewedBy), `order ${order.id} has no answer on record`);
      assert.ok(Date.parse(order.reviewedAt!) > Date.parse(order.createdAt!), `order ${order.id} is answered before it was sent`);
    } else {
      assert.equal(order.reviewedBy ?? null, null, `order ${order.id}`);
      assert.equal(order.reviewedAt ?? null, null, `order ${order.id}`);
    }
    const noted = order.status === "changes_requested" || order.status === "rejected";
    assert.equal(order.reviewNote != null, noted, `order ${order.id}: a note goes with changes requested and rejected alone`);
  }
});

test("invariant: every application stage is present", () => {
  for (const stage of APPLICATION_STAGES) assert.ok(data.applications.some((a) => stageOf(data, a) === stage), stage);
});

test("every position sits in an open division, and every application in a seeded position, after it opened", () => {
  for (const position of data.positions) {
    const division = data.divisions.find((d) => d.id === position.divisionId);
    assert.ok(division && division.closedAt == null, `position ${position.id} is in division ${position.divisionId}`);
  }
  for (const application of data.applications) {
    const position = data.positions.find((p) => p.id === application.applyPositionId);
    assert.ok(position, `application ${application.id}`);
    assert.ok(Date.parse(application.appliedAt!) > Date.parse(position.createdAt!), `application ${application.id} predates its position`);
    const questions = position.customQuestions ?? [];
    assert.deepEqual(
      (application.customAnswers as { question: string }[]).map((a) => a.question),
      questions,
      `application ${application.id} answers other questions than its position asks`,
    );
  }
});

test("each application is by a seeded applicant, once per position, and its dates follow its stage", () => {
  const live = data.applications.filter((a) => a.withdrawnAt == null).map((a) => `${a.userId}/${a.applyPositionId}`);
  assert.equal(new Set(live).size, live.length, "a person holds two live applications to one position");
  for (const a of data.applications) {
    const user = data.users.find((u) => u.id === a.userId);
    assert.ok(user, `application ${a.id}`);
    const stage = stageOf(data, a);
    assert.equal(user.member != null, stage === "joined", `application ${a.id}: only the joined applicant is a member`);
    assert.equal(a.acceptedAt != null, stage === "accepted" || stage === "joined", `application ${a.id} accepted_at`);
    assert.equal(a.joinedAt != null, stage === "joined", `application ${a.id} joined_at`);
    assert.equal(a.rejectedAt != null, stage === "rejected", `application ${a.id} rejected_at`);
    const times = [a.appliedAt, a.acceptedAt, a.ndaArrivedAt, a.joinedAt].flatMap((t) => (t == null ? [] : [Date.parse(t)]));
    assert.deepEqual(times, [...times].sort((x, y) => x - y), `application ${a.id}: its dates run out of order`);
  }
});

test("the joined applicant holds a role in the position's division from the day they joined", () => {
  const joined = data.applications.filter((a) => stageOf(data, a) === "joined");
  assert.ok(joined.length > 0);
  for (const a of joined) {
    const memberId = data.users.find((u) => u.id === a.userId)?.member;
    const divisionId = data.positions.find((p) => p.id === a.applyPositionId)?.divisionId;
    assert.ok(
      data.roles.some((r) => r.memberId === memberId && r.divisionId === divisionId && r.startedAt === day(a.joinedAt!)),
      `application ${a.id}`,
    );
  }
});

test("interview times sit on interview applications only, with at most one booked", () => {
  for (const slot of data.interviewSlots) {
    const application = data.applications.find((a) => a.id === slot.applicationId);
    assert.equal(application?.status, "interview", `slot ${slot.id}`);
    assert.ok(Date.parse(slot.endsAt) > Date.parse(slot.startsAt), `slot ${slot.id} ends before it starts`);
    assert.equal(slot.chosenAt != null, slot.chosen === true, `slot ${slot.id}: chosen_at goes with chosen`);
  }
  for (const a of data.applications.filter((x) => x.status === "interview")) {
    const slots = data.interviewSlots.filter((s) => s.applicationId === a.id);
    assert.ok(slots.length > 0, `application ${a.id} is at interview with no time offered`);
    assert.ok(slots.filter((s) => s.chosen).length <= 1, `application ${a.id} has two times booked`);
  }
});

/** Every item with a draft holds the published version beside it, or was never published and is off the public site. */
function draftsAccountedFor<T>(items: readonly ContentItem<T>[], key: (content: T) => string): void {
  const shown = new Set(publicItems(items).map(key));
  for (const item of items) {
    const version = item.version;
    if (version.state === "published") continue;
    assert.ok(!shown.has(key(version.draft)), `item ${item.id} is a draft yet shown on the site`);
  }
}

test("invariant: each draft partner or FAQ item has a published counterpart or is clearly unpublished", () => {
  const partnerItems = partnerItemsOf(data);
  const faqItems = faqItemsOf(data);
  assert.equal(partnerItems.length, data.partners.length, "a partner has no version");
  assert.equal(faqItems.length, data.faqs.length, "a question has no version");
  for (const [kind, rows] of [
    ["partner", data.partnerVersions.map((v) => [v.partnerId, v.version] as const)],
    ["question", data.faqVersions.map((v) => [v.faqId, v.version] as const)],
  ] as const) {
    const keys = rows.map(([id, version]) => `${id}/${version}`);
    assert.equal(new Set(keys).size, keys.length, `a ${kind} holds two versions of one kind`);
  }
  // Rows with a draft: each item either keeps its published row, or is a draft only and not public.
  assert.ok(partnerItems.some((i) => i.version.state === "published" && i.version.draft !== null));
  assert.ok(partnerItems.some((i) => i.version.state === "draft"));
  draftsAccountedFor(partnerItems, (p) => p.name);
  draftsAccountedFor(faqItems, (f) => f.question);
});

test("every seeded partner and question version passes the editor's own checks", () => {
  for (const item of partnerItemsOf(data)) {
    for (const { content } of versionRows(item.version)) {
      const checked = checkPartnerFields(partnerFields(content));
      assert.ok(checked.ok, `partner ${item.id}: ${JSON.stringify(checked)}`);
    }
  }
  for (const item of faqItemsOf(data)) {
    for (const { content } of versionRows(item.version)) {
      const checked = checkFaqFields(faqFields(content));
      assert.ok(checked.ok, `question ${item.id}: ${JSON.stringify(checked)}`);
    }
  }
});

// Projects (issue #310).

test("every seeded project version saves as the editor opens it, so a reviewer can edit and publish it", () => {
  const items = projectItemsOf(data);
  assert.equal(items.length, data.projects.length);
  for (const item of items) {
    for (const { kind, content } of versionRows(item.version)) {
      const checked = checkProjectFields(projectFields(content), content);
      assert.ok(checked.ok, `project ${item.id} ${kind}: ${JSON.stringify(checked)}`);
    }
  }
});

test("every order, application and slot names seeded rows", () => {
  const memberIds = new Set(data.members.map((m) => m.memberId));
  for (const o of data.orders) {
    assert.ok(memberIds.has(o.requester ?? undefined), `order ${o.id} requester`);
    assert.ok(data.divisions.some((d) => d.id === o.divisionId), `order ${o.id} division`);
  }
  for (const s of data.interviewSlots) assert.ok(data.applications.some((a) => a.id === s.applicationId), `slot ${s.id}`);
  for (const v of data.partnerVersions) assert.ok(data.partners.some((p) => p.id === v.partnerId), `partner version of ${v.partnerId}`);
  for (const v of data.faqVersions) assert.ok(data.faqs.some((f) => f.id === v.faqId), `question version of ${v.faqId}`);
  unique(data.orders.map((o) => o.id), "an order id");
  unique(data.positions.map((p) => p.id), "a position id");
  unique(data.applications.map((a) => a.id), "an application id");
  unique(data.interviewSlots.map((s) => s.id), "a slot id");
  unique(data.partners.map((p) => p.id), "a partner id");
  unique(data.faqs.map((f) => f.id), "a question id");
});

// Outreach (issue #309).

test("every tag and every channel type is on a seeded post, among both draft and published posts", () => {
  const items = outreachItemsOf(data);
  const versions = items.flatMap((item) =>
    item.version.state === "draft" ? [item.version.draft] : [item.version.published, ...(item.version.draft === null ? [] : [item.version.draft])],
  );
  for (const tag of outreachTagsOf(data)) assert.ok(versions.some((p) => p.tags.includes(tag.name)), tag.name);
  for (const name of CHANNEL_NAMES) assert.ok(versions.some((p) => p.channels[name] !== undefined), name);
  assert.ok(items.some((i) => i.version.state === "published" && i.version.draft === null), "no published post");
  assert.ok(items.some((i) => i.version.state === "published" && i.version.draft !== null), "no published post with draft changes");
  assert.ok(items.some((i) => i.version.state === "draft"), "no draft post");
});

test("the outreach rows read back to the import's content, plus the seed's own posts and draft", () => {
  const imported = importedOutreach();
  assert.deepEqual(outreachTagsOf(data), imported.tags);
  const items = outreachItemsOf(data);
  assert.equal(items.length, data.outreachPosts.length, "a post has no version");
  for (const item of imported.posts) {
    const seeded = items.find((i) => i.id === item.id);
    assert.ok(seeded?.version.state === "published", `post ${item.id}`);
    // The placeholder galleries (issue #456) are the seed's own; the rest of each post is the import's.
    const { gallery: _, ...withoutGallery } = seeded.version.published;
    assert.deepEqual(withoutGallery, item.version.state === "published" && item.version.published, `post ${item.id}`);
  }
  assert.deepEqual(outreachFeaturedOf(data), imported.featured, "the summit's story is featured (issues #392, #496)");
  const shown = publicOutreach({ posts: items, tags: outreachTagsOf(data), featured: outreachFeaturedOf(data) });
  assert.deepEqual(
    shown.featured.map((p) => p.title),
    [iressStory.title],
  );
  assert.equal(shown.posts.length, items.filter((i) => i.version.state === "published").length - 1, "the featured post is not listed");
});

test("every seeded post version passes the editor's own checks", () => {
  const tags = outreachTagsOf(data);
  for (const item of outreachItemsOf(data)) {
    if (item.version.state === "draft") {
      const draft = item.version.draft;
      const saved = draftOfFields(postFieldsOf(draft), draft, tags);
      assert.ok(saved.ok, `post ${item.id}: ${JSON.stringify(saved)}`);
      assert.deepEqual(saved.value, draft, `post ${item.id} is not what Save draft keeps`);
      continue;
    }
    for (const post of [item.version.published, ...(item.version.draft === null ? [] : [item.version.draft])]) {
      const checked = checkPostFields(postFieldsOf(post), post, tags);
      assert.ok(checked.ok, `post ${item.id}: ${JSON.stringify(checked)}`);
      assert.deepEqual(checked.value, post, `post ${item.id} is not what Publish keeps`);
    }
  }
});

test("every outreach key is unique, and every post tag names a seeded version and a tag in the list", () => {
  unique(data.outreachPosts.map((p) => p.id), "an outreach post id");
  unique(data.outreachTags.map((t) => t.name), "a tag name");
  unique(data.outreachTags.map((t) => t.listOrder), "a tag's place in the list");
  unique(data.outreachPostVersions.map((v) => `${v.postId}/${v.version}`), "an outreach post version");
  unique(data.outreachPostTags.map((t) => `${t.postId}/${t.version}/${t.position}`), "a post tag's place");
  unique(data.outreachPostTags.map((t) => `${t.postId}/${t.version}/${t.tagName}`), "a tag on one post version");
  const tagNames = new Set(data.outreachTags.map((t) => t.name));
  for (const t of data.outreachPostTags) {
    assert.ok(tagNames.has(t.tagName), `post ${t.postId}: ${t.tagName} is not in the tag list`);
    assert.ok(data.outreachPostVersions.some((v) => v.postId === t.postId && v.version === t.version), `post ${t.postId} ${t.version}`);
  }
  for (const v of data.outreachPostVersions) assert.ok(data.outreachPosts.some((p) => p.id === v.postId), `version of post ${v.postId}`);
  assert.equal(data.outreachTags.filter((t) => t.award).length, 1, "the list has one award tag");
});

// The Team page (issue #311).

test("the team-page module writes only the Team page's own tables, so no seeded visual edit changes a role", () => {
  const tables = (list: readonly Parameters<typeof getTableName>[0][]) => list.map(getTableName).sort();
  assert.deepEqual(tables(teamPageSeed.seed.owns), ["team_page_advisor_versions", "team_page_advisors", "team_page_layer_versions"]);
  assert.deepEqual(teamPageSeed.seed.keyed ?? [], []);
  assert.deepEqual(tables(teamPageSeed.seed.rows.map((set) => set.table)), tables(teamPageSeed.seed.owns));
  // The roles read the same with and without the layer.
  assert.deepEqual(teamRolesOf({ ...data, teamPageLayerVersions: [] }), teamRolesOf(data));
});

test("the seeded layer is published, is one the editor could have saved, and every edit lands on the page", () => {
  const layer = publishedTeamPageLayerOf(data);
  assert.ok(layer, "the published layer reads back");
  assert.ok(isTeamPageLayer(layer, NO_UPLOADS));
  assert.deepEqual(
    data.teamPageLayerVersions.map((r) => r.version),
    ["published"],
  );
  const { build } = teamPageOfSeed(data);
  assert.ok(leadersOnArc(build, layer) <= ARC_LEADERS, "the arc holds the added leader");
  const spots = new Set<string>([
    ...build.arc.map((l) => l.spot),
    ...build.departments.flatMap((d) => [...d.heads.map((h) => h.spot), ...d.leads.map((l) => l.spot)]),
  ]);
  for (const spot of Object.keys(layer.spots)) assert.ok(spots.has(spot), `${spot} is a spot the seeded roles fill`);
  for (const id of Object.keys(layer.departments)) assert.ok(build.departments.some((d) => `${d.id}` === id), `department ${id} is on the page`);
  const onTeam = new Set(build.people.map((p) => p.id));
  const named = [
    layer.leader.person,
    ...Object.values(layer.spots).map((edit) => edit?.person),
    ...layer.addedLeaders.map((l) => l.person),
    ...Object.values(layer.departments).flatMap((d) => (d?.addedLeads ?? []).map((l) => l.person)),
  ].filter((id): id is number => id !== undefined);
  assert.ok(named.length > 0);
  for (const id of named) assert.ok(onTeam.has(id), `member ${id} is on the team`);
});

test("each seeded advisor is one the Advisors panel would keep as it is", () => {
  const items = teamAdvisorItemsOf(data);
  assert.equal(items.length, data.teamPageAdvisors.length);
  unique(data.teamPageAdvisors.map((a) => a.id), "an advisor id");
  unique(data.teamPageAdvisorVersions.map((v) => `${v.advisorId}/${v.version}`), "an advisor version");
  for (const item of items) {
    assert.equal(item.version.state, "published");
    if (item.version.state !== "published") continue;
    const { place: _, ...advisor } = item.version.published;
    assert.deepEqual(advisorOfFields(advisorFields(advisor)), advisor, item.version.published.name);
  }
});

// The plain seats and the admin testers (issues #595, #607): every seat in
// lib/seeded-accounts.ts holds exactly the roles and grants its row names and
// nothing else, so an access check on a re-seeded preview starts from a clean
// seat; every admin tester is stored as an admin and holds no team role and
// no grant.

type SeedRole = (typeof data.roles)[number];
type SeedScope = (typeof data.scopes)[number];

function unitName(role: SeedRole): string {
  if (role.divisionId != null) return data.divisions.find((d) => d.id === role.divisionId)!.name!;
  if (role.deptId != null) return data.departments.find((d) => d.id === role.deptId)!.name!;
  return "the team";
}

/** A seeded role, read as a seat names it. */
function seatRoleOf(r: SeedRole): SeatRole {
  const unit = r.divisionId != null ? "division" : r.deptId != null ? "department" : "team";
  return { type: r.type as SeatRole["type"], unit, fullAccess: (r.fullAccess ?? null) as SeatRole["fullAccess"] };
}

/** A seeded `scopes` row, read as a seat's grant and where it holds. */
function seatGrantOf(s: SeedScope): SeatGrant & { readonly across: string } {
  const across = s.scope === "department" ? `department ${s.deptId}` : s.scope === "division" ? `division ${s.divisionId}` : "team";
  const area: SeatGrantArea =
    s.scope === "website" ? (s.target === "content" ? "content" : "alumni") : (s.target as SeatGrantArea);
  return { area, level: s.accessLevel!, across };
}

const byJson = <T,>(values: readonly T[]) => values.map((v) => JSON.stringify(v)).sort();

function seatHoldings(seat: Seat) {
  const theirs = seat.memberId === null ? [] : data.roles.filter((r) => r.memberId === seat.memberId);
  const scopes = seat.memberId === null ? [] : data.scopes.filter((s) => s.memberId === seat.memberId);
  return { active: theirs.filter(isActive), ended: theirs.filter((r) => !isActive(r)), scopes };
}

test("each seat holds exactly the roles and grants its name says, and nothing else", () => {
  for (const seat of SEATS) {
    const { active, ended, scopes } = seatHoldings(seat);
    assert.equal(memberOfUser(data, seat.id), seat.memberId, `${seat.key} is member ${seat.memberId}`);
    assert.deepEqual(byJson(active.map(seatRoleOf)), byJson(seat.roles), `${seat.key} roles`);
    assert.equal(ended.length > 0, seat.former, `${seat.key} ${seat.former ? "held" : "held no"} ended roles`);
    assert.deepEqual(byJson(scopes.map(seatGrantOf)), byJson(seat.grants.map((g) => ({ ...g, across: "team" }))), `${seat.key} grants`);
  }
  assert.equal(seatOf("non-member").memberId, null, "the applicant is no member");
  assert.ok(data.alumniEntries.some((e) => e.memberId === seatOf("alumni").memberId), "the alumnus keeps an Alumni entry");
});

test("the seats cover every kind the seed names: one per single grant and an Approve-orders holder among them", () => {
  const oneGrant = SEATS.filter((s) => s.grants.length === 1 && s.grants[0].area !== "approve_orders").map((s) => s.grants[0].area);
  assert.deepEqual([...oneGrant].sort(), [...ACCESS_TARGETS].sort());
  assert.deepEqual(seatOf("approve-orders").grants, [{ area: "approve_orders", level: "edit" }]);
  for (const viewer of TEST_VIEWERS) assert.equal(TEST_VIEWER_PEOPLE[viewer], seatOf(viewer).id, `${viewer} views as its seat`);
});

test("the seeded admin testers are stored as admins and hold no team role and no grant", () => {
  assert.ok(ADMIN_TESTERS.length >= 1);
  for (const admin of ADMIN_TESTERS) {
    const user = data.users.find((u) => u.id === admin.id);
    assert.ok(user, `${admin.key} has a users row`);
    assert.equal(user.member ?? null, null, `${admin.key} has no member row, so no role and no grant`);
    const signIn = TESTER_AUTH_ROWS.rows.filter((row) => row.id === admin.id);
    assert.deepEqual(signIn.map((row) => [row.email, row.role]), [[admin.email, "admin"]], admin.key);
  }
  const admins = TESTER_AUTH_ROWS.rows.filter((row) => row.role === "admin").map((row) => row.id);
  assert.deepEqual(admins, ADMIN_TESTERS.map((a) => a.id), "nobody else is stored as an admin");
});

test("every seat and admin tester has one stable id and email, seeded on its users row and its sign-in row", () => {
  unique(SEEDED_ACCOUNTS.map((a) => a.key), "account key");
  unique(SEEDED_ACCOUNTS.map((a) => a.id), "account id");
  unique(SEEDED_ACCOUNTS.map((a) => a.email), "account email");
  for (const account of SEEDED_ACCOUNTS) {
    const user = data.users.find((u) => u.id === account.id);
    assert.ok(user, `${account.key} has a users row`);
    assert.equal(user.email, account.email, `${account.key} email`);
    assert.equal(`${user.firstName} ${user.lastName}`, account.name, `${account.key} name`);
    const signIn = TESTER_AUTH_ROWS.rows.filter((row) => row.id === account.id);
    assert.deepEqual(signIn.map((row) => row.email), [account.email], `${account.key} has one sign-in row`);
  }
});

/** One row of docs/seed-cases.md's "Test seats" table, read off the seed. */
function seatDocRow(seat: Seat): string {
  const { active, ended, scopes } = seatHoldings(seat);
  const person = `${seat.name}: ${seat.memberId === null ? "no member row" : `member ${seat.memberId}`}, user \`${seat.id}\`, \`${seat.email}\``;
  const role = (r: SeedRole) => `${r.title} (\`${r.type}\`${r.fullAccess ? `, full access \`${r.fullAccess}\`` : ""}) in ${unitName(r)}`;
  const roles =
    active.length > 0 ? active.map(role).join("; ") : ended.length > 0 ? `none now; ended: ${ended.map(role).join("; ")}` : "none";
  const grant = (s: SeedScope) => {
    const { area, level } = seatGrantOf(s);
    return area === "approve_orders" ? `"Approve orders" (\`approve_orders\`)` : `${ACCESS_TARGET_LABELS[area]} at ${ACCESS_LEVEL_LABELS[level]} across the whole team`;
  };
  const grants = scopes.length > 0 ? scopes.map(grant).join("; ") : "none: no `scopes` row";
  return `| ${seat.label} | ${person} | ${roles} | ${grants} | ${seat.sees} |`;
}

/** One row of docs/seed-cases.md's "Admin testers" table. */
function adminDocRow(admin: AdminTester): string {
  return `| ${admin.label} | ${admin.name}: no member row, user \`${admin.id}\`, \`${admin.email}\` | \`${admin.storedRole}\` | ${admin.sees} |`;
}

function docSection(heading: string): string[] {
  const doc = readFileSync(resolve(process.cwd(), "docs/seed-cases.md"), "utf8");
  const start = doc.indexOf(`## ${heading}`);
  assert.ok(start >= 0, `docs/seed-cases.md has a ${heading} section`);
  const end = doc.indexOf("\n## ", start + 1);
  return doc.slice(start, end < 0 ? undefined : end).split("\n");
}

test("docs/seed-cases.md lists each seat with its seeded person, roles, grants and what it sees, as the seed holds them", () => {
  const rows = docSection("Test seats").filter((line) => SEATS.some((s) => line.startsWith(`| ${s.label} |`)));
  assert.deepEqual(rows, SEATS.map(seatDocRow));
});

test("docs/seed-cases.md lists each admin tester with its account, stored role and what it sees", () => {
  const rows = docSection("Admin testers").filter((line) => ADMIN_TESTERS.some((a) => line.startsWith(`| ${a.label} |`)));
  assert.deepEqual(rows, ADMIN_TESTERS.map(adminDocRow));
});
