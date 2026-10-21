import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { importedAdvisors } from "../about/advisors-import";
import type { AdvisorItem } from "../about/advisors";
import { importedEntries, importedFounders } from "../about/alumni-import";
import { team } from "../about/team";
import { versionRows, type ContentItem } from "../content/versioned";
import { importedFaqs } from "../faq/import";
import { newestFirst } from "../outreach";
import { importedOutreach } from "../outreach-import";
import { importedPartners } from "../partners-import";
import { importedProjects } from "../project-content/import";
import {
  alumniOfSeed,
  faqItemsOf,
  isActive,
  outreachItemsOf,
  outreachSummitOf,
  outreachTagsOf,
  partnerItemsOf,
  projectItemsOf,
  SEED_DATA,
  teamAdvisorItemsOf,
} from "../../db/seed/cases";
import { DRAFT_CHANGES_POST, DRAFT_ONLY_POST, EVERY_CHANNEL_POST, RECORD_GALLERY_POSTS } from "../../db/seed/outreach";
import { DRAFT_ONLY_PARTNER } from "../../db/seed/partners";
import { DIVISION_ADVISOR, FORMER_TEAM_LEADER, TESTER_MEMBER } from "../../db/seed/people";
import { PLACEHOLDER_ROCKET_PROJECT } from "../../db/seed/projects";

// The seed uses the data the site already publishes and invents everything
// private (issue #326): this checks the seeded rows against the public
// sources, never against the seed's own reading of them.

const data = SEED_DATA;

const nameOf = (memberId: number) => {
  const user = data.users.find((u) => u.member === memberId);
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ");
};

const memberNamed = (name: string) => {
  const user = data.users.find((u) => u.member != null && [u.firstName, u.lastName].filter(Boolean).join(" ") === name);
  assert.ok(user?.member != null, `${name} is not seeded`);
  return user.member;
};

const activeRoles = (memberId: number) => data.roles.filter((r) => r.memberId === memberId && isActive(r));
const departmentNamed = (name: string) => data.departments.find((d) => d.name === name)?.id;
const divisionNamed = (name: string) => data.divisions.find((d) => d.name === name && d.closedAt == null)?.id;

// This year's team (lib/about/team.ts).

test("the team leader and the leaders on the arc are seeded with the roles lib/about/team.ts gives them", () => {
  const leader = memberNamed(team.orgChart.leader.name);
  assert.ok(activeRoles(leader).some((r) => r.type === "president" && r.title === team.orgChart.leader.role));
  for (const l of team.orgChart.leaders) {
    assert.ok(
      activeRoles(memberNamed(l.name)).some((r) => r.title === l.role),
      `${l.name} holds no active role titled ${l.role}`,
    );
  }
});

test("every head, division lead and core member is seeded in the department or division lib/about/team.ts names, with its role", () => {
  for (const group of team.departments.groups) {
    for (const member of group.members) {
      const id = memberNamed(member.name);
      if (member.kind === "head") {
        const department = departmentNamed(member.role.replace(/^Head of /, ""));
        assert.ok(department !== undefined, member.role);
        assert.ok(
          activeRoles(id).some((r) => r.type === "head" && r.deptId === department && r.divisionId == null && r.title === member.role),
          `${member.name} does not head ${member.role}`,
        );
        for (const lead of member.leads) {
          const division = divisionNamed(lead.division);
          assert.ok(division !== undefined, lead.division);
          assert.ok(
            activeRoles(memberNamed(lead.name)).some((r) => r.type === "lead" && r.divisionId === division),
            `${lead.name} does not lead ${lead.division}`,
          );
        }
      } else {
        const division = divisionNamed(member.division);
        assert.ok(division !== undefined, member.division);
        assert.ok(activeRoles(id).some((r) => r.type === "lead" && r.divisionId === division), `${member.name} does not lead ${member.division}`);
      }
    }
  }
  for (const member of team.coreMembers.members) {
    const titles = activeRoles(memberNamed(member.name)).map((r) => r.title);
    // A role the live list leaves out is an empty title, which the page shows as none.
    assert.ok(titles.includes(member.role ?? ""), `${member.name} holds no role titled "${member.role ?? ""}": ${titles.join(", ")}`);
  }
});

test("each public person carries the photo and LinkedIn handle lib/about/team.ts gives, or none", () => {
  const people = [
    team.orgChart.leader,
    ...team.orgChart.leaders,
    ...team.departments.groups.flatMap((g) => g.members.flatMap((m) => (m.kind === "head" ? [m, ...m.leads] : [m]))),
    ...team.coreMembers.members,
  ];
  for (const person of people) {
    const id = memberNamed(person.name);
    const user = data.users.find((u) => u.member === id)!;
    const member = data.members.find((m) => m.memberId === id)!;
    if ("photo" in person && person.photo !== undefined) assert.equal(member.picture, person.photo, person.name);
    if (person.linkedin !== undefined) assert.equal(user.linkedin, `linkedin.com/in/${person.linkedin}`, person.name);
  }
});

