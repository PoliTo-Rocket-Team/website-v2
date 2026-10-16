---
id: 0016
title: "Previews read a database branch created from an empty schema and filled with the dummy seed; dummy arrays stay only where no database is configured"
status: accepted
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
4. **The seed guards its target.** Before any write the seed reads the connection target and refuses unless it is a local database, or a Neon branch that Neon reports as neither the default branch nor protected and that is named `preview/…`, or is the shared branch named `preview` on a Vercel preview build (`VERCEL_ENV` is `preview`). The refusal is decided from the target; no flag turns it into a pass.
5. **Dummy arrays only without a database.** `lib/dummy-data/` serves a page only when no database is configured, such as `next dev` with no `DATABASE_URL`.
6. **The test developer stays.** The preview's test developer sign-in and viewer switch stay, and the viewers resolve to seeded people.
7. **Production unchanged.** Production never shows dummy data, never offers the test developer sign-in, and is never a seed target.
8. **Tester sign-in stays local only.** The seeded tester rows of issue #129 are part of the one dummy set (Decision 3), so they now exist on preview branches too. Signing in as them stays local only: `testerSignInOn` in [lib/dev-tester.ts](../lib/dev-tester.ts) is true only under `next dev` off Vercel.
9. **Previews connect through the project's own Neon account.** The Neon integration for Vercel is used only in the form that links the project's existing Neon account and creates branches in it. That is not the host-resold database [ADR 0003](0003-neon-direct-pooled.md) rules out: the database and its billing stay with the project's own Neon account, the integration connects only Production and Development and creates no preview branches, and the exit path of 0003 (`pg_dump`, one variable) is unchanged. If the only form offered is a database created and billed through Vercel, the owner setup stops.

**What happens to ADR 0009's rules.**
- Decision 1 ("no database on previews") and the binding constraint "never connect a preview to a database" are retired by the Owner decision this record holds: previews read the seeded `preview` branch.
- Decision 2 (`next dev` without `DATABASE_URL` reads dummy data) stands as Decision 5 here.
- Decision 3 (the test developer sign-in and viewer switch) stands as Decision 6 here.
- Decision 4 ("seeded testers are local only") is restated as Decision 8: the rows reach preview branches with the dummy set, and the sign-in stays local only.
- Decision 5 (never in production) and the constraint that every dummy or test developer gate is false in production stand as Decision 7 and the binding constraints below.
- The constraint "a test developer's changes never reach a database" stands unchanged. Previews now have a database, and the test developer may still not write to it.

**Binding constraints.**
- Never seed or migrate production or any database other than a local one or the `preview` branch, and never let the `preview` branch hold production data.
- Every gate that turns dummy data, the test developer or tester sign-in on is false in production.
- A test developer's changes never reach a database, the `preview` branch included.
- No database created or billed through the host ([ADR 0003](0003-neon-direct-pooled.md)); the Neon integration only links the project's own Neon account.
- No agent runs a seed or a migration against any real database.
- Connecting previews to the `preview` branch (the database integration, the branch and the Preview environment variables) is an owner action; a build documents it and does not change the settings.

## Consequences

- Reviewers test features through a real database on every preview, with the same data each time.
- Previews share one branch, so each preview build resets the rows every other preview reads; since the seed is the same set each time, they read the same data.
- Every new area adds a seed module and its cases to [docs/seed-cases.md](../docs/seed-cases.md).
- A preview deploy depends on the owner's one-time setup. A preview with no `DATABASE_URL` stays on the dummy arrays. A preview with a `DATABASE_URL` but no `DATABASE_URL_UNPOOLED`, or no `NEON_API_KEY` and `NEON_PROJECT_ID` for the guard, fails its build; it never falls back to the dummy arrays.

## Gaps

- The owner's preview connection is done (2026-10-16); the setup is in [docs/seed-cases.md](../docs/seed-cases.md#connect-previews-to-the-preview-database-branch). The guard needs `NEON_API_KEY` and `NEON_PROJECT_ID` on Preview to read the branch; without them every preview build with a database fails at the guard.
- Whether a test developer may ever write to the `preview` branch is not decided here; until an Owner decision says so, it may not.

