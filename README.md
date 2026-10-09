# PoliTo Rocket Team Website

This repository powers the PoliTo Rocket Team website. The stack is Next.js, Vercel for deployment, Drizzle ORM for database schema/migrations, Neon Postgres, Better Auth, and Tailwind CSS.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill in the required values.
   Use `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` for the auth base URL and secret.

3. Create a Neon project and set `DATABASE_URL`.

4. Apply the schema and load seed data:

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
- `pnpm db:seed` - Seed the database using [`db/seed.sql`](db/seed.sql)
- `pnpm mailpit:start` - Start Mailpit for local email testing
- `pnpm mailpit:stop` - Stop Mailpit
- `pnpm mailpit:restart` - Restart Mailpit
- `pnpm mailpit:logs` - Tail Mailpit logs

## Database Workflow

- Update the Drizzle schema files in [`db/schema`](db/schema).
- Generate SQL with `pnpm db:generate`.
- Review the generated migration in [`drizzle/`](drizzle).
- Apply it with `pnpm db:migrate`.
- Refresh fixture data in [`db/seed.sql`](db/seed.sql) when needed.

## Vercel Deployment

1. Connect the repository to Vercel.
2. Copy the production environment variables from your local `.env` into the Vercel project settings.
3. Keep the default Next.js framework preset and use the repository root as the project root.
4. Deploy from the Vercel dashboard or run `pnpm deploy` after authenticating the Vercel CLI.

### Google sign-in on previews

Google only accepts a fixed list of redirect URIs, and a preview's URL changes on every PR. So
sign-in on a preview goes through `https://v2dev.politorocketteam.it` and comes back to the preview
that started it (better-auth's OAuth proxy plugin). [`lib/auth-urls.ts`](lib/auth-urls.ts) picks the
setup from Vercel's `VERCEL_ENV`:

| Deployment | Auth URL | Proxy |
|---|---|---|
| Production | `https://v2.politorocketteam.it` | off |
| `huey/landing-page` (v2dev) | `https://v2dev.politorocketteam.it` | on, as the fixed host |
| Any other preview | the preview's own URL | on, through v2dev |
| Local dev | `http://localhost:3000` (or `BETTER_AUTH_URL`) | off |

On Vercel, `BETTER_AUTH_URL` is not read. Agents do not change Vercel settings. A person does
these steps once:

1. In the Vercel project, add the domain `v2dev.politorocketteam.it`, assign it to the
   `huey/landing-page` branch, and add the DNS record Vercel asks for.
2. Set the **same** `BETTER_AUTH_SECRET` for Preview and for the v2dev deployment (v2dev is a
   Preview deployment of `huey/landing-page`, so one Preview value covers both). The proxy encrypts
   the sign-in with it, so a different secret breaks the round-trip.
3. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` for Preview and the v2dev deployment.
4. In Google Cloud, keep exactly these redirect URIs on the OAuth client:
   `http://localhost:3000/api/auth/callback/google`,
   `https://v2dev.politorocketteam.it/api/auth/callback/google` and
   `https://v2.politorocketteam.it/api/auth/callback/google`.
5. Keep Vercel's system environment variables exposed (the default), so `VERCEL_ENV`, `VERCEL_URL`,
   `VERCEL_BRANCH_URL` and `VERCEL_GIT_COMMIT_REF` reach the server.

## Neon Branching Workflow

### Local development

- Use a dedicated Neon development branch locally instead of sharing the production database.
- A good default is one long-lived personal branch per developer, such as `dev/huey`.
- Put that branch's connection string in your local `.env`.
- Run migrations locally against that branch with `pnpm db:migrate`.

Typical local flow:

```bash
pnpm db:migrate
pnpm dev
```

If you need a clean development database, reset your Neon development branch and rerun migrations:

```bash
neonctl branches reset dev/huey
pnpm db:migrate
pnpm db:seed
```

#### Sign in as a tester (local only)

On `pnpm dev` you can sign in as one of four seeded testers, with no Google
account. This exists only under `next dev`: on Vercel previews, on production
and on `pnpm build` / `pnpm start`, the routes below are not registered and
answer 404. Sign-in there stays Google only.

1. Load the testers into your own development branch (never a preview or
   production database):

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
| Tester Operations Lead | `operations-lead` | In Operations; org-level `edit` on `positions` | `/dashboard`, including the site-wide recruitment switch |

The testers' ids, emails and names live in `lib/dev-tester.ts` and
`db/seed.sql`; nothing comes from `.env`. The gate is `testerSignInOn()` in
`lib/dev-tester.ts`, and `lib/dev-tester.test.ts` proves it is off outside
`next dev`.

The gate is also off when `VERCEL_ENV` is set in your shell or env files, for
example after `vercel env pull`. If the tester links answer 404 on
`pnpm dev`, check that `VERCEL_ENV` is unset.

### Production

- Keep production on a separate Neon branch or database.
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
