# Schema changes and migrations

How the database shape changes today: edit the Drizzle schema in `db/schema/`, generate SQL into
`drizzle/` with drizzle-kit, and apply it with the repo's own migrator. SQL that Drizzle cannot
express (functions, triggers, data fixes) goes in hand-written migration files in the same folder.

## The shape

1. **Schema files.** [db/schema/index.ts](../db/schema/index.ts) re-exports two files:
   [public.ts](../db/schema/public.ts) for app tables and enums in `public`, and
   [better-auth.ts](../db/schema/better-auth.ts) for Better Auth's tables in the `better_auth`
   Postgres schema (`pgSchema("better_auth")`). [drizzle.config.ts](../drizzle.config.ts) points
   drizzle-kit at `index.ts` with `strict: true`.

2. **Column conventions in `public.ts`.** TypeScript keys are camelCase, SQL names are snake_case
   (`divisionId: integer("division_id")`). Timestamps and dates use `mode: "string"`. Enums are
   `pgEnum` constants at the top of the file. Indexes are declared in the table's third argument:

   ```ts
   (table) => ({
     divisionIdIdx: index("apply_positions_division_id_idx").on(table.divisionId),
     isDeletedIdx: index("apply_positions_is_deleted_idx").on(table.isDeleted),
   })
   ```

3. **Generated migrations.** `pnpm db:generate` writes `drizzle/NNNN_<name>.sql`, a snapshot in
   `drizzle/meta/`, and an entry in `drizzle/meta/_journal.json`. Examples:
   [0000_sticky_wendell_rand.sql](../drizzle/0000_sticky_wendell_rand.sql) (the base schema) and
   [0004_melodic_blue_marvel.sql](../drizzle/0004_melodic_blue_marvel.sql) (indexes). Read the SQL
   before applying it, and keep it as generated.

4. **Hand-written migrations.** Triggers and functions live in SQL-only migrations with a
   descriptive name and `--> statement-breakpoint` between statements:
   [0001_sync_better_auth_user_ids.sql](../drizzle/0001_sync_better_auth_user_ids.sql) (a trigger that syncs
   `better_auth.user` inserts and updates into `public.users`),
   [0002_add_audit_logs.sql](../drizzle/0002_add_audit_logs.sql) and
   [0003_logs_changed_by_user_fk.sql](../drizzle/0003_logs_changed_by_user_fk.sql) (the audit
   trigger used by [audited-mutations.md](./audited-mutations.md)). They have journal entries but no
   snapshot.

5. **Apply.** `pnpm db:migrate` runs [db/migrate.ts](../db/migrate.ts): the `postgres-js` driver,
   one connection, `migrate(db, { migrationsFolder: "./drizzle" })`. The app itself uses the
   `neon-http` driver ([db/client.ts](../db/client.ts)); the migrator does not. `pnpm db:seed`
   ([db/seed.ts](../db/seed.ts)) then runs [db/seed.sql](../db/seed.sql) as raw SQL.

6. **Derived types.** [db/types.ts](../db/types.ts) builds the shared UI types from
   `InferSelectModel<typeof table>`, so a column change flows into the types `tsc` checks.

## When this applies

Any change to a table, enum, index, trigger or function. Setup and the Neon branch workflow are in
[README.md](../README.md). There are no migration tests; `pnpm exec tsc --noEmit` is the check that
catches type fallout.

## Why it is not obvious

- Drizzle's migrator applies only files listed in `meta/_journal.json`. A `.sql` file in `drizzle/`
  without a journal entry is never run.
- The audit trigger in `0002` is attached by a one-time loop over the tables that existed then
  (`public` and `better_auth`, minus `logs`). A table created by a later migration gets no
  `audit_row_changes` trigger unless that migration adds one.

## Known inconsistencies (not the pattern)

- **`0005_restore_application_files` is not in the journal.**
  [0005_restore_application_files.sql](../drizzle/0005_restore_application_files.sql) creates
  `application_files` and the `cv_file_id` / `cover_letter_file_id` columns, but it has no
  journal entry, so `pnpm db:migrate` skips it. The next `pnpm db:generate` after it
  (`0005_recruitment_setting`, issue #119) emitted those statements again; they were cut from
  that file by hand, and its snapshot (`meta/0005_snapshot.json`) now holds them, so later
  generates no longer repeat them. The journal's `0005` tag is `0005_recruitment_setting`.
  [get-applications.ts](../app/actions/get-applications.ts) carries a fallback query for when these
  columns are missing.
- **`0008_lead_recruitment` ends by hand.** Its generated statements are kept as generated; the
  `audit_row_changes` trigger on `interview_slots` (issue #171) is appended after them, so the
  table gets its trigger in the migration that creates it.
- **`0005` is written defensively** (`IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object`),
  unlike the generated files.
- **No audit trigger on `application_files`.** It was created after `0002` and `0005` adds none.
- **Missing workflow.** README describes a `db_migrate.yml` workflow that runs migrations on pushes
  to `dev` and `main`. No such file is in `.github/workflows/`.
- **Connection string.** ADR [0003](../.decisions/0003-neon-direct-pooled.md) reserves the unpooled
  endpoint for migrations, but `db/migrate.ts` reads the same `DATABASE_URL` as the app.
- **Stray file.** [drizzle/schema.ts](../drizzle/schema.ts) only re-exports `@/db/schema`; nothing
  in the config reads it.
