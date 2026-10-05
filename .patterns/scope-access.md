# Auth and scope checks

How the app decides who is signed in and what they may see: Better Auth owns sign-in and the
session cookie; server code reads the user id from that cookie, then turns the member's rows in
`scopes` into a `ScopeInfo` for one target (`"positions"`, `"applications"`, ...) and filters by it.

## The shape

1. **Better Auth is built in one place.** `getAuth()` in [lib/auth.ts](../lib/auth.ts) configures
   email + password (with required email verification), Google, a 10-minute session cookie cache
   and a `customSession` plugin. The catch-all route
   [app/api/auth/[...all]/route.ts](../app/api/auth/[...all]/route.ts) serves it. Client code uses
   `authClient`, `signIn`, `signUp` and `useSession` from [lib/auth-client.ts](../lib/auth-client.ts);
   it never calls `/api/auth` by hand.

2. **The edge gate only checks that a cookie exists.** [proxy.ts](../proxy.ts) sends a request for
   `/dashboard/*` or `/apply/<slug>` to `/login?cb=<path>` when `getSessionCookie` finds nothing,
   and sends a signed-in user away from `/login` and `/sign-up`. It does not validate the session or
   check any role.

3. **Server code gets the user id from `getCurrentUserId()`.**
   [lib/current-user.ts](../lib/current-user.ts) reads Better Auth's signed cookie cache with
   `getCookieCache` and returns the user id or `null`. `getCurrentMemberId()` in
   [app/actions/get-memberId.ts](../app/actions/get-memberId.ts) maps it to `users.member`.

4. **Access is a `ScopeInfo` for one target.**
   [app/actions/get-member-scopes.ts](../app/actions/get-member-scopes.ts) reads the member's
   `scopes` rows, keeps those whose `target` is the asked target or `"all"`, and folds them into:

   ```ts
   export type ScopeInfo = {
     hasAdminAccess: boolean;  hasOrgAccess: boolean;
     hasAdminEdit: boolean;    hasOrgEdit: boolean;
     departmentIds: Set<number>;          divisionIds: Set<number>;
     editableDepartmentIds: Set<number>;  editableDivisionIds: Set<number>;
   };
   ```

   `access_level: "edit"` adds to the `edit` flags and sets as well. No signed-in user, no member,
   or no matching scope gives the empty `ScopeInfo`.

5. **Consumers bail early, then widen or filter.** Each consumer returns an empty result on
   `isEmptyScopeInfo`, shows everything for admin/org, and otherwise filters by department or
   division id:

   ```ts
   const scopeInfo = await getScopeInfoForCurrentUser("applications");
   if (isEmptyScopeInfo(scopeInfo)) {
     return { applications: [] };
   }
   ```
   ([app/actions/get-applications.ts](../app/actions/get-applications.ts))

   Call sites: `getApplicationsByMemberScope`, `getPositionsByMemberScope` and
   `getPositionsPageData` (which also sets a per-row `canEdit`) in
   [get-apply-positions.ts](../app/actions/get-apply-positions.ts), and the file route
   [docs/applications/[r2key]/[filename]/route.ts](../app/(legacy)/docs/applications/[r2key]/[filename]/route.ts),
   which returns 401 with no user, lets applicants read their own files, and otherwise checks
   `ScopeInfo`, returning 403 when access fails.

## When this applies

Any server read or route that shows member-only data. Pass the target that matches the
`target_type` enum in [db/schema/public.ts](../db/schema/public.ts). Writes need the same check, but
do not have it yet (see [audited-mutations.md](./audited-mutations.md)). There are no automated tests
for the scope logic yet.

## Why it is not obvious

- The proxy cookie check is not an access check. A page or action that trusts "the proxy let them
  in" serves any signed-in user, applicants included.
- Scope rows are per target. Checking a member's role title, or one scope row without the target
  filter, grants access across targets.

## Known inconsistencies (not the pattern)

- **Two access models.** [get-members.ts](../app/actions/get-members.ts) decides visibility from
  `roles.type` (`president`, `head`, `lead`), not from `scopes`. Everything else uses `ScopeInfo`.
- **Unused rank table.** [lib/permission.config.ts](../lib/permission.config.ts) defines
  `SCOPE_RANK` and `TARGET_MIN_REQUIREMENTS`, but nothing imports them.
- **Two entry points to the same check.** Callers use `getScopeInfoForCurrentUser(target)` (one
  join on `users.id`) or `getCurrentMemberId()` + `getScopeInfoForMember(memberId, target)` (two
  queries). The file route goes a third way, through `getUserScope` in
  [get-user-scope.ts](../app/actions/get-user-scope.ts), and narrows a union with a cast.
- **Cookie cache only.** `getCurrentUserId()` reads only the cookie cache (`maxAge` 10 minutes in
  `lib/auth.ts`). It does not fall back to Better Auth's `getSession`, so it never checks the
  session row in the database.
- **Unguarded mutations.** The position actions run with no session or scope check.
