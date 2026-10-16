---
id: 0015
title: "Each preview reads its own database branch, created from an empty schema and filled with the dummy seed; dummy arrays stay only where no database is configured"
status: accepted
date: 2026-10-16
tags: [previews, seed, dummy-data, database]
---

# 0015 — Each preview reads its own database branch, created from an empty schema and filled with the dummy seed; dummy arrays stay only where no database is configured

**What this decides:** A Vercel preview gets its own database branch. That branch starts from an empty schema, never from production data, and is migrated and then filled with the dummy seed. Previews read that branch. The typed arrays in `lib/dummy-data/` stay only for runs with no database configured. The seed itself refuses any target that is not a local database or a preview branch it can prove is not production. This supersedes [ADR 0009](0009-previews-and-dev-use-dummy-data.md).

## Context

Decided 2026-10-16 by the project owner (Owner decision), recorded in the amendment on epic [#260](https://github.com/PoliTo-Rocket-Team/website-v2/issues/260) and settled in its grilling session, https://github.com/PoliTo-Rocket-Team/website-v2/issues/260#issuecomment-6214257540. ADR 0009 kept previews off any database, so new dashboard and content features could only be tested where someone hand-wrote dummy arrays; edge cases such as a closed division or every order status went untested through the database. The Neon integration for Vercel already creates one branch per preview deployment, which previews ignored.

## Decision

**Each preview reads its own seeded database branch; the dummy arrays stay only where no database is configured.**

1. **One branch per preview.** A preview reads its own Neon branch, never the production database or any shared one.
2. **Empty start.** That branch is created from a schema-only parent, then migrated and seeded. It never starts as a copy of production data.
3. **One dummy set.** `pnpm db:seed` loads the same set on a local database and on a preview branch, and running it twice leaves the same rows, including the columns a default or a trigger fills. The seed leaves the audit table `logs` empty: its own writes are not history.
4. **The seed guards its target.** Before any write the seed reads the connection target and refuses unless it is a local database or a Neon branch named `preview/…` that Neon reports as neither the default branch nor protected. The refusal is decided from the target; no flag turns it into a pass.
5. **Dummy arrays only without a database.** `lib/dummy-data/` serves a page only when no database is configured, such as `next dev` with no `DATABASE_URL`.
6. **The test developer stays.** The preview's test developer sign-in and viewer switch stay, and the viewers resolve to seeded people.
7. **Production unchanged.** Production never shows dummy data, never offers the test developer sign-in, and is never a seed target.
8. **Tester sign-in stays local only.** The seeded tester rows of issue #129 are part of the one dummy set (Decision 3), so they now exist on preview branches too. Signing in as them stays local only: `testerSignInOn` in [lib/dev-tester.ts](../lib/dev-tester.ts) is true only under `next dev` off Vercel.
9. **Previews connect through the project's own Neon account.** The Neon integration for Vercel is used only in the form that links the project's existing Neon account and creates branches in it. That is not the host-resold database [ADR 0003](0003-neon-direct-pooled.md) rules out: the database and its billing stay with the project's own Neon account, the integration is used only to create preview branches and set Preview variables, and the exit path of 0003 (`pg_dump`, one variable) is unchanged. If the only form offered is a database created and billed through Vercel, the owner setup stops.

**What happens to ADR 0009's rules.**
- Decision 1 ("no database on previews") and the binding constraint "never connect a preview to a database" are retired by the Owner decision this record holds: a preview reads its own seeded branch.
- Decision 2 (`next dev` without `DATABASE_URL` reads dummy data) stands as Decision 5 here.
- Decision 3 (the test developer sign-in and viewer switch) stands as Decision 6 here.
- Decision 4 ("seeded testers are local only") is restated as Decision 8: the rows reach preview branches with the dummy set, and the sign-in stays local only.
- Decision 5 (never in production) and the constraint that every dummy or test developer gate is false in production stand as Decision 7 and the binding constraints below.
- The constraint "a test developer's changes never reach a database" stands unchanged. A preview now has a database, and the test developer may still not write to it.

**Binding constraints.**
- Never seed or migrate production or a shared database, and never let a preview branch start from production data.
- Every gate that turns dummy data, the test developer or tester sign-in on is false in production.
- A test developer's changes never reach a database, a preview's own branch included.
- No database created or billed through the host ([ADR 0003](0003-neon-direct-pooled.md)); the Neon integration only links the project's own Neon account.
- No agent runs a seed or a migration against any real database.
- Connecting previews to their branches (the database integration and preview environment variables) is an owner action; a build documents it and does not change the settings.

## Consequences

- Reviewers test features through a real database on every preview, with the same data each time.
- Every new area adds a seed module and its cases to [docs/seed-cases.md](../docs/seed-cases.md).
- A preview deploy depends on the owner's one-time setup; until it is done, previews stay on the dummy arrays.

## Gaps

- `dummyDataOn` in [lib/dummy-data/mode.ts](../lib/dummy-data/mode.ts) still returns true on every preview, and preview builds do not yet migrate or seed. The switch is a later slice of epic #260.
- The owner's preview connection (schema-only parent branch, preview variables) is not done yet; the steps are in [docs/seed-cases.md](../docs/seed-cases.md#connect-previews-to-their-own-database-branch).
- The test developer's viewers do not yet resolve to seeded people.
- Whether a test developer may ever write to its own preview branch is not decided here; until an Owner decision says so, it may not.

Followed today: the guard is `guardSeedTarget` in [lib/seed/target.ts](../lib/seed/target.ts); the runner is [lib/seed/runner.ts](../lib/seed/runner.ts), with its modules registered in [db/seed/registry.ts](../db/seed/registry.ts). The same-rows rule is checked by [lib/seed/baseline.test.ts](../lib/seed/baseline.test.ts), which fails when a seeded insert leaves a clock default unset or a migration adds a trigger the seed does not handle.

## Records

Pattern: [.patterns/schema-migrations.md](../.patterns/schema-migrations.md) (how `pnpm db:seed` runs).
