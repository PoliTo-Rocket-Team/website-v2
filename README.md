# PoliTo Rocket Team Website

This repository powers the PoliTo Rocket Team website. The stack is Next.js, OpenNext for Cloudflare deployment, Drizzle ORM for database schema/migrations, Neon Postgres, Better Auth, and Tailwind CSS.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill in the required values.
   Use `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` for the auth base URL and secret.

3. Create a Neon project and set `DATABASE_URL`.

   For `wrangler dev` or `pnpm preview`, put Worker runtime secrets in `.dev.vars`
   instead of `wrangler.jsonc`. Do not commit production values or a local database URL
   to `wrangler.jsonc`, because deployed Workers cannot reach your laptop's Postgres instance.

   Recommended local workflow with Neon:

   - Keep production and local development on separate Neon branches.
   - Create one long-lived personal development branch, for example `dev/huey`.
   - Use that branch's connection string in your local `.env`.

   Example:

   ```bash
   neonctl auth
   neonctl branches create --name dev/huey
   neonctl connection-string dev/huey
   ```

   Then set:

   ```bash
   DATABASE_URL='postgresql://...'
   ```

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
- `pnpm preview` - Build and preview the app in the OpenNext Cloudflare runtime
- `pnpm deploy` - Build and deploy with OpenNext Cloudflare
- `pnpm db:generate` - Generate Drizzle migrations from the TypeScript schema
- `pnpm db:migrate` - Apply Drizzle migrations in `drizzle/`
- `pnpm db:seed` - Seed the database using [`db/seed.sql`](/Users/huey/Documents/projects/website-v2/db/seed.sql)
- `pnpm mailpit:start` - Start Mailpit for local email testing
- `pnpm mailpit:stop` - Stop Mailpit
- `pnpm mailpit:restart` - Restart Mailpit
- `pnpm mailpit:logs` - Tail Mailpit logs

## Database Workflow

- Update the Drizzle schema files in [`db/schema`](/Users/huey/Documents/projects/website-v2/db/schema).
- Generate SQL with `pnpm db:generate`.
- Review the generated migration in [`drizzle/`](/Users/huey/Documents/projects/website-v2/drizzle).
- Apply it with `pnpm db:migrate`.
- Refresh fixture data in [`db/seed.sql`](/Users/huey/Documents/projects/website-v2/db/seed.sql) when needed.

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

### Production

- Keep production on a separate Neon branch or database.
- Never point local `.env` at production.
- Treat files in [`drizzle/`](/Users/huey/Documents/projects/website-v2/drizzle) as append-only migrations.

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

- [db_migrate.yml](/Users/huey/Documents/projects/website-v2/.github/workflows/db_migrate.yml)
  Runs `pnpm db:migrate` automatically on pushes to `dev` and `main`.

The automation only applies committed migrations from [`drizzle/`](/Users/huey/Documents/projects/website-v2/drizzle). It does not generate new migrations in CI, and it does not run for feature branches.

### Required GitHub configuration

Create these GitHub environments and add a `DATABASE_URL` secret to each one:

- Environment: `dev`
- Environment: `main`

The workflow uses the environment that matches the pushed branch name, so:

- pushes to `dev` use the `dev` environment's `DATABASE_URL`
- pushes to `main` use the `main` environment's `DATABASE_URL`

### Recommended migration flow

1. Update the schema in [`db/schema`](/Users/huey/Documents/projects/website-v2/db/schema).
2. Generate a migration locally with `pnpm db:generate`.
3. Review the SQL file in [`drizzle/`](/Users/huey/Documents/projects/website-v2/drizzle).
4. Apply it locally with `pnpm db:migrate`.
5. Commit both the schema changes and the migration file.
6. Merge or push to `dev` to update the shared development database automatically.
7. Merge or push to `main` to update production automatically.
