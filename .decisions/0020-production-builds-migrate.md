---
id: 0020
title: "A production build applies the pending migrations to production's database before it builds, and never seeds it"
status: accepted
date: 2026-10-31
tags: [database, migrations, production, build]
---

# 0020 — A production build applies the pending migrations to production's database before it builds, and never seeds it

**What this decides:** On a Vercel production build, `pnpm build` applies every pending migration to production's database before `next build`, under an advisory lock on the direct connection. It does nothing else to that database: no seed, no re-seed, no reset. This works only because migrations are additive, so a migration that drops or rewrites what the live code reads ships in a later release than the code that stops reading it. This amends [ADR 0016](0016-previews-read-their-own-seeded-branch.md) in part.

## Context

Decided 2026-10-31 by the project owner (Owner decision), recorded on [#874](https://github.com/PoliTo-Rocket-Team/website-v2/issues/874): the production build applies pending migrations itself, migrate only, never seed or reset.

Until now only a preview build touched a database at build time (ADR 0016). New migrations reached production only when someone ran `pnpm db:migrate` against it by hand before a release. At go-live on 2026-10-28 that step had been missed: production's database was 22 migrations behind, the live site ran new code against the old schema, and the first import failed.

## Decision

**The production build migrates production's database, and only migrates it.**

1. **Migrate before the build.** On a Vercel production build (`VERCEL_ENV` is `production`) that was given a `DATABASE_URL`, the build step ([db/preview-build.ts](../db/preview-build.ts), rules in [lib/seed/preview-build.ts](../lib/seed/preview-build.ts)) runs `migrateDatabase` ([db/migrate-database.ts](../db/migrate-database.ts)): every pending journaled migration, then the post-migration steps. It is the same call `pnpm db:migrate` and the preview build make.
2. **One build at a time, on the direct connection.** The step holds a Postgres session advisory lock on `DATABASE_URL_UNPOOLED` across the migration, so concurrent production builds take turns. A production build with a `DATABASE_URL` but no `DATABASE_URL_UNPOOLED`, or whose two strings name different databases, is refused and fails, as a preview build is. This stays inside [ADR 0003](0003-neon-direct-pooled.md)'s rule that the direct string is for migrations.
3. **Nothing else.** The production path is handed only a lock and the migration. It holds no step that reads rows, seeds, re-seeds or empties anything, and it never asks the seed guard. `guardSeedTarget` in [lib/seed/target.ts](../lib/seed/target.ts) still refuses every target on a production build, so no seed path can run there. A `PREVIEW_RESEED_REQUEST` on a production build is ignored.
4. **A failure keeps the live site.** A refusal or a failed migration exits non-zero, so the build fails and the deployment that is live stays live.
5. **The log names what was applied.** The step reads drizzle's record of applied migrations before and after the run and logs each new one by its journal name. It never prints a connection string.
6. **Other builds are unchanged.** Preview builds migrate and seed the `preview` branch exactly as ADR 0016 and its amendments say. Development builds, local builds and a production build with no `DATABASE_URL` touch no database.

**Additive migrations, and a later release for cleanup.** Vercel keeps serving the deployment that is live while a new production build runs. With this step, the new build migrates production's database before its own code is live, so for the length of the build the old code reads the new schema. That is safe only when the migration adds: new tables, new nullable columns, new indexes. A migration that drops, renames or rewrites something the old code reads (such as `0075_drop_members_email_alias`) breaks the live site for that time. So:
- a release adds what the new code needs and leaves the old shape in place (expand);
- a cleanup migration that drops or rewrites the old shape ships in a later release than the code that stops reading it, once that code is live (contract);
- a migration's additive check lives beside it in [lib/seed/additive-migration.test.ts](../lib/seed/additive-migration.test.ts), and a cleanup is named and approved as one.

**What this replaces in ADR 0016.** These lines stay as written and no longer bind:
- the binding constraint "Never seed or migrate production or any database other than a local one or the `preview` branch", narrowed: never seed production; the production build migrates it as this record says, and nothing else migrates it but `pnpm db:migrate` run by the owner;
- the 2026-10-16 amendment's "Production and development builds, a local build and a preview with no database never touch a database there", narrowed: a production build given a database migrates it;
- the 2026-10-24 amendment's "No agent writes to, seeds or migrates the `main` branch, by hand or through a check", restated: no agent does so by hand or through a check; the production build, which merging into `main` starts, migrates it.

Everything else in 0016 stands, the seed guard and its refusal on production among it.

**Binding constraints.**
- The production build only migrates. It never seeds, re-seeds, empties or resets production's database, and it never routes through the seed guard.
- A migration that drops or rewrites what the live code reads ships in a later release than the code that stops reading it.
- The step reads the real environment only, never a `.env` file, and never logs a connection string.
- No agent runs a migration against production by hand.

## Consequences

- A release that carries a migration no longer needs a manual `pnpm db:migrate` against production first; merging into `main` is enough.
- A non-additive migration merged together with the code that needs it breaks the live site for the length of the build. The expand-then-contract rule above is what prevents that.
- Drizzle applies all pending migrations in one transaction, so a failed migration leaves the schema as it was and the previous deployment live. The post-migration steps run after that transaction; if one of them fails, the migrations stay applied and the next build runs the steps again, since each changes only rows it has not filled yet.
- The Vercel Production environment needs `DATABASE_URL_UNPOOLED` beside `DATABASE_URL`; without it every production build fails at this step. Setting it is an owner action.

Followed today: the plan and the production arm are `previewBuildPlan` and `prepareBuildDatabase` in [lib/seed/preview-build.ts](../lib/seed/preview-build.ts); the migration names come from `appliedMigrations` in [lib/seed/journal.ts](../lib/seed/journal.ts); the tests are [lib/seed/preview-build.test.ts](../lib/seed/preview-build.test.ts) and [lib/seed/applied-migrations.test.ts](../lib/seed/applied-migrations.test.ts).
