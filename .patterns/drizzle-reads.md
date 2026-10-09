# Drizzle reads

How server code reads Postgres today: a `server-only` module in `app/actions/` opens a Drizzle
client with `getDb()`, selects into a flat snake_case row, and maps it to a shared type before a
Server Component renders it.

## The shape

1. **Open the client per call.** `getDb()` in [db/client.ts](../db/client.ts) builds a fresh
   `neon-http` Drizzle client from `DATABASE_URL` and throws if it is unset. Every read helper calls
   it inside the function, never at module scope:

   ```ts
   async function getMemberIdByUserId(userId: string): Promise<number | null> {
     const db = getDb();
     const [userData] = await db
       .select({ member: users.member })
       .from(users)
       .where(eq(users.id, userId))
       .limit(1);
     return userData?.member ?? null;
   }
   ```
   ([app/actions/get-memberId.ts](../app/actions/get-memberId.ts))

2. **Mark the module `server-only`.** Every file in `app/actions/` that touches the database starts
   with `import "server-only";`.

3. **Select into snake_case keys.** The query names each output column, so the row already has the
   shape the UI types expect (`div_name`, `dept_id`, `user_email`). The selection object is often a
   function so it can be reused:

   ```ts
   function basePositionSelection() {
     return {
       id: applyPositions.id,
       division_id: applyPositions.divisionId,
       div_name: divisions.name,
       dept_id: departments.id,
       // ...
     };
   }
   ```
   ([app/actions/get-apply-positions.ts](../app/actions/get-apply-positions.ts))

4. **Map to a shared type.** A small `to<Type>()` function turns nulls into the defaults the type
   wants (`div_code ?? ""`). The shared types live in [db/types.ts](../db/types.ts), built from
   `InferSelectModel`, and are re-exported by [app/actions/types.ts](../app/actions/types.ts).
   Examples: `toApplyPosition`, `toScopeRow`, `normalizeDivision`, `toMemberRole`.

5. **Hide closed org units in the query.** Reads that join `divisions` and `departments` filter
   `isNull(divisions.closedAt)` and `isNull(departments.closedAt)`. Positions also filter
   `eq(applyPositions.isDeleted, false)` (soft delete).

6. **Cache wide, slow-changing reads, then filter in memory.** A `"use cache"` function tags and
   holds a full snapshot; the caller filters it by the viewer's scope after the cache hit:

   ```ts
   async function getAllPositionSnapshotCached(): Promise<PositionSnapshotRow[]> {
     "use cache";
     cacheTag(POSITIONS_CACHE_TAG);
     cacheLife("weeks");
     return queryAllPositionSnapshot();
   }
   ```
   Call sites: `getAllPositionSnapshotCached` and `getPublicSnapshotCached` (the positions
   plus the recruitment switch, filtered by `isPublic` from
   [lib/apply/positions.ts](../lib/apply/positions.ts) after the cache hit) in
   [get-apply-positions.ts](../app/actions/get-apply-positions.ts), and
   `getDivisionStructureSnapshotCached` (tag `org-structure`) in
   [get-member-scopes.ts](../app/actions/get-member-scopes.ts). The cached function never reads the
   session; the per-viewer filter runs outside it. The tag constants are exported so writers can
   invalidate them (see [audited-mutations.md](./audited-mutations.md)).

7. **Render through Suspense.** A page wraps an async component that awaits the read in
   `<Suspense>` ([dashboard/positions/page.tsx](../app/dashboard/positions/page.tsx),
   [dashboard/applications/page.tsx](../app/dashboard/applications/page.tsx)).

## When this applies

Any server-side read of app tables. Representative sources: everything in `app/actions/`, and the
file route [docs/applications/[r2key]/[filename]/route.ts](../app/(legacy)/docs/applications/[r2key]/[filename]/route.ts).
Better Auth's own tables are read by Better Auth, not by these helpers. Writes follow
[audited-mutations.md](./audited-mutations.md). There are no automated tests for these reads yet.

## Why it is not obvious

- Reading the session inside a `"use cache"` function would store one viewer's result under a
  shared tag. Snapshot-then-filter keeps the cache shared and the scope filter per request.
- ADR [0003](../.decisions/0003-neon-direct-pooled.md) requires full-directory reads to be cached
  with tag invalidation from the mutations that change them.

## Known inconsistencies (not the pattern)

- **`"use server"` on read modules.** [get-applications.ts](../app/actions/get-applications.ts) and
  [get-user-scope.ts](../app/actions/get-user-scope.ts) carry `"use server"`, which also exposes
  their exports as callable Server Action endpoints. The other read modules use only
  `"server-only"`. A read helper does not need `"use server"`.
- **Member directory is not cached.** ADR 0003 names the member directory as the read to cache
  (and names `unstable_cache` + `revalidateTag`). [get-members.ts](../app/actions/get-members.ts)
  queries every member row on each call with no cache, and the code that does cache uses
  `"use cache"` + `updateTag` instead. [members-list.tsx](../components/members-list.tsx) imports
  it into a client component, with the call commented out.
- **Schema-error fallback.** [get-applications.ts](../app/actions/get-applications.ts) catches
  errors that mention `application_files` columns and re-runs the query without them. It guards
  against those columns being missing; migration `0005`, which adds them, is not in the Drizzle
  journal (see [schema-migrations.md](./schema-migrations.md)). Do not copy it into new reads.
- **Missing-table fallback for the recruitment switch.** `queryRecruitment` in
  [get-apply-positions.ts](../app/actions/get-apply-positions.ts) catches Postgres error `42P01`
  (undefined table) and returns the default, recruitment on. Every other error still throws. It
  exists because no deploy runs migrations, so a database can serve the new code before
  `0005_recruitment_setting` and `0006_recruitment_setting_row` reach it. Its fallback equals the
  default row `0006` inserts, so the cached answer is the same either way. Remove it once both
  migrations are applied on every database. Like the entry above, do not copy it into new reads.
