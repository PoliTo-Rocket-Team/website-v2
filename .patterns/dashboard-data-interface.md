# Dashboard data interface with dummy data

How dashboard pages and their server actions read and write data: through one interface,
`DashboardData`, with two implementations. A test developer gets the dummy arrays in
`lib/dummy-data/` only where no database is configured. Where one is, a test developer reads the
database as their viewer's seeded person, with every write refused; everyone else always gets the
database. The `/apply` pages make the same choice through their own picker. Why a preview reads
its own seeded database, and dummy data is left for runs with none, is
[0016](../.decisions/0016-previews-read-their-own-seeded-branch.md).

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
   [lib/dummy-data/content-edits.ts](../lib/dummy-data/content-edits.ts), each in its own cookie.

2. **Two implementations.** `dummyDashboardData(kind, …)` in
   [lib/dummy-data/index.ts](../lib/dummy-data/index.ts) answers from the dummy arrays for one
   viewer kind. `openDatabaseDashboard()` in [lib/dashboard/database.ts](../lib/dashboard/database.ts)
   answers from the signed-in person's rows, and is `null` with no database or no session. That
   person is an account, or the seeded person a test developer is read as (`getCurrentUser` in
   [lib/current-user.ts](../lib/current-user.ts), `TEST_VIEWER_PEOPLE` in
   [lib/test-viewer-people.ts](../lib/test-viewer-people.ts)).

3. **One place picks.** `openDashboard()` in [lib/dashboard/open.ts](../lib/dashboard/open.ts),
   cached per request, reads the test developer cookie. A viewer there gets the dummy side, with the
   test developer's changes laid over it from cookies, only when `dummyDataOn` is true. Otherwise it
   opens the database side, as the viewer's seeded person for a test developer. It
   answers a `DashboardOpening` ([lib/dashboard/opening.ts](../lib/dashboard/opening.ts)): `open`,
   `signed-out` or `account-unresolved`.

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
   ([lib/dashboard/write.ts](../lib/dashboard/write.ts)). On the dummy side a test developer's
   write changes only a cookie in their own browser, set in `open.ts`. On the database side
   `runAuditQuery` and `runAuditBatch` ([lib/db-audit.ts](../lib/db-audit.ts)) both ask
   `auditWriterOf` in [lib/test-developer.ts](../lib/test-developer.ts): on a preview the write is
   saved to the shared `preview` branch as the viewer's seeded person, and in production and under
   `next dev` it is refused before it is sent (`testDeveloperMayWrite`, ADR 0016).

6. **The public `/apply` pages pick the same way.** `pickApplyData` in
   [lib/apply/pick.ts](../lib/apply/pick.ts) takes the dummy side when `dummyDataOn`
   ([lib/dummy-data/mode.ts](../lib/dummy-data/mode.ts)) is true, else the database. Off the gate it
   never reads the dummy cookies.

The two gates are one rule in two functions. `testDeveloperOn` in
[lib/test-developer.ts](../lib/test-developer.ts) is true on a Vercel preview or under `next dev`.
`dummyDataOn` is true on a Vercel preview or under `next dev`, and only with no `DATABASE_URL`.
Both are false in production.

## When this applies

Every page under [app/dashboard/](../app/dashboard/) and every action in
[app/dashboard/actions.ts](../app/dashboard/actions.ts), [recruitment-actions.ts](../app/dashboard/recruitment-actions.ts)
and [team-actions.ts](../app/dashboard/team-actions.ts), plus the `/apply` pages through
`pickApplyData`. Domain rules that both sides share live in plain modules both call, for example
`applyMove` in [lib/dashboard/application-flow.ts](../lib/dashboard/application-flow.ts), so the
two sides cannot disagree on which move is legal. Tests:
[lib/dummy-data/dashboard.test.ts](../lib/dummy-data/dashboard.test.ts) and
[lib/dashboard/opening.test.ts](../lib/dashboard/opening.test.ts).

It does not apply to the legacy route group, whose pages still call `app/actions/` directly
([scope-access.md](./scope-access.md)).

## Why it is not obvious

- A page that imports a database read directly works on production and breaks every run with no
  database, where the test developer reads the dummy side. It also skips the viewer resolution
  `openDashboard()` does, so a test developer is not read as their seeded person.
- A domain rule written only inside `database.ts` leaves the dummy side free to do something else,
  so a preview shows a flow production does not have. Put the rule in a shared module and call it
  from both sides.
- A test developer's write reaches no database but a preview's `preview` branch. On the dummy side
  their changes go to cookies, which keeps each reviewer's changes in their own browser. On the
  database side `lib/db-audit.ts` saves the write as the viewer's seeded person only on a preview,
  whose shared branch keeps it across preview builds (a build seeds that branch only while it is
  empty), and refuses it anywhere else.

## Known inconsistencies (not the pattern)

- **Two gates, two functions.** `testDeveloperOn` and `dummyDataOn` read the environment
  separately. Where a `DATABASE_URL` is set, test developer sign-in is still on while
  `dummyDataOn` is false, so the test developer reads the database as a seeded person.
- **The Team pages' writes differ.** They sit behind `teamWrites`, which can be `null`, and each
  answers a `boolean` (`TeamWrites` in [lib/dashboard/data.ts](../lib/dashboard/data.ts)). Every
  other write is always present and answers a `WriteResult` that says why it refused.
