# Dashboard data interface with dummy data

How dashboard pages and their server actions read and write data: through one interface,
`DashboardData`, with two implementations. Every page reads the database one: under `next dev`
the Neon `development` branch, on a preview the shared `preview` branch, in production its own. A
test developer reads it as their viewer's seeded person. The dummy implementation in
`lib/dummy-data/` is read only by tests now (issue #609), until a later child of epic #597 removes
it. Why a preview reads its own seeded database is
[0016](../.decisions/0016-previews-read-their-own-seeded-branch.md), and its amendment of
2026-10-24 retires the dummy fallback.

## The shape

1. **One interface.** `DashboardData` in [lib/dashboard/data.ts](../lib/dashboard/data.ts) holds
   every read and write a dashboard page makes: `overview()`, `members()`, `positions()`,
   `moveApplication()`, `deleteAccount()`, and so on, plus `teamWrites` for the Team pages. A new
   page adds one method here and to both implementations. A site-content page adds one editor
   instead (`partners`, issue #256): `contentEditor` in [lib/content/editor.ts](../lib/content/editor.ts)
   holds the site-content gate, the draft and publish step and the site order, and each side hands
   it its own store ([lib/dashboard/database-partners.ts](../lib/dashboard/database-partners.ts),
   [lib/dummy-data/partners.ts](../lib/dummy-data/partners.ts)). The FAQ editor (`faqs`, issue
   #258) does the same, and the dummy side keeps every content type's changes the one way,
   [lib/dummy-data/content-edits.ts](../lib/dummy-data/content-edits.ts).

2. **Two implementations.** `openDatabaseDashboard()` in
   [lib/dashboard/database.ts](../lib/dashboard/database.ts) answers from the signed-in person's
   rows, and is `null` with no session, or in production with no database. That person is an
   account, or the seeded person a test developer is read as (`getCurrentUser` in
   [lib/current-user.ts](../lib/current-user.ts), `TEST_VIEWER_PEOPLE` in
   [lib/test-viewer-people.ts](../lib/test-viewer-people.ts)). `dummyDashboardData(kind, …)` in
   [lib/dummy-data/index.ts](../lib/dummy-data/index.ts) answers from the dummy arrays for one
   viewer kind; only tests call it.

3. **One place opens.** `openDashboard()` in [lib/dashboard/open.ts](../lib/dashboard/open.ts),
   cached per request, opens the database side. It answers a `DashboardOpening`
   ([lib/dashboard/opening.ts](../lib/dashboard/opening.ts)): `open`, `signed-out` or
   `account-unresolved`.

4. **Pages ask `openDashboard()` and never the database.** A page handles the two closed kinds,
   checks `canReach` on the viewer, then reads through `data`:

   ```tsx
   const opening = await openDashboard();
   if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/members");
   if (opening.kind === "account-unresolved") return null;
   const { data } = opening;
   if (!canReach(data.viewer, "members")) notFound();
   return <MembersView directory={await data.members()} editable={data.teamWrites !== null} />;
   ```
   ([app/dashboard/members/page.tsx](../app/dashboard/members/page.tsx))

5. **Writes answer a `WriteResult`.** Server actions in
   [app/dashboard/actions.ts](../app/dashboard/actions.ts) open the dashboard the same way
   (`dataFor`), check the viewer reaches the page, and hand what the browser sent to the interface.
   The interface checks it again and answers `written(value)` or `refused(error)`
   ([lib/dashboard/write.ts](../lib/dashboard/write.ts)). `runAuditQuery` and `runAuditBatch`
   ([lib/db-audit.ts](../lib/db-audit.ts)) both ask `auditWriterOf` in
   [lib/test-developer.ts](../lib/test-developer.ts): on a preview a test developer's write is
   saved to the shared `preview` branch as the viewer's seeded person, and in production and under
   `next dev` it is refused before it is sent (`testDeveloperMayWrite`, ADR 0016).

6. **A run with no database stops where it must have one.** `isDatabaseConfigured` and `getDb` in
   [db/client.ts](../db/client.ts) ask `assertDatabaseWhereRequired` in
   [lib/database-required.ts](../lib/database-required.ts) first: under `next dev` or on a preview
   with no `DATABASE_URL` it throws `DatabaseRequired`, whose message names the database the run
   needs. Production may still run with no database.

## When this applies

Every page under [app/dashboard/](../app/dashboard/) and every action in
[app/dashboard/actions.ts](../app/dashboard/actions.ts), [recruitment-actions.ts](../app/dashboard/recruitment-actions.ts)
and [team-actions.ts](../app/dashboard/team-actions.ts). The `/apply` pages read
`databaseApplyData` in [lib/apply/database.ts](../lib/apply/database.ts) directly. Domain rules
that both sides share live in plain modules both call, for example `applyMove` in
[lib/dashboard/application-flow.ts](../lib/dashboard/application-flow.ts), so the two sides cannot
disagree on which move is legal. Tests:
[lib/dummy-data/dashboard.test.ts](../lib/dummy-data/dashboard.test.ts),
[lib/dashboard/opening.test.ts](../lib/dashboard/opening.test.ts) and
[lib/database-required.test.ts](../lib/database-required.test.ts).

It does not apply to the legacy route group, whose pages still call `app/actions/` directly
([scope-access.md](./scope-access.md)).

## Why it is not obvious

- A page that imports a database read directly skips the viewer resolution `openDashboard()`
  does, so a test developer is not read as their seeded person.
- A page that adds its own "no database" fallback under `next dev` or on a preview never runs it:
  the first database read there stops the run (`DatabaseRequired`).
- A test developer's write reaches no database but a preview's `preview` branch. `lib/db-audit.ts`
  saves it as the viewer's seeded person only on a preview, whose shared branch keeps it across
  preview builds (a build seeds that branch only while it is empty), and refuses it anywhere else.

## Known inconsistencies (not the pattern)

- **The dummy side still exists.** `dummyDashboardData` and the rest of `lib/dummy-data/` are kept
  for the tests that read them until a later child of epic #597 removes the folder; no page,
  route or loader reads them.
- **The Team pages' writes differ.** They sit behind `teamWrites`, which can be `null`, and each
  answers a `boolean` (`TeamWrites` in [lib/dashboard/data.ts](../lib/dashboard/data.ts)). Every
  other write is always present and answers a `WriteResult` that says why it refused.
