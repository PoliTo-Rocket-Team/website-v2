# Audited mutations

How the app writes to Postgres today: a `"use server"` module exports one function per mutation,
which hands the input to a `server-only` write that checks it, runs the Drizzle write through
`runAuditQuery` so the audit trigger knows who did it, then invalidates the cache tags the write
made stale. Client components import the action functions directly.

## The shape

1. **Write through `runAuditQuery`.** [lib/db-audit.ts](../lib/db-audit.ts) takes a builder, not a
   finished query. When a user is signed in, it sends the write in one `db.batch` together with
   `set_config('request.jwt.claim.sub', <userId>, true)`. The audit trigger `log_db_changes()`
   (migrations [0002](../drizzle/0002_add_audit_logs.sql) and
   [0003](../drizzle/0003_logs_changed_by_user_fk.sql)) reads that setting into `logs.changed_by`.
   The same setup sets `request.acting_account` to the account behind a View as session, read from
   the session (`auditWriterFor` in [lib/audit-writer.ts](../lib/audit-writer.ts)), and empty
   otherwise; since [0061](../drizzle/0061_impersonated_write_attribution.sql) the trigger stores it
   in `logs.changed_by_acting_account` (issue #605). Since
   [0081](../drizzle/0081_audit_log_skip_auth_secrets.sql) the trigger leaves the Better Auth secret
   columns out of the rows it stores (`accessToken`, `refreshToken`, `idToken` and `password` of
   `better_auth.account`, `token` of `better_auth.session`, `value` of `better_auth.verification`;
   issue #937). A write that names its author in a member-id
   "by" column (`given_by`, `reviewed_by`, ...) also sets that column's `..._acting_account`
   companion from `identity.actingAccountId`, and a read shows it with `attributedName`
   ([lib/dashboard/acting-account.ts](../lib/dashboard/acting-account.ts)): "IT lead as Sara Conti".
   A "by" line read off the log itself, joined on `logs.changed_by`, also reads
   `logs.changed_by_acting_account` and shows it the same way (`readProjectStamps` in
   [lib/dashboard/database-projects.ts](../lib/dashboard/database-projects.ts)). The Activity log
   page lists the `logs` rows ([#642](https://github.com/PoliTo-Rocket-Team/website-v2/issues/642)):
   [lib/dashboard/database-activity-log.ts](../lib/dashboard/database-activity-log.ts) reads them
   and [lib/dashboard/activity-log.ts](../lib/dashboard/activity-log.ts) reads the rows one
   transaction stored, which share one `changed_at`, as one change with one sentence.

   ```ts
   async function setPositionOpen(identity: Identity, positionId: number, open: boolean): Promise<void> {
     if (!(await reachablePositionIds(identity)).has(positionId)) throw new DashboardRefused(`position ${positionId}`);
     await runAuditQuery((db) => db.update(applyPositions).set({ status: open }).where(eq(applyPositions.id, positionId)));
     refreshAfter("positions", updateTag);
   }
   ```
   ([lib/dashboard/database-recruitment.ts](../lib/dashboard/database-recruitment.ts))

   Return the builder's query unawaited. `runAuditQuery` needs the un-run query so it can batch it.

2. **Check the input on the server.** The write takes `unknown` and checks it before it writes:
   `checkNewPosition` and `checkPositionContent` in
   [lib/dashboard/new-position.ts](../lib/dashboard/new-position.ts) turn the drawer's fields into a
   typed position or a list of errors, and `createPosition` / `editPosition` in
   [lib/dashboard/database-recruitment.ts](../lib/dashboard/database-recruitment.ts) map the typed
   position to the Drizzle columns.

3. **Soft delete.** A position row carries `isDeleted`; reads filter it out (`readPositionRows` in
   [lib/dashboard/database-recruitment.ts](../lib/dashboard/database-recruitment.ts); see
   [drizzle-reads.md](./drizzle-reads.md)). No dashboard write deletes a position today.

4. **Return what the client needs.** `createPosition` inserts with `.returning({ id })` and
   returns the new id and its position code, so the drawer can name the saved role.

5. **Invalidate the read tags.** After the write, call `updateTag` on every tag whose snapshot the
   write changed, as `setPositionOpen` does above. A tag that more than one cached read carries
   (positions, the team roster) lives in [lib/cache-tags.ts](../lib/cache-tags.ts), and the write
   refreshes it by kind, `refreshAfter("positions", updateTag)`, from the same mapping the cached
   reads take their tags from (issue #397).

6. **Call the actions from the client.** The dashboard's client components import them from
   [app/dashboard/recruitment-actions.ts](../app/dashboard/recruitment-actions.ts), which checks the
   arguments and writes through the dashboard data interface
   ([lib/dashboard/data.ts](../lib/dashboard/data.ts)), which reads the database under `next dev`
   and on a preview (issue #609; a preview reads the seeded `preview` branch). Every writer is a
   real Better Auth session, plain or View as (issue #612). An account's write goes through `runAuditQuery` in
   [lib/dashboard/database.ts](../lib/dashboard/database.ts) after a scope check. The client shows
   the change at once (`useOptimistic`) and a toast when the write is refused (see
   [client-form-submit.md](./client-form-submit.md)).

## When this applies

Any write to an app table in `public`. Call sites today: the site-wide
recruitment switch (an upsert on `recruitment_setting`, in `saveRecruitment` in
[lib/dashboard/database.ts](../lib/dashboard/database.ts), called through the dashboard data
interface's `setRecruitment`), `setPositionOpen`, `createPosition` and `moveApplication` in
[lib/dashboard/database-recruitment.ts](../lib/dashboard/database-recruitment.ts), and `sendApplication` in
[app/apply/[slug]/actions.ts](../app/apply/[slug]/actions.ts). The dashboard's writes
([app/dashboard/actions.ts](../app/dashboard/actions.ts)) take one more step: each action checks the
viewer reaches the page, then hands the input to the dashboard data interface, whose database side
([lib/dashboard/database-division.ts](../lib/dashboard/database-division.ts),
[lib/dashboard/database-self.ts](../lib/dashboard/database-self.ts)) checks the input and the
viewer's own scope again before it writes through `runAuditQuery` or `runAuditBatch`. The partner
writes (issue #256) pass the site-content gate in `contentEditor`
([lib/content/editor.ts](../lib/content/editor.ts)), then
[lib/dashboard/database-partners.ts](../lib/dashboard/database-partners.ts) writes and calls
`updateTag(PARTNERS_CACHE_TAG)`; the question writes (issue #258) do the same through
[lib/dashboard/database-faqs.ts](../lib/dashboard/database-faqs.ts) and `updateTag(FAQS_CACHE_TAG)`, and the Team page's visual layer (issue #283) through
[lib/dashboard/database-team-page.ts](../lib/dashboard/database-team-page.ts) and `updateTag(TEAM_PAGE_LAYER_CACHE_TAG)`. The Team
page editor's Save draft and Publish (issue #321) send the layer's rows and every advisor write in
one `runAuditBatch` through
[lib/dashboard/database-team-page-store.ts](../lib/dashboard/database-team-page-store.ts), so the
two land together or not at all. `runAuditQuery` and `runAuditBatch` both ask `auditWriterFor` in
[lib/audit-writer.ts](../lib/audit-writer.ts) (through [lib/db-audit.ts](../lib/db-audit.ts)), which
logs the write under the session's account and, in a View as session, the acting account beside
it (issue #605). The
Positions and Applications writes ([app/dashboard/recruitment-actions.ts](../app/dashboard/recruitment-actions.ts))
leave the scope check to the data interface: its database side checks the viewer reaches the
position or application before it writes through `runAuditQuery` or `runAuditBatch`. An application move (issue #171) first asks
`applyMove` in [lib/dashboard/application-flow.ts](../lib/dashboard/application-flow.ts) whether
it is legal, and each update is guarded on the status it was read in. Confirm join is one
data-modifying `WITH` statement through `runAuditQuery` (`db.execute` with a `sql` template), because the
new `members` row's id must reach the `users` link and the `roles` row in the same write. Several
writes that must land together go through `runAuditBatch` instead: one `db.batch` with the audit
setup first. A batch cannot pass one insert's id to the next, so a later write finds an earlier row
by a unique value (the application finds its file rows by their unique Blob pathname). A batch
cannot read and then decide either, so a write that must not land on rows changed since it read
them opens its batch with a guard statement (`failUnless` and `unchangedRows` in
[lib/db-guard.ts](../lib/db-guard.ts), issue #831) that fails the whole transaction; the caller
reads that failure back with `isGuardFailure` and answers a refusal. A guard alone does not stop
two batches that both pass it before either commits, so a batch first takes a lock the other
waits on: `unchangedRows` opens with the table's transaction-level advisory lock, and the next
statement, under Read Committed, reads what the batch before committed. The content stores do
this through `writeOverExpected` in
[lib/dashboard/database-guarded-write.ts](../lib/dashboard/database-guarded-write.ts), and
anonymization locks the person's `users` row (`for update`) before its `failUnless`. A write that drops a reference to a public-store file ends
its batch with `referencedPublicFiles`
([lib/storage/public-references.ts](../lib/storage/public-references.ts)) and deletes only the
files no row names (`deleteUnreferencedAfter` in
[lib/storage/unreferenced-delete.ts](../lib/storage/unreferenced-delete.ts)), as `setPhoto` in
[lib/dashboard/database-self.ts](../lib/dashboard/database-self.ts) does. Better Auth
writes its own tables through its adapter and does not use `runAuditQuery`. The application submit's
rules live in [lib/apply/submit.ts](../lib/apply/submit.ts), with its database and private file
store passed in, so [submit.test.ts](../lib/apply/submit.test.ts) tests them with fakes. The
recruitment switch does the same: its rule lives in
[lib/apply/recruitment-switch.ts](../lib/apply/recruitment-switch.ts) with the permission, the write
and the cache refresh passed in, and [recruitment-switch.test.ts](../lib/apply/recruitment-switch.test.ts)
tests each standing. Its action reaches the write through the dashboard data interface
(`setRecruitment` in [lib/dashboard/data.ts](../lib/dashboard/data.ts)): the database side upserts
through `runAuditQuery`, and the server-side access tests
([lib/dashboard/access-matrix-server.test.ts](../lib/dashboard/access-matrix-server.test.ts)) call it
against a migrated in-memory Postgres (PGlite), where the audit trigger runs. The same holds for
the other audited writes: [lib/dashboard/access-matrix/install.ts](../lib/dashboard/access-matrix/install.ts)
points `@/db/client` at that database, so the server-side tests run `runAuditQuery` and
`runAuditBatch` in [lib/db-audit.ts](../lib/db-audit.ts) as the server does. For example, the
issue #605 block in
[lib/dashboard/access-matrix-server.test.ts](../lib/dashboard/access-matrix-server.test.ts) calls
`decideOrder`, `saveAccess` and `confirmNda` and reads the rows the audit trigger wrote to `logs`.
[dashboard-data-interface.md](./dashboard-data-interface.md) names other suites on that database
and how to find the rest.

## Why it is not obvious

- A plain `getDb().update(...)` still fires the audit trigger, but with no `request.jwt.claim.sub`
  set, the trigger (as redefined in migration 0003) falls back to `better_auth.uid()` and else
  writes `changed_by = NULL`, so the log can lose
  the person. `set_config(..., true)` is transaction-local, and the `neon-http` driver runs
  `db.batch` as one transaction, which is why the setup and the write must share one batch.
- Without the `updateTag` call, the `"use cache"` snapshots keep serving the old rows for their
  `cacheLife` (weeks for positions).

## Known inconsistencies (not the pattern)

- **Anonymous writes skip the batch.** When `getCurrentUserId()` returns `null`, `runAuditQuery`
  runs the query alone, with no error.