test("everyone on the seeded team is someone lib/about/team.ts names, a local tester, or one of the two invented advisors", () => {
  const publicNames = new Set([
    team.orgChart.leader.name,
    ...team.orgChart.leaders.map((l) => l.name),
    ...team.departments.groups.flatMap((g) => g.members.flatMap((m) => (m.kind === "head" ? [m.name, ...m.leads.map((l) => l.name)] : [m.name]))),
    ...team.coreMembers.members.map((m) => m.name),
  ]);
  const invented = new Set<number>([...Object.values(TESTER_MEMBER), FORMER_TEAM_LEADER, DIVISION_ADVISOR]);
  const onTeam = new Set(data.roles.filter(isActive).map((r) => r.memberId!));
  for (const id of onTeam) assert.ok(publicNames.has(nameOf(id)) || invented.has(id), `member ${id} (${nameOf(id)}) is on no public page`);
  for (const name of publicNames) assert.ok(onTeam.has(memberNamed(name)), `${name} holds no active role`);
});

// Advisors and alumni.

/** An advisor item without the email, which the seed invents. */
const withoutEmail = (item: AdvisorItem) => {
  if (item.version.state !== "published") return item;
  const { email: _, ...published } = item.version.published;
  return { ...item, version: { ...item.version, published } };
};

test("the seeded advisors are the ones lib/about/advisors-import.ts imports", () => {
  assert.deepEqual(teamAdvisorItemsOf(data).map(withoutEmail), importedAdvisors().map(withoutEmail));
});

test("the Alumni page's imported years, founder and co-founders are the ones lib/about/alumni-import.ts imports", () => {
  const { entries, imported } = importedEntries(1);
  const seeded = data.alumniEntries.filter((e) => e.kind === "imported");
  assert.deepEqual(
    seeded.map((e) => [e.id, e.recordName, e.founder ?? null, e.photo ?? null]),
    entries.map((e) => [e.id, e.who.kind === "imported" ? e.who.name : null, e.founder === "co-founder" ? "co_founder" : e.founder, e.photo]),
  );
  assert.deepEqual(
    data.alumniImportedRoles.map((r) => ({ entryId: r.entryId, year: r.year, group: r.groupName, role: r.role, position: r.position })),
    imported,
  );
  const founders = alumniOfSeed(data).filter((a) => a.founder !== null);
  assert.deepEqual(
    founders.map((a) => [a.name, a.founder]).sort(),
    importedFounders.map((f) => [f.name, f.founder]).sort(),
  );
});

// Partners, FAQ, projects and outreach: the published versions are the imports'.

function publishedById<T>(items: readonly ContentItem<T>[]): Map<number, T> {
  return new Map(items.flatMap((item) => (item.version.state === "published" ? [[item.id, item.version.published] as const] : [])));
}

function assertFromImport<T>(what: string, seeded: readonly ContentItem<T>[], imported: readonly ContentItem<T>[], invented: readonly number[], same = (a: T, b: T) => assert.deepEqual(a, b)) {
  const published = publishedById(seeded);
  for (const [id, content] of publishedById(imported)) {
    const seededContent = published.get(id);
    assert.ok(seededContent !== undefined, `${what} ${id} is not published`);
    same(seededContent, content);
  }
  const importedIds = new Set(imported.map((i) => i.id));
  assert.deepEqual(
    seeded.filter((i) => !importedIds.has(i.id)).map((i) => i.id),
    [...invented],
    `${what}: only the invented items are not imported`,
  );
}

test("the seeded partners are the ones the partners import carries in, plus the one invented draft", () => {
  assertFromImport("partner", partnerItemsOf(data), importedPartners(), [DRAFT_ONLY_PARTNER]);
});

test("the seeded FAQ questions are the ones the FAQ import carries in", () => {
  assertFromImport("question", faqItemsOf(data), importedFaqs("2026-01-01T00:00:00.000Z"), [], (a, b) => {
    assert.equal(a.question, b.question);
    assert.deepEqual([...a.answer], [...b.answer]);
  });
});

test("the seeded projects are the ones the projects import carries in, plus the one invented project", () => {
  assertFromImport("project", projectItemsOf(data), importedProjects(), [PLACEHOLDER_ROCKET_PROJECT]);
});

test("the seeded outreach posts, tags and summit are the ones the outreach import carries in, plus the two invented posts", () => {
  const imported = importedOutreach();
  // The placeholder galleries (issue #456) are the seed's own; the rest of each post is the import's.
  assertFromImport("post", outreachItemsOf(data), imported.posts, [EVERY_CHANNEL_POST, DRAFT_ONLY_POST], ({ gallery: _, ...seeded }, importedPost) =>
    assert.deepEqual(seeded, importedPost),
  );
  assert.deepEqual(outreachTagsOf(data), imported.tags.map((t) => ({ name: t.name, award: t.award })));
  assert.deepEqual(outreachSummitOf(data)?.published, imported.summit.state === "published" ? imported.summit.published : undefined);
});

