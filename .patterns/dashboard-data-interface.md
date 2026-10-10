# Dashboard data interface with dummy data

How dashboard pages and their server actions read and write data: through one interface,
`DashboardData`, with two implementations. A test developer gets the dummy arrays in
`lib/dummy-data/`; everyone else gets the database. The `/apply` pages make the same choice
through their own picker. Why previews and `next dev` run on dummy data is
[0009](../.decisions/0009-previews-and-dev-use-dummy-data.md).

## The shape

1. **One interface.** `DashboardData` in [lib/dashboard/data.ts](../lib/dashboard/data.ts) holds
   every read and write a dashboard page makes: `overview()`, `members()`, `positions()`,
   `moveApplication()`, `deleteAccount()`, and so on, plus `teamWrites` for the Team pages. A new
   page adds one method here and to both implementations.

2. **Two implementations.** `dummyDashboardData(kind, …)` in
   [lib/dummy-data/index.ts](../lib/dummy-data/index.ts) answers from the dummy arrays for one
   viewer kind. `openDatabaseDashboard()` in [lib/dashboard/database.ts](../lib/dashboard/database.ts)
   answers from the signed-in account's rows, and is `null` with no database or no session.

3. **One place picks.** `openDashboard()` in [lib/dashboard/open.ts](../lib/dashboard/open.ts),
   cached per request, reads the test developer cookie. A viewer there gets the dummy side, with the
   test developer's changes laid over it from cookies. Otherwise it opens the database side. It
   answers a `DashboardOpening` ([lib/dashboard/opening.ts](../lib/dashboard/opening.ts)): `open`,
   `signed-out` or `account-unresolved`.

4. **Pages ask `openDashboard()` and never the database.** A page handles the two closed kinds,
   checks `canReach`, then reads through `data`:

   ```tsx
   const opening = await openDashboard();
   if (opening.kind === "signed-out") redirect("/login?cb=/dashboard/members");
   if (opening.kind === "account-unresolved") return null;
   const { data } = opening;
   if (!canReach(data.viewer.kind, "members")) notFound();
   return <MembersView directory={await data.members()} editable={data.teamWrites !== null} />;
   ```
   ([app/dashboard/members/page.tsx](../app/dashboard/members/page.tsx))

5. **Writes answer a `WriteResult`.** Server actions in
   [app/dashboard/actions.ts](../app/dashboard/actions.ts) open the dashboard the same way
   (`dataFor`), check the viewer reaches the page, and hand what the browser sent to the interface.
   The interface checks it again and answers `written(value)` or `refused(error)`
   ([lib/dashboard/write.ts](../lib/dashboard/write.ts)). A test developer's write changes only a
   cookie in their own browser, set in `open.ts`; the database is never touched.

6. **The public `/apply` pages pick the same way.** `pickApplyData` in
   [lib/apply/pick.ts](../lib/apply/pick.ts) takes the dummy side when `dummyDataOn`
   ([lib/dummy-data/mode.ts](../lib/dummy-data/mode.ts)) is true, else the database. Off the gate it
   never reads the dummy cookies.

The two gates are one rule in two functions. `testDeveloperOn` in
[lib/test-developer.ts](../lib/test-developer.ts) is true on a Vercel preview or under `next dev`.
`dummyDataOn` is true on a Vercel preview, or under `next dev` with no `DATABASE_URL`. Both are
false in production.

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

- A page that imports a database read directly works on production and breaks every preview, which
  has no database. It also gives the test developer nothing to look at.
- A domain rule written only inside `database.ts` leaves the dummy side free to do something else,
  so a preview shows a flow production does not have. Put the rule in a shared module and call it
  from both sides.
- A test developer's write must not reach the database. Writing dummy changes to cookies keeps
  each reviewer's changes in their own browser.

## Known inconsistencies (not the pattern)

- **Two gates, two functions.** `testDeveloperOn` and `dummyDataOn` read the environment
  separately. Under `next dev` with a `DATABASE_URL`, test developer sign-in is still on, while the
  public pages read the database.
- **The Team pages' writes differ.** They sit behind `teamWrites`, which can be `null`, and each
  answers a `boolean` (`TeamWrites` in [lib/dashboard/data.ts](../lib/dashboard/data.ts)). Every
  other write is always present and answers a `WriteResult` that says why it refused.
