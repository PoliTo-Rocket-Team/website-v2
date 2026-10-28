# PoliTo Rocket Team Website

This repository powers the PoliTo Rocket Team website. The stack is Next.js, Vercel for deployment, Drizzle ORM for database schema/migrations, Neon Postgres, Better Auth, and Tailwind CSS.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill in the required values.
   Use `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` for the auth base URL and secret.

3. Set `DATABASE_URL`. The site's database is one Neon project, made through
   the Neon integration for Vercel ([ADR 0018](.decisions/0018-v2-hosting-and-launch.md)).
   `vercel env pull` brings the Vercel Development environment's variables,
   which are the connection strings of the Neon `development` branch, never
   production's. Production is the Neon `main` branch, and its strings are set
   for the Vercel Production environment only.

   `pnpm db:seed` refuses the `development` branch. To load the dummy set,
   point `DATABASE_URL` at a local Postgres (see
   [Where the seed runs](#where-the-seed-runs)).

   Uploaded files live in two Vercel Blob stores, and `vercel env pull` brings
   their credentials: `BLOB_READ_WRITE_TOKEN` for the private store
   (`prt-applications`: application files and order documents), and
   `PUBLIC_BLOB_STORE_ID` with `VERCEL_OIDC_TOKEN` for the public store
   (`prt-public`: profile photos). The helpers are in [`lib/storage`](lib/storage).
   Tests do not touch either store.

4. Apply the schema and load seed data (the seed runs on a local database only):

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. Start the app:

   ```bash
   pnpm dev
   ```

## Common Commands

- `pnpm dev` - Start the development server
- `pnpm preview` - Build and serve the production app locally
- `pnpm deploy` - Deploy the app to Vercel
- `pnpm db:generate` - Generate Drizzle migrations from the TypeScript schema
- `pnpm db:migrate` - Apply Drizzle migrations in `drizzle/`
- `pnpm db:seed` - Seed a local database with the dummy set; the `preview` branch is seeded only by a Vercel preview build, and re-seeded only when the owner asks with `PREVIEW_RESEED_REQUEST`; it refuses any other target ([`docs/seed-cases.md`](docs/seed-cases.md))

## Database Workflow

- Update the Drizzle schema files in [`db/schema`](db/schema).
- Generate SQL with `pnpm db:generate`.
- Review the generated migration in [`drizzle/`](drizzle).
- Apply it with `pnpm db:migrate`.
- Add or change seed data through a module in [`db/seed`](db/seed) and list its cases in [`docs/seed-cases.md`](docs/seed-cases.md).

## Vercel Deployment

1. Connect the repository to Vercel.
2. The owner sets the Production environment variables in the Vercel project settings ([ADR 0018](.decisions/0018-v2-hosting-and-launch.md)). They are never copied from a local `.env`, which holds the `development` branch's strings.
3. Keep the default Next.js framework preset and use the repository root as the project root.
4. Deploy from the Vercel dashboard or run `pnpm deploy` after authenticating the Vercel CLI.

### Search engine indexing

`SITE_INDEXABLE` decides whether search engines may index the site. Leave it
unset while the site runs on v2.politorocketteam.it: every page then carries
`<meta name="robots" content="noindex, nofollow">` and `/robots.txt` disallows
all paths for all crawlers. Set it to exactly `true` in the Vercel Production
environment only when politorocketteam.it moves to the new site, then redeploy:
a changed value takes effect only on a new deployment. Any other value counts
as unset. The switch is
read in [`lib/site-indexing.ts`](lib/site-indexing.ts). Preview deployments
also get Vercel's own `X-Robots-Tag: noindex` header, whatever the value.

## Neon Branching Workflow

The Neon project has three branches ([ADR 0018](.decisions/0018-v2-hosting-and-launch.md)):

| Neon branch | Used by |
| --- | --- |
| `main` | Production (v2.politorocketteam.it), through the Vercel Production environment only |
| `preview` | Vercel previews only ([ADR 0016](.decisions/0016-previews-read-their-own-seeded-branch.md)) |
| `development` | The Vercel Development environment; copied from `preview` |

### Local development

- `vercel env pull` brings the `development` branch's connection strings, never
  production's.
- Never point your local env files at the `main` branch.

### Where the seed runs

`pnpm db:seed` checks its target first (`guardSeedTarget` in
[`lib/seed/target.ts`](lib/seed/target.ts)) and writes only to:

- a local database (`localhost`, `127.x.x.x` or `::1`), from any machine;
- the `preview` branch, and only on a Vercel preview build, which seeds it
  itself when it is empty.

It refuses every other target, the `development` and `main` branches among
them, and no flag turns a refusal into a pass.

The `preview` branch is a test database ([ADR 0016](.decisions/0016-previews-read-their-own-seeded-branch.md),
amendment of 2026-10-24):

- Agents may write to it through a preview deployment to set up and check a
  state.
- It is re-seeded on demand, never on every build. The owner sets the Vercel
  Preview variable `PREVIEW_RESEED_REQUEST` to a new value and redeploys a
  preview; that one build empties the branch and loads the dummy set again
  ([Re-seed the preview branch](docs/seed-cases.md#re-seed-the-preview-branch)).
- Production is never written to or seeded by agents.
- Never use a Neon "reset from parent" on `preview`: its parent is production.

To work with the dummy set, run a local Postgres, set `DATABASE_URL` to it, then:

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm db:seed --check` runs the target check alone and writes nothing.

#### Sign in as a tester

On `pnpm dev`, and on a Vercel preview whose database is the shared `preview`
branch, you can sign in as any seeded person with no Google account, and get
a real session. No seeded person is a dedicated tester: each seat is a normal
member or applicant of the seed, so a check that passes for a seat holds for
any member built the same way. On production, on any other Vercel
environment, on a preview pointed at another database and on a local
`pnpm build` / `pnpm start`, the routes below are not registered and answer
404. Sign-in there stays Google only. On a preview, use the same paths on the
preview's own URL; its accounts come from the preview seed.

1. Load the seed into a local database (the seed refuses every Neon
   branch from a laptop; see [Where the seed runs](#where-the-seed-runs)):

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

2. Start `pnpm dev`.
3. Open `http://localhost:3000/api/auth/dev-tester`, which lists how to name
   a person and links every seat, or go straight to a sign-in link:

   ```text
   http://localhost:3000/api/auth/dev-tester/sign-in?tester=<key>&cb=<path>
   http://localhost:3000/api/auth/dev-tester/sign-in?member=<member id>&cb=<path>
   ```

   `cb` is the page to land on (default `/dashboard`). The link sets the same
   Better Auth session cookies a Google sign-in sets, so a browser or a
   Playwright script that opens it is signed in for every later page. To
   switch person, open another link. Signing out ends the session.

`key` names a person one of two ways:

- a seat or an admin tester in [`lib/seeded-accounts.ts`](lib/seeded-accounts.ts),
  for example `member`, `division-lead`, `it-lead`, `non-member` (the
  applicant) or `admin-1`. Each seat is a normal seeded person and holds
  exactly the roles and grants its name says
  ([`docs/seed-cases.md`](docs/seed-cases.md#test-seats));
- a person key: the part of anyone's seeded email before the `@`, for example
  `beatrice.la.motta`.

`member=<member id>` names the seeded member with that id, for example `119`.
Only an account the seed made (an email on `example.com`) signs in, so a
developer's own account never does. On a preview or under `next dev` any
signed-in account may use View as (issue #648); an admin tester is one with
no team role ([`docs/seed-cases.md`](docs/seed-cases.md#admin-testers)).

To check a grant, give it to a normal seeded member on the Access page as the
team leader, check what it opens, then remove it on the Access page again
([`docs/seed-cases.md`](docs/seed-cases.md#test-seats)). No seat holds an area
grant of its own.

The seats' and admin testers' ids, emails and names live in
`lib/seeded-accounts.ts`, and every other person's in the seed; nothing comes
from `.env`. The gate is `testerSignInOn()` in `lib/dev-tester.ts`, and
`lib/dev-tester.test.ts` proves it is off everywhere else.

The gate is also off when `VERCEL_ENV` is set in your shell or env files, for
example after `vercel env pull`. If the tester links answer 404 on
`pnpm dev`, check that `VERCEL_ENV` is unset.

### Production

- Production is the Neon `main` branch. Its connection strings are set for the
  Vercel Production environment only.
- Never point local `.env` at production.
- Treat files in [`drizzle/`](drizzle) as append-only migrations.

### Branch strategy

- Local development can stay on your personal Neon branch.
- The `dev` branch in GitHub can auto-run committed migrations against the shared development database.
- The `main` branch in GitHub can auto-run committed migrations against production.
- Any other branch should use a local Neon branch only.

Recommended environment split:

- Local development: `dev/<developer-name>`
- Shared development: `dev` GitHub branch + shared development database
- Production: `main` GitHub branch + production database

## GitHub Actions Database Automation

This repository includes one workflow:

- [db_migrate.yml](.github/workflows/db_migrate.yml)
  Runs `pnpm db:migrate` automatically on pushes to `dev` and `main`.

The automation only applies committed migrations from [`drizzle/`](drizzle). It does not generate new migrations in CI, and it does not run migrations for feature branches.

### Required GitHub configuration

Create these GitHub environments and add a `DATABASE_URL` secret to each one:

- Environment: `dev`
- Environment: `main`

The workflow uses the environment that matches the pushed branch name, so:

- pushes to `dev` use the `dev` environment's `DATABASE_URL`
- pushes to `main` use the `main` environment's `DATABASE_URL`

### Recommended migration flow

1. Update the schema in [`db/schema`](db/schema).
2. Generate a migration locally with `pnpm db:generate`.
3. Review the SQL file in [`drizzle/`](drizzle).
4. Apply it locally with `pnpm db:migrate`.
5. Commit both the schema changes and the migration file.
6. Merge or push to `dev` to update the shared development database automatically.
7. Merge or push to `main` to update production automatically.