test("the pinned post, the newest listed post and two more record posts carry a placeholder gallery of the site's own photos (issue #456)", () => {
  const items = outreachItemsOf(data);
  const published = publishedById(items);
  const pinned = data.outreachPosts.find((p) => p.pinned)?.id;
  const [newest] = newestFirst([...published].filter(([id]) => id !== pinned).map(([id, post]) => ({ id, date: post.date })));
  assert.ok(RECORD_GALLERY_POSTS.includes(newest.id), "the newest listed post has a gallery");
  assert.ok(pinned !== undefined && RECORD_GALLERY_POSTS.includes(pinned), "the pinned post has a gallery");
  assert.equal(RECORD_GALLERY_POSTS.length, 4);
  assert.deepEqual(
    [...published].filter(([, post]) => post.gallery !== undefined).map(([id]) => id).sort((a, b) => a - b),
    [...RECORD_GALLERY_POSTS, EVERY_CHANNEL_POST].sort((a, b) => a - b),
    "only these posts and the every-channel post have a gallery",
  );
  for (const id of RECORD_GALLERY_POSTS) {
    const photos = published.get(id)?.gallery?.items ?? [];
    assert.ok(photos.length >= 4 && photos.length <= 6, `post ${id} has ${photos.length} gallery photos`);
    for (const photo of photos) {
      assert.match(photo.src, /^\/(outreach|project-photos)\//);
      assert.ok(existsSync(join(process.cwd(), "public", photo.src)), `${photo.src} is not in public/`);
      assert.notEqual(photo.alt.trim(), "", `${photo.src} has no alt text`);
    }
  }
  const draftChanges = items.find((i) => i.id === DRAFT_CHANGES_POST)?.version;
  assert.ok(draftChanges?.state === "published");
  assert.equal(draftChanges.published.gallery, undefined);
  assert.equal(draftChanges.draft?.gallery, undefined);
});

// What stays private.

/** A domain reserved for examples and tests (RFC 2606, RFC 6761), where no mail reaches anyone. */
function isReservedDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  if (["example.com", "example.org", "example.net"].some((r) => d === r || d.endsWith(`.${r}`))) return true;
  return ["test", "example", "invalid", "localhost"].includes(d.split(".").at(-1) ?? "");
}

test("every seeded email is on a reserved test domain", () => {
  const advisorEmails = teamAdvisorItemsOf(data).flatMap((item) =>
    [item.version.state === "published" ? item.version.published : null, item.version.draft].flatMap((v) => (v?.email === undefined ? [] : [v.email])),
  );
  const emails = [
    ...data.users.map((u) => u.email),
    ...data.members.flatMap((m) => (m.prtEmail == null ? [] : [m.prtEmail])),
    ...advisorEmails,
  ];
  assert.ok(emails.length > 100);
  assert.ok(advisorEmails.length > 0);
  for (const email of emails) {
    const domain = email.split("@")[1] ?? "";
    assert.ok(isReservedDomain(domain), `${email} is not on a reserved test domain`);
  }
});

test("no seeded email, phone number, PoliTo id, application, order or grant is copied from a real person", () => {
  const publicEmails = [
    team.orgChart.leader,
    ...team.orgChart.leaders,
    ...team.departments.groups.flatMap((g) => g.members),
    ...team.advisors.people,
  ].flatMap((p) => (p.email === undefined ? [] : [p.email.toLowerCase()]));
  assert.ok(publicEmails.length > 0);
  const privateRows = JSON.stringify([data.users, data.members, data.applications, data.orders, data.scopes, data.handOvers, data.teamPageAdvisorVersions]).toLowerCase();
  for (const email of publicEmails) assert.ok(!privateRows.includes(email), `${email} is copied into the seed`);
  // Phone numbers and PoliTo ids follow the seed's own patterns, made from the member id.
  for (const m of data.members) if (m.mobileNumber != null) assert.equal(m.mobileNumber, `+39 3${String(m.memberId).padStart(9, "0")}`);
  for (const u of data.users) {
    if (u.politoId != null) assert.match(u.politoId, /^s(1\d{5}|9\d{5})$/, `${u.id}`);
    assert.equal(u.dateOfBirth ?? null, null, `${u.id} has a birth date`);
    assert.equal(u.phone ?? null, null, `${u.id} has a phone number`);
  }
  // Every application is by someone the site names nowhere: an invented applicant or the applicant tester.
  const publicNames = new Set(team.coreMembers.members.map((m) => m.name));
  for (const a of data.applications) {
    const user = data.users.find((u) => u.id === a.userId)!;
    assert.ok(!publicNames.has([user.firstName, user.lastName].join(" ")), `application ${a.id} is by a public person`);
  }
});
