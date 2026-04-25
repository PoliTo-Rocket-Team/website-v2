# PoliTo Rocket Team Website

This repository powers the PoliTo Rocket Team website. The stack is Next.js, OpenNext for Cloudflare deployment, Drizzle ORM for database schema/migrations, PostgreSQL, Better Auth, and Tailwind CSS.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill in the required values.

3. Set `DATABASE_URL` to the Postgres database you want the app to use.

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
