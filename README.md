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

## Vercel Deployment

1. Connect the repository to Vercel.
2. Copy the production environment variables from your local `.env` into the Vercel project settings.
3. Keep the default Next.js framework preset and use the repository root as the project root.
4. Deploy from the Vercel dashboard or run `pnpm deploy` after authenticating the Vercel CLI.