Followed today: the guard is `guardSeedTarget` in [lib/seed/target.ts](../lib/seed/target.ts); the runner is [lib/seed/runner.ts](../lib/seed/runner.ts), with its modules registered in [db/seed/registry.ts](../db/seed/registry.ts). The same-rows rule is checked by [lib/seed/modules.test.ts](../lib/seed/modules.test.ts), which fails when a seeded insert leaves a clock default unset, and by [lib/seed/baseline.test.ts](../lib/seed/baseline.test.ts), which fails when a migration adds a trigger the seed does not handle. The preview build step is [db/preview-build.ts](../db/preview-build.ts), with its rules in [lib/seed/preview-build.ts](../lib/seed/preview-build.ts); the switch is `dummyDataOn` in [lib/dummy-data/mode.ts](../lib/dummy-data/mode.ts); the test developer's seeded people are [lib/test-viewer-people.ts](../lib/test-viewer-people.ts).

## Amendment, 2026-10-16

The first text of this record gave each preview its own branch, created by the Neon integration for Vercel from a schema-only parent. The integration cannot choose a parent branch for previews, so the owner set previews up differently (Owner decision, recorded on [#306](https://github.com/PoliTo-Rocket-Team/website-v2/issues/306)): preview branching is off on the integration, which connects Production and Development only; one schema-only branch named `preview` serves every preview through Preview-only `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Decisions 1, 2 and 9, the title and the binding constraints above state that shape. The aims are unchanged: previews read a real, seeded database, and never production data.

## Amendment, 2026-10-16: one shared branch, migrated and re-seeded by every preview build

Every preview deployment reads the same `preview` branch (Owner decision, recorded on [#307](https://github.com/PoliTo-Rocket-Team/website-v2/issues/307)), so the build step that fills it works as follows, and Decisions 4 to 6 read with it:

- **Every preview build migrates and re-seeds the one shared database.** `pnpm build` runs [db/preview-build.ts](../db/preview-build.ts) before `next build`. Only on a Vercel preview build that was given a `DATABASE_URL` does it act: it checks the target with the guard, then migrates it and resets and re-seeds it. Production and development builds, a local build and a preview with no database never touch a database there. A refusal or a failure fails the preview build, because its pages read that database.
- **The guard accepts the branch named `preview` only on a preview build.** Decision 4's rule stands for every other target: a branch named `preview/…` that Neon reports as neither default nor protected, or a local database. The shared branch named `preview` passes only when `VERCEL_ENV` is `preview`, so `pnpm db:seed` from a laptop refuses it. Production, the default branch and a protected branch are refused on every build.
- **One build at a time.** The step holds a Postgres advisory lock on the direct connection (`DATABASE_URL_UNPOOLED`) across the migration and the seed, so concurrent preview builds take turns. The seed itself is one transaction, so even a build that ran beside another could not leave the branch half-seeded.
- **The build step runs on the direct connection only.** The lock, the migration and the seed all use `DATABASE_URL_UNPOOLED`. The lock is a session lock, and through Neon's pooler the lock and the unlock can land on different server connections, so it could stay held and stall every later build. A preview build with a `DATABASE_URL` but no `DATABASE_URL_UNPOOLED` therefore refuses and fails; it never locks or seeds through the pooled string. This is a bounded exception to [ADR 0003](0003-neon-direct-pooled.md)'s constraint that direct is reserved for migrations only: it covers the lock and the seed of this one build step, which runs once per preview build on a single connection, and nothing else. Pages and every other runtime read stay on the pooled `DATABASE_URL`, so the rest of 0003 holds.
- **A preview's changes last only until the next preview build.** Any preview build resets the rows every preview reads. Since the seed is the same set each time, every preview reads the same data after it.
- **A pull request's migration reaches the shared branch.** A preview build applies the migrations its own branch carries, so the shared branch takes them before the pull request merges, and every other preview then reads a schema one migration ahead of its code. A migration that other previews' code cannot run against shows up there first.
- **The test developer is read as a seeded person and may not write.** Where the pages read a database, `dummyDataOn` is false and each viewer of the test developer's "View as" switch is read as its seeded person ([lib/test-viewer-people.ts](../lib/test-viewer-people.ts)). Every signed-in write goes through [lib/db-audit.ts](../lib/db-audit.ts), which refuses a test developer's write before it is sent, so the binding constraint that a test developer's changes never reach a database holds on the `preview` branch.

## Records

Pattern: [.patterns/schema-migrations.md](../.patterns/schema-migrations.md) (how `pnpm db:seed` runs).
