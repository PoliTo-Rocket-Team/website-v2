# Audited mutations

How the app writes to Postgres today: a `"use server"` module exports one function per mutation,
runs the Drizzle write through `runAuditQuery` so the audit trigger knows who did it, then
invalidates the cache tags the write made stale. A Server Component passes the functions down to a
client component as props.

## The shape

1. **Write through `runAuditQuery`.** [lib/db-audit.ts](../lib/db-audit.ts) takes a builder, not a
   finished query. When a user is signed in, it sends the write in one `db.batch` together with
   `set_config('request.jwt.claim.sub', <userId>, true)`. The audit trigger `log_db_changes()`
   (migrations [0002](../drizzle/0002_add_audit_logs.sql) and
   [0003](../drizzle/0003_logs_changed_by_user_fk.sql)) reads that setting into `logs.changed_by`.

   ```ts
   export async function handleEditPosition(id: number, updatedData: PositionMutation) {
     await runAuditQuery((db) =>
       db
         .update(applyPositions)
         .set(buildPositionMutation(updatedData))
         .where(eq(applyPositions.id, id)),
     );
     invalidatePositionCaches();
   }
   ```
   ([app/(legacy)/dashboard/positions/server-actions.ts](../app/(legacy)/dashboard/positions/server-actions.ts))

   Return the builder's query unawaited. `runAuditQuery` needs the un-run query so it can batch it.

2. **Map input keys once.** The client sends snake_case (`required_skills`); a `build*` function
   maps it to the Drizzle camelCase columns (`buildPositionMutation`, `buildNewPositionValues`).

3. **Soft delete.** Deleting a position sets `isDeleted: true`; reads filter it out (see
   [drizzle-reads.md](./drizzle-reads.md)).

4. **Re-read after insert.** `handleAddPosition` inserts with `.returning({ id })`, then loads the
   full joined row with `getPositionById` and returns it, so the client can add it to its list.

5. **Invalidate the read tags.** After the write, call `updateTag` on every tag whose snapshot the
   write changed. The tag names come from the read module:

   ```ts
   function invalidatePositionCaches() {
     updateTag(POSITIONS_CACHE_TAG);
     updateTag(PUBLIC_POSITIONS_CACHE_TAG);
   }
   ```

6. **Pass actions as props.** The page imports the actions and hands them to the client list
   ([dashboard/positions/page.tsx](../app/(legacy)/dashboard/positions/page.tsx) →
   [components/apply-positions-list.tsx](../components/apply-positions-list.tsx)). The client calls
   them, updates local state on success, and shows a toast (see
   [client-form-submit.md](./client-form-submit.md)).

## When this applies

Any write to an app table in `public`. Call sites today: `handleDelete`, `handleEditPosition` and
`handleAddPosition` in `server-actions.ts`, and `sendApplication` in
[app/apply/[slug]/actions.ts](../app/apply/[slug]/actions.ts). The dashboard's writes
([app/dashboard/actions.ts](../app/dashboard/actions.ts)) take one more step: each action checks the
viewer reaches the page, then hands the input to the dashboard data interface, whose database side
([lib/dashboard/database-division.ts](../lib/dashboard/database-division.ts),
[lib/dashboard/database-self.ts](../lib/dashboard/database-self.ts)) checks the input and the
viewer's own scope again before it writes through `runAuditQuery` or `runAuditBatch`. A test
developer's write goes to the dummy side, which checks the same rules and stores nothing. Several writes that must land
together go through `runAuditBatch` instead: one `db.batch` with the audit setup first. A batch
cannot pass one insert's id to the next, so a later write finds an earlier row by a unique value
(the application finds its file rows by their unique Blob pathname). Better Auth writes its own
tables through its adapter and does not use `runAuditQuery`. The application submit's rules live
in [lib/apply/submit.ts](../lib/apply/submit.ts), with its database and private file store passed in, so
[submit.test.ts](../lib/apply/submit.test.ts) tests them with fakes; the other mutations have no
automated tests.

## Why it is not obvious

- A plain `getDb().update(...)` still fires the audit trigger, but with no `request.jwt.claim.sub`
  set, the trigger (as redefined in migration 0003) falls back to `better_auth.uid()` and else
  writes `changed_by = NULL`, so the log can lose
  the person. `set_config(..., true)` is transaction-local, and the `neon-http` driver runs
  `db.batch` as one transaction, which is why the setup and the write must share one batch.
- Without the `updateTag` call, the `"use cache"` snapshots keep serving the old rows for their
  `cacheLife` (weeks for positions).

## Known inconsistencies (not the pattern)

- **No access check in the mutations.** None of the three actions checks the session or the
  caller's scope. Reads compute `canEdit` from `ScopeInfo` (see [scope-access.md](./scope-access.md)),
  but a `"use server"` export is a public endpoint, and these accept any `id`. A new mutation should
  check scope on the server; do not copy this gap.
- **No server-side validation.** Input is validated only in the client forms
  ([client-form-submit.md](./client-form-submit.md)). The actions trust the payload.
- **Anonymous writes skip the batch.** When `getCurrentUserId()` returns `null`, `runAuditQuery`
  runs the query alone, with no error.
