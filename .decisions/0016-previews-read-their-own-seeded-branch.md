---
id: 0016
title: "Previews read a database branch created from an empty schema and filled with the dummy seed; dummy arrays stay only where no database is configured"
status: amended-in-part by [0018](0018-v2-hosting-and-launch.md)
date: 2026-10-16
tags: [previews, seed, dummy-data, database]
---

# 0016 — Previews read a database branch created from an empty schema and filled with the dummy seed; dummy arrays stay only where no database is configured

**What this decides:** Vercel previews read one Neon database branch named `preview`, which every preview deployment shares. That branch started from an empty schema, never from production data, and the preview build migrates it and then fills it with the dummy seed. Previews read that branch. The typed arrays in `lib/dummy-data/` stay only for runs with no database configured. The seed itself refuses any target that is not a local database or a preview branch it can prove is not production. This supersedes [ADR 0009](0009-previews-and-dev-use-dummy-data.md).

## Context

Decided 2026-10-16 by the project owner (Owner decision), recorded in the amendment on epic [#260](https://github.com/PoliTo-Rocket-Team/website-v2/issues/260) and settled in its grilling session, https://github.com/PoliTo-Rocket-Team/website-v2/issues/260#issuecomment-6214257540. ADR 0009 kept previews off any database, so new dashboard and content features could only be tested where someone hand-wrote dummy arrays; edge cases such as a closed division or every order status went untested through the database. The Neon integration for Vercel already creates one branch per preview deployment, which previews ignored.

## Decision

**Previews read a seeded database branch that started from an empty schema; the dummy arrays stay only where no database is configured.**

1. **One branch for previews.** Every preview deployment reads the one Neon branch named `preview`, in the project's own Neon account. Only previews use it; a preview never reads the production database.
2. **Empty start.** That branch was created from `main` with the schema only and no rows. Each preview build migrates it and re-seeds it, so it never holds production data.
3. **One dummy set.** `pnpm db:seed` loads the same set on a local database and on a preview branch, and running it twice leaves the same rows, including the columns a default or a trigger fills. The seed leaves the audit table `logs` empty: its own writes are not history.
4. **The seed guards its target.** Before any write the seed reads the connection target and refuses unless it is a local database, or the shared branch named `preview`, known by its compute endpoint `ep-floral-mouse-b2er5ebz` in the connection host (direct or `-pooler`), on a Vercel preview build (`VERCEL_ENV` is `preview`). Every other Neon endpoint is refused. The refusal is decided from the target; no flag turns it into a pass. The endpoint allow-list replaced a Neon API read; the last amendment below records why.
5. **Dummy arrays only without a database.** `lib/dummy-data/` serves a page only when no database is configured, such as `next dev` with no `DATABASE_URL`.
6. **The test developer stays.** The preview's test developer sign-in and viewer switch stay, and the viewers resolve to seeded people. On a preview, the test developer's changes are saved to the `preview` branch as that seeded person (the amendment of 2026-10-17).
7. **Production unchanged.** Production never shows dummy data, never offers the test developer sign-in, and is never a seed target.
8. **Tester sign-in stays local only.** The seeded tester rows of issue #129 are part of the one dummy set (Decision 3), so they now exist on preview branches too. Signing in as them stays local only: `testerSignInOn` in [lib/dev-tester.ts](../lib/dev-tester.ts) is true only under `next dev` off Vercel.
9. **Previews connect through the project's own Neon account.** The Neon integration for Vercel is used only in the form that links the project's existing Neon account and creates branches in it. That is not the host-resold database [ADR 0003](0003-neon-direct-pooled.md) rules out: the database and its billing stay with the project's own Neon account, the integration connects only Production and Development and creates no preview branches, and the exit path of 0003 (`pg_dump`, one variable) is unchanged. If the only form offered is a database created and billed through Vercel, the owner setup stops. *(Replaced by [ADR 0018](0018-v2-hosting-and-launch.md): the database is the Neon project the Vercel integration made; Production reads its `main` branch and Development its `development` branch.)*

**What happens to ADR 0009's rules.**
- Decision 1 ("no database on previews") and the binding constraint "never connect a preview to a database" are retired by the Owner decision this record holds: previews read the seeded `preview` branch.
- Decision 2 (`next dev` without `DATABASE_URL` reads dummy data) stands as Decision 5 here.
- Decision 3 (the test developer sign-in and viewer switch) stands as Decision 6 here.
- Decision 4 ("seeded testers are local only") is restated as Decision 8: the rows reach preview branches with the dummy set, and the sign-in stays local only.
- Decision 5 (never in production) and the constraint that every dummy or test developer gate is false in production stand as Decision 7 and the binding constraints below.
- The constraint "a test developer's changes never reach a database" is narrowed by the amendment of 2026-10-17: on a preview they reach the `preview` branch, and they reach no other database.

**What happens to ADR 0015.** [ADR 0015](0015-team-page-reads-roles.md) Decision 5 said previews and dummy mode read the dummy team, never a database. With Decision 5 here, a preview with a database builds the Team page from the seeded `preview` branch, and the dummy team serves it only where no database is configured. 0015 is amended in part to say so; its other decisions stand.

**Binding constraints.**
- Never seed or migrate production or any database other than a local one or the `preview` branch, and never let the `preview` branch hold production data.
- Every gate that turns dummy data, the test developer or tester sign-in on is false in production.
- A test developer's changes never reach a database other than the `preview` branch, and reach it only from a preview deployment (the amendment of 2026-10-17).
- No database created or billed through the host ([ADR 0003](0003-neon-direct-pooled.md)); the Neon integration only links the project's own Neon account. *(Replaced by [ADR 0018](0018-v2-hosting-and-launch.md).)*
- No agent runs a seed or a migration against any real database.
- Connecting previews to the `preview` branch (the database integration, the branch and the Preview environment variables) is an owner action; a build documents it and does not change the settings.

## Consequences

- Reviewers test features through a real database on every preview, with the same data each time.
- Previews share one branch, so each preview build resets the rows every other preview reads; since the seed is the same set each time, they read the same data.
- Every new area adds a seed module and its cases to [docs/seed-cases.md](../docs/seed-cases.md).
- A preview deploy depends on the owner's one-time setup. A preview with no `DATABASE_URL` stays on the dummy arrays. A preview with a `DATABASE_URL` but no `DATABASE_URL_UNPOOLED`, or whose strings name any endpoint but the `preview` branch's, fails its build; it never falls back to the dummy arrays.

## Gaps

- The owner's preview connection is done (2026-10-16); the setup is in [docs/seed-cases.md](../docs/seed-cases.md#connect-previews-to-the-preview-database-branch). The guard needs no variable beyond the two connection strings.
- If the `preview` branch is ever recreated, its compute endpoint changes, and every preview build with a database fails at the guard until the one constant `PREVIEW_ENDPOINT` in [lib/seed/target.ts](../lib/seed/target.ts) names the new endpoint.

Followed today: the guard is `guardSeedTarget` in [lib/seed/target.ts](../lib/seed/target.ts); the runner is [lib/seed/runner.ts](../lib/seed/runner.ts), with its modules registered in [db/seed/registry.ts](../db/seed/registry.ts). The same-rows rule is checked by [lib/seed/modules.test.ts](../lib/seed/modules.test.ts), which fails when a seeded insert leaves a clock default unset, and by [lib/seed/baseline.test.ts](../lib/seed/baseline.test.ts), which fails when a migration adds a trigger the seed does not handle. The preview build step is [db/preview-build.ts](../db/preview-build.ts), with its rules in [lib/seed/preview-build.ts](../lib/seed/preview-build.ts); the switch is `dummyDataOn` in [lib/dummy-data/mode.ts](../lib/dummy-data/mode.ts); the test developer's seeded people are [lib/test-viewer-people.ts](../lib/test-viewer-people.ts).

## Amendment, 2026-10-16

The first text of this record gave each preview its own branch, created by the Neon integration for Vercel from a schema-only parent. The integration cannot choose a parent branch for previews, so the owner set previews up differently (Owner decision, recorded on [#306](https://github.com/PoliTo-Rocket-Team/website-v2/issues/306)): preview branching is off on the integration, which connects Production and Development only *(the shared Production and Development connection is replaced by [ADR 0018](0018-v2-hosting-and-launch.md): Development reads its own `development` branch)*; one schema-only branch named `preview` serves every preview through Preview-only `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Decisions 1, 2 and 9, the title and the binding constraints above state that shape. The aims are unchanged: previews read a real, seeded database, and never production data.

## Amendment, 2026-10-16: one shared branch, migrated and re-seeded by every preview build

Every preview deployment reads the same `preview` branch (Owner decision, recorded on [#307](https://github.com/PoliTo-Rocket-Team/website-v2/issues/307)), so the build step that fills it works as follows, and Decisions 4 to 6 read with it:

- **Every preview build migrates and re-seeds the one shared database.** `pnpm build` runs [db/preview-build.ts](../db/preview-build.ts) before `next build`. Only on a Vercel preview build that was given a `DATABASE_URL` does it act: it checks the target with the guard, then migrates it and resets and re-seeds it. Production and development builds, a local build and a preview with no database never touch a database there. A refusal or a failure fails the preview build, because its pages read that database.
- **The guard accepts the branch named `preview` only on a preview build.** Decision 4's rule stands for every other target: a branch named `preview/…` that Neon reports as neither default nor protected, or a local database. The shared branch named `preview` passes only when `VERCEL_ENV` is `preview`, so `pnpm db:seed` from a laptop refuses it. Production, the default branch and a protected branch are refused on every build.
- **One build at a time.** The step holds a Postgres advisory lock on the direct connection (`DATABASE_URL_UNPOOLED`) across the migration and the seed, so concurrent preview builds take turns. The seed itself is one transaction, so even a build that ran beside another could not leave the branch half-seeded.
- **The build step runs on the direct connection only.** The lock, the migration and the seed all use `DATABASE_URL_UNPOOLED`. The lock is a session lock, and through Neon's pooler the lock and the unlock can land on different server connections, so it could stay held and stall every later build. A preview build with a `DATABASE_URL` but no `DATABASE_URL_UNPOOLED` therefore refuses and fails; it never locks or seeds through the pooled string. This is a bounded exception to [ADR 0003](0003-neon-direct-pooled.md)'s constraint that direct is reserved for migrations only: it covers the lock and the seed of this one build step, which runs once per preview build on a single connection, and nothing else. Pages and every other runtime read stay on the pooled `DATABASE_URL`, so the rest of 0003 holds.
- **A preview's changes last only until the next preview build.** Any preview build resets the rows every preview reads. Since the seed is the same set each time, every preview reads the same data after it.
- **A pull request's migration reaches the shared branch.** A preview build applies the migrations its own branch carries, so the shared branch takes them before the pull request merges, and every other preview then reads a schema one migration ahead of its code. A migration that other previews' code cannot run against shows up there first.
- **The test developer is read as a seeded person.** Where the pages read a database, `dummyDataOn` is false and each viewer of the test developer's "View as" switch is read as its seeded person ([lib/test-viewer-people.ts](../lib/test-viewer-people.ts)). This amendment first said that person may not write; the amendment of 2026-10-17 below allows it on a preview.

## Amendment, 2026-10-16: the guard allow-lists the `preview` branch's endpoint

The guard no longer reads the Neon API (Owner decision, recorded on [#311](https://github.com/PoliTo-Rocket-Team/website-v2/issues/311)): the project will not hold a Neon API key, so the `NEON_API_KEY` and `NEON_PROJECT_ID` the guard needed are gone, and nothing reads them. Decision 4 and the amendment above read with it as follows:

- **One Neon endpoint passes.** A Neon target passes only when its connection host names the `preview` branch's compute endpoint, `ep-floral-mouse-b2er5ebz`, by the direct host or the `-pooler` host, and only on a Vercel preview build. Every other Neon endpoint is refused on every build. A local database passes as before.
- **Production is refused by its endpoint.** Production's branch has a different compute endpoint, so a production connection string never matches the allow-list. A Vercel production build is refused whatever the target, as before.
- **Branches named `preview/…` no longer pass.** The integration creates no per-preview branches (the first amendment), so the rule that let such a branch through went with the API read.
- **The endpoint id lives in the code.** It is not a secret. It is the one constant `PREVIEW_ENDPOINT` in [lib/seed/target.ts](../lib/seed/target.ts); if the `preview` branch is ever recreated, that constant changes in the same change that records the new branch.

## Amendment, 2026-10-17: the test developer saves on previews

The test developer may save on previews (Owner decision, recorded on [#260](https://github.com/PoliTo-Rocket-Team/website-v2/issues/260#issuecomment-6237083536)). Until now every test developer write was refused, so a reviewer could not check any save, publish or reset through the database a preview reads; "Reset to team" on the Team page editor failed there with a server error. Decision 6, the mapping of ADR 0009's rules and the binding constraints above read with it as follows:

- **On a preview, a test developer's write is saved.** It goes to the shared `preview` branch, and the audit log records it as the seeded person the viewer switch resolves to ([lib/test-viewer-people.ts](../lib/test-viewer-people.ts)). The next preview build wipes and re-seeds the branch, as for any other change made on a preview.
- **Everywhere else it is refused before it is sent.** Production never offers the test developer sign-in (Decision 7), and the write guard refuses there too. Under `next dev` with a `DATABASE_URL`, and on any other Vercel environment, the write is refused, because that database may be a real one.
- **One place decides.** Every signed-in write goes through [lib/db-audit.ts](../lib/db-audit.ts), which asks `auditWriterOf` in [lib/test-developer.ts](../lib/test-developer.ts); that allows a test developer's write only where `testDeveloperMayWrite` is true, which is when `VERCEL_ENV` is `preview` and `DATABASE_URL` names the `preview` branch (below).
- **The write gate and the seed guard share one check** ([#364](https://github.com/PoliTo-Rocket-Team/website-v2/issues/364)). `isPreviewDatabase` in [lib/seed/target.ts](../lib/seed/target.ts) reads a connection string's host alone and is true only for the `PREVIEW_ENDPOINT` endpoint, by its direct or its `-pooler` host. The seed guard asks it before it lets a Neon target through, and `testDeveloperMayWrite` asks it of `DATABASE_URL`, the variable the database client connects with. So a preview whose `DATABASE_URL` names any other database refuses a test developer's write, and the Preview environment variables are no longer the only thing keeping those writes off production data.
- **The Gap is closed.** The first text left open whether a test developer may ever write to the `preview` branch; this amendment decides it, so that Gap is gone.

## Amendment, 2026-10-21

Preview builds no longer reset and re-seed the shared `preview` branch (Owner decision, recorded on [#465](https://github.com/PoliTo-Rocket-Team/website-v2/issues/465)). A reset on every build erased what a reviewer saved on a preview before anyone could check it, which defeated the amendment of 2026-10-17. The build step works as follows:

- **Migrate always, under the lock.** Every approved preview build migrates the branch while it holds the advisory lock on the direct connection, as before.
- **Seed only an empty branch.** Under the same lock, after the migration, the step reads whether the branch holds any seeded rows. It seeds only when the branch is empty. A branch that already holds data is migrated and left as it was.
- **Never reset.** No preview build runs the seed's reset on the shared branch. `pnpm db:seed` on a local database keeps its reset-then-insert behaviour.
- **Preview changes persist across preview builds.** Rows made on a preview, by a test developer or anyone else, stay until someone removes them.
- **Seed changes reach the branch only when it is empty.** A seed module or seed row merged later does not appear on an existing `preview` branch by itself. Re-seeding the branch is a deliberate owner step, never part of a build.

This amendment overrides these earlier lines, which stay as written:

- the 2026-10-16 amendment's "A preview's changes last only until the next preview build", and its "migrates it and resets and re-seeds it";
- the 2026-10-17 amendment's "The next preview build wipes and re-seeds the branch";
- Decision 2's "re-seeds it";
- the Consequences line "each preview build resets the rows every other preview reads".

## Amendment, 2026-10-24: agents write to `preview` for checks, and the owner asks for a re-seed

Production now runs on its own branch ([ADR 0018](0018-v2-hosting-and-launch.md)), so the shared `preview` branch is a test database again (Owner decisions of 2026-10-22, https://github.com/PoliTo-Rocket-Team/website-v2/issues/595#issuecomment-6344596809, and of 2026-10-24, https://github.com/PoliTo-Rocket-Team/website-v2/issues/595#issuecomment-6383217140). Treating it like production left reviews unable to reach the states they grade, and lanes spent migrations undoing harmless test writes. The rules are now:

- **Agents may write to `preview` for checks.** An agent may set up and check a state on the `preview` branch through a preview deployment, for example by giving a seeded member a grant on the Access page. A test write needs no revert migration; the next re-seed clears it.
- **`preview` is re-seeded on demand, never on every build.** An ordinary preview build migrates the branch and leaves its rows in place, as the amendment of 2026-10-21 says. Only a re-seed the owner asked for empties it and loads the dummy set again.
- **The mechanism: a one-off request on the Preview environment.** The owner sets the Vercel Preview variable `PREVIEW_RESEED_REQUEST` to a new value (for example `2026-10-25`) and redeploys a preview. That build checks its target with the seed guard, takes the advisory lock, migrates, and then, when the branch's `preview_reseeds` table does not hold that value yet, empties every table of the `public` and `better_auth` schemas but `preview_reseeds`, loads the dummy set, and records the value, all in one transaction ([lib/seed/reseed.ts](../lib/seed/reseed.ts)). Every later build that carries the same value finds it recorded and leaves the rows in place, so one value re-seeds once; a new value asks for the next re-seed. The re-seed passes only a target the guard approves that is the `preview` branch's endpoint; production, every other endpoint and a local database are refused. Nobody holds a database credential for it: the build reads the Preview connection strings Vercel gives it.
- **Production is never written to or seeded by agents.** No agent writes to, seeds or migrates the `main` branch, by hand or through a check.
- **Never a Neon "reset from parent" on `preview`.** The `preview` branch's parent is production, so a reset from parent would copy production rows into it. The re-seed calls no Neon API and no branch operation; it empties tables with SQL on the branch itself.
- **Agents do not run the re-seed.** Setting `PREVIEW_RESEED_REQUEST` and redeploying are owner actions. Agents do not read env files, change Vercel environment variables or run the seed against a real database.
- **The seed guard is unchanged.** The endpoint allow-list, the refusal on `VERCEL_ENV=production` and the rule that the `preview` branch passes only on a Vercel preview build all stand; `pnpm db:seed` from a laptop still runs on a local database only.
- **Plain test seats.** After a re-seed, the seven seats a check views as (the team leader, the operations lead, a department head, a division lead, a member, an alumnus and an applicant) hold only what their roles give and no `scopes` row ([docs/seed-cases.md](../docs/seed-cases.md#test-seats)).

This amendment overrides these earlier lines, which stay as written:

- the binding constraint "No agent runs a seed or a migration against any real database", restated: no agent runs a seed or a migration itself against a real database; the preview build migrates and seeds the `preview` branch, and agents may write to it through a preview deployment for checks;
- the 2026-10-21 amendment's "Re-seeding the branch is a deliberate owner step, never part of a build", restated: re-seeding the branch is an owner request through `PREVIEW_RESEED_REQUEST`, performed once by the next preview build; an ordinary build never re-seeds;
- the 2026-10-21 amendment's "Never reset. No preview build runs the seed's reset on the shared branch", narrowed: no preview build resets the branch unless it carries a re-seed request the branch has not served;
- the 2026-10-21 amendment's "Rows made on a preview, by a test developer or anyone else, stay until someone removes them", extended: or until the next requested re-seed.

## Amendment, 2026-10-24: tester sign-in on previews of the `preview` branch

Checks sign in without Google as a seeded seat or a seeded admin tester and get a real session, on previews as well as under `next dev`, so they run the real code against a real database (Owner decisions on epic [#597](https://github.com/PoliTo-Rocket-Team/website-v2/issues/597), https://github.com/PoliTo-Rocket-Team/website-v2/issues/597#issuecomment-6383054423, built by [#608](https://github.com/PoliTo-Rocket-Team/website-v2/issues/608)). Decision 8 reads with it as follows:

- **Where it is on.** `testerSignInOn` in [lib/dev-tester.ts](../lib/dev-tester.ts) is true under `next dev` with no `VERCEL_ENV`, and on a Vercel preview (`VERCEL_ENV` is `preview`) whose `DATABASE_URL` names the `preview` branch, read by `isPreviewDatabase` in [lib/seed/target.ts](../lib/seed/target.ts), the same check the seed guard and the test developer's write gate ask.
- **Where it is off.** On production, on every other Vercel environment and on a preview whose `DATABASE_URL` names any other database or none, the tester plugin is not registered and its routes answer 404. Decision 7 and the binding constraint that every tester sign-in gate is false in production stand.
- **Who it signs in as.** Any seat or admin tester of [lib/seeded-accounts.ts](../lib/seeded-accounts.ts) ([#607](https://github.com/PoliTo-Rocket-Team/website-v2/issues/607)). The session is a real Better Auth session; signing out deletes it.

This amendment overrides Decision 8's "Signing in as them stays local only", which stays as written, and the line of ADR 0009's mapping above that restates it.

## Amendment, 2026-10-24: every page reads a database under `next dev` and on previews

The Owner decision of 2026-10-24 on epic [#597](https://github.com/PoliTo-Rocket-Team/website-v2/issues/597) replaces the fake-data path with real sessions on a real database, so a check never reads a second copy of the dashboard's rules. Issue [#609](https://github.com/PoliTo-Rocket-Team/website-v2/issues/609) is the step that stops pages from reading the arrays:

- **No dummy fallback.** No page, route or loader reads `lib/dummy-data/`. Under `next dev` the pages read the Neon `development` branch; on a preview they read the shared `preview` branch.
- **A run with no database stops.** Under `next dev` or on a preview with no `DATABASE_URL`, the first database read stops with a message naming the database the run needs ([lib/database-required.ts](../lib/database-required.ts), asked by `isDatabaseConfigured` and `getDb` in [db/client.ts](../db/client.ts)).
- **Production unchanged.** Production, and a local production build, may still run with no database, and the pages that render without one still do.
- **The arrays stay for tests** until a later child of #597 removes `lib/dummy-data/`.

This amendment retires Decision 5 ("Dummy arrays only without a database"), the Consequences line "A preview with no `DATABASE_URL` stays on the dummy arrays", and the Gaps pointer to `dummyDataOn` in `lib/dummy-data/mode.ts`, which is gone; those lines stay as written.

## Amendment, 2026-10-24: the test developer is retired

The same Owner decision on epic [#597](https://github.com/PoliTo-Rocket-Team/website-v2/issues/597) puts every check on a real session, and the epic's approved plan (https://github.com/PoliTo-Rocket-Team/website-v2/issues/597#issuecomment-6383269347) retires the test developer once the tester sign-in, View as and its banner are in. Issue [#612](https://github.com/PoliTo-Rocket-Team/website-v2/issues/612) is that step:

- **No cookie sign-in.** The test developer sign-in on `/login`, its `/api/test-developer/*` routes, its `prt_test_developer*` cookies and the viewer switch on the user card are gone. `lib/test-developer.ts` and `lib/test-viewer-people.ts` are removed.
- **Only real sessions.** `getCurrentUser` in [lib/current-user.ts](../lib/current-user.ts) answers only a Better Auth session, plain or View as. A check signs in as a seeded tester (the amendment above) and views as a seeded seat with View as.
- **One write rule.** Every write is logged under the session's account, with the acting account beside it in a View as session ([lib/audit-writer.ts](../lib/audit-writer.ts)); there is no separate test developer write gate.

This amendment retires Decision 6 ("The test developer stays"), Decision 7's "never offers the test developer sign-in", the mapping lines for ADR 0009's Decision 3 and its test developer constraint, the binding constraint on a test developer's changes, and the amendment of 2026-10-17; those lines stay as written.

## Records

Pattern: [.patterns/schema-migrations.md](../.patterns/schema-migrations.md) (how `pnpm db:seed` runs).
