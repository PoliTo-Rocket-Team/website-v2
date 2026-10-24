# Dashboard data interface

How dashboard pages and their server actions read and write data: through one interface,
`DashboardData`, with one implementation, the database. Every page reads it: under `next dev`
the Neon `development` branch, on a preview the shared `preview` branch, in production its own. A
check reads it as a seeded person through a real session: the tester sign-in, then View as (issue
#612). The in-memory copy of the dashboard that tests once read, `lib/dummy-data/`, is removed
(issue #613); the tests run the real loaders and actions against a migrated in-memory Postgres
(PGlite, issue #649) instead. Why
a preview reads its own seeded database is
[0016](../.decisions/0016-previews-read-their-own-seeded-branch.md), and its amendment of
2026-10-24 retires the dummy fallback.

## The shape

1. **One interface.** `DashboardData` in [lib/dashboard/data.ts](../lib/dashboard/data.ts) holds
   every read and write a dashboard page makes: `overview()`, `members()`, `positions()`,
   `moveApplication()`, `deleteAccount()`, and so on, plus `teamWrites` for the Team pages. A new
   page adds one method here and to the implementation. A site-content page adds one editor
   instead (`partners`, issue #256): `contentEditor` in [lib/content/editor.ts](../lib/content/editor.ts)
   holds the site-content gate, the draft and publish step and the site order, and the database
   side hands it its store ([lib/dashboard/database-partners.ts](../lib/dashboard/database-partners.ts)).
   The FAQ editor (`faqs`, issue #258) does the same. A test of an editor's rules hands it a store
   held in memory ([lib/content/memory.ts](../lib/content/memory.ts),
   [lib/outreach-memory.ts](../lib/outreach-memory.ts)).

2. **One implementation.** `openDatabaseDashboard()` in
   [lib/dashboard/database.ts](../lib/dashboard/database.ts) answers from the signed-in person's
   rows, and is `null` with no session, or in production with no database. That person is the
   session's account, or the person a View as session views as (`getCurrentUser` in
   [lib/current-user.ts](../lib/current-user.ts)).

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
   ([lib/db-audit.ts](../lib/db-audit.ts)) both ask `auditWriterFor` in
   [lib/audit-writer.ts](../lib/audit-writer.ts), which logs the write under the session's account
   and, in a View as session, the acting account beside it (issue #605).

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
live in plain modules the database side calls, for example `applyMove` in
[lib/dashboard/application-flow.ts](../lib/dashboard/application-flow.ts), and are tested there.
Tests of the interface itself run every loader and action against a migrated in-memory Postgres
(PGlite, [lib/dashboard/access-matrix/test-database.ts](../lib/dashboard/access-matrix/test-database.ts)):
[lib/dashboard/access-matrix-server.test.ts](../lib/dashboard/access-matrix-server.test.ts),
[lib/dashboard/dashboard-rules-server.test.ts](../lib/dashboard/dashboard-rules-server.test.ts),
[lib/dashboard/opening.test.ts](../lib/dashboard/opening.test.ts) and
[lib/database-required.test.ts](../lib/database-required.test.ts).

It does not apply to the legacy route group, whose pages still call `app/actions/` directly
([scope-access.md](./scope-access.md)).

## Why it is not obvious

- A page that imports a database read directly skips the viewer resolution `openDashboard()`
  does, so it reads no standing for the session's account.
- A page that adds its own "no database" fallback under `next dev` or on a preview never runs it:
  the first database read there stops the run (`DatabaseRequired`).

## Known inconsistencies (not the pattern)

- **The Team pages' writes differ.** They sit behind `teamWrites`, which can be `null`, and each
  answers a `boolean` (`TeamWrites` in [lib/dashboard/data.ts](../lib/dashboard/data.ts)). Every
  other write is always present and answers a `WriteResult` that says why it refused.
