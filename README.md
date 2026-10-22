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
- `pnpm db:seed` - Seed a local database or a preview branch with the dummy set; it refuses any other target ([`docs/seed-cases.md`](docs/seed-cases.md))

## Database Workflow

- Update the Drizzle schema files in [`db/schema`](db/schema).
- Generate SQL with `pnpm db:generate`.
- Review the generated migration in [`drizzle/`](drizzle).
- Apply it with `pnpm db:migrate`.
- Add or change seed data through a module in [`db/seed`](db/seed) and list its cases in [`docs/seed-cases.md`](docs/seed-cases.md).

## Vercel Deployment

1. Connect the repository to Vercel.
2. Copy the production environment variables from your local `.env` into the Vercel project settings.
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
them, and no flag turns a refusal into a pass. To work with the dummy set,
run a local Postgres, set `DATABASE_URL` to it, then:

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm db:seed --check` runs the target check alone and writes nothing.

#### Sign in as a tester (local only)

On `pnpm dev` you can sign in as one of five seeded testers, with no Google
account. This exists only under `next dev`: on Vercel previews, on production
and on `pnpm build` / `pnpm start`, the routes below are not registered and
answer 404. Sign-in there stays Google only.

1. Load the testers into a local database (the seed refuses every Neon
   branch from a laptop; see [Where the seed runs](#where-the-seed-runs)):

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

2. Start `pnpm dev`.
3. Open `http://localhost:3000/api/auth/dev-tester` and pick a tester, or go
   straight to its sign-in link:

   ```text
   http://localhost:3000/api/auth/dev-tester/sign-in?tester=<key>&cb=<path>
   ```

   `cb` is the page to land on (default `/dashboard`). The link sets the same
   Better Auth session cookies a Google sign-in sets, so a browser or a
   Playwright script that opens it is signed in for every later page. To
   switch tester, open another tester's link.

| Tester | `key` | Who it is | What it can see |
| --- | --- | --- | --- |
| Tester Applicant | `applicant` | Not a member, no scopes | The application form on an open position, for example `/apply/15-mission-analyst` |
| Tester Member | `member` | Member in Mission Analysis, no scopes | `/dashboard`, with no edit rights |
| Tester Division Lead | `division-lead` | Leads Mission Analysis; division-level `edit` on everything in it | `/dashboard`, and that division's positions and applications |
| Tester Department Head | `department-head` | Head of Aerodynamics; no scope rows, the head role covers the department | `/dashboard`, with every Aerodynamics division under division tabs |
| Tester Operations Lead | `operations-lead` | In Operations; org-level `edit` on `positions` | `/dashboard`, including the site-wide recruitment switch |

The testers' ids, emails and names live in `lib/dev-tester.ts` and
`db/seed/people.ts`; nothing comes from `.env`. The gate is `testerSignInOn()` in
`lib/dev-tester.ts`, and `lib/dev-tester.test.ts` proves it is off outside
`next dev`.

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
