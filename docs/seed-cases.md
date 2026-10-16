# Seed cases

The dummy set that `pnpm db:seed` loads into a local database and into each preview's own database branch ([ADR 0016](../.decisions/0016-previews-read-their-own-seeded-branch.md)). This page lists every case the set holds and the board or issue that case exercises, so a reviewer knows where to look and a maintainer knows what a change to the seed may break.

## How the seed runs

- `pnpm db:seed` runs [db/seed.ts](../db/seed.ts). It checks the target first, then runs every module in [db/seed/registry.ts](../db/seed/registry.ts) in one transaction: each module's reset (last module first), then each module's insert (in order). Running it twice leaves the same rows, including columns a default or a trigger fills. It leaves the audit table `logs` empty.
- `pnpm db:seed --check` runs the target check alone and writes nothing.
- The check reads `DATABASE_URL` and allows only two targets:
  - a local database (`localhost`, `127.x.x.x` or `::1`);
  - a Neon branch whose name starts with `preview/` and that the Neon API reports as neither the default branch nor protected. This needs `NEON_API_KEY` and `NEON_PROJECT_ID`.
- It refuses everything else: production, a Vercel production build, any host it cannot classify, and any Neon branch it cannot read or that is not a preview branch. No variable or flag turns a refusal into a pass. The rules are in [lib/seed/target.ts](../lib/seed/target.ts).
- No agent runs the seed or a migration against any real database.

## Row format

Each row is one seeded case. An area slice that adds a seed module adds its rows here in the same change.

| Column | What goes in it |
|---|---|
| Area | The seed module that holds the case, by its `name` in the registry (for example `structure`). |
| Case | The situation in plain words (for example "a closed division with no members"). |
| Rows | How to find the rows: table and key (for example `divisions` code `OLD`). |
| Exercised by | The board or issue whose page shows the case, as a link. |

## Cases

| Area | Case | Rows | Exercised by |
|---|---|---|---|

The `baseline` module still holds the rows of [db/seed.sql](../db/seed.sql), including the five local testers of issue #129. They are listed as cases when an area slice moves them into a typed module.

## Connect previews to their own database branch

This is a one-time owner action. The build does not change any Vercel, Neon or repository setting; until these steps are done, previews keep reading the dummy arrays in `lib/dummy-data/`.

1. **Make a schema-only parent branch.** In the Neon console, open the project, go to **Branches**, and create a branch named `preview-base` from the production branch with the **Schema only** option. It holds the tables and no rows, so no preview ever starts from production data.
2. **Point the preview branches at it.** In the Neon integration for Vercel, keep **Create a branch for each preview deployment** on and set its parent branch to `preview-base`. Each preview then gets a branch named `preview/<git branch>`. If the integration offers no choice of parent branch, stop here and say so on the setup issue: a preview branch must never be a copy of production.
3. **Add the guard's two variables to Preview only.** In Vercel, **Project → Settings → Environment Variables**, add `NEON_PROJECT_ID` (the project id from the Neon console) and `NEON_API_KEY` (a project-scoped API key), with only the **Preview** environment ticked. Never tick **Production**.
4. **Keep production out of Preview.** Check that the Preview `DATABASE_URL` is the one the integration sets for each preview branch, and that no production connection string is set for the Preview environment.
5. **Check it.** On the next preview deployment, `pnpm db:seed --check` in its build should print `Seed target allowed: preview preview/<git branch>`. Wiring migrate and seed into the preview build is a later slice of epic #260.
