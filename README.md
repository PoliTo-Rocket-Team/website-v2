[![Netlify Status](https://api.netlify.com/api/v1/badges/4c661322-7277-43f5-aff6-5485d5c49180/deploy-status)](https://app.netlify.com/sites/dashing-pika-6e410b/deploys)


# PoliTo Rocket Team Website
This is the repository for the PoliTo Rocket Team website. The website is built using Next.js, Supabase for database management, next-auth for authentication, and Tailwind CSS for styling.


## Setup Instructions

1. Before cloning the repository, ensure you have supabase and [docker](https://docs.docker.com/get-started/get-docker/) installed on your machine. You can install supabase using the following commands:

   ```
   # macOS / Linux
   brew install supabase/tap/supabase

   # Windows (using Scoop)
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase

   # Alternative: Using npm globally
   pnpm add -g supabase
   ```

2. Clone the repository

   ```bash
   git clone https://github.com/PoliTo-Rocket-Team/website-v2.git
   ```

3. Make sure docker is running in the background and run:

   ```
   Supabase start
   ```

   This will start the supabase server on your local machine.
   In the first run, it will take some time to setup.

4. While supabase is setting up, dublicate the .env.example file in the root directory and rename it to .env. This file will contain the environment variables for the project.

5. After supabase setup is complete, you will see api url and anon key in the terminal. Copy and paste them in the .env file in the root directory of the project.

6. Open supabase studio by clicking on the link in the terminal(it starts with studio url) or by going to http://localhost:54323 in your browser. This will open the supabase studio where you can manage your database and authentication.
7. For google client id and secret, you should have the google api credentials. You can get them from the google cloud console. Copy and paste the client id and secret in the .env file in the root directory of the project.(if you don't have, contact the team)

8. Once you have the .env file setup, you can run the following commands to start the project:
   ```bash
   pnpm install
   pnpm dev
   ```
   This will start the project on localhost:3000
9. Open the browser and go to http://localhost:3000 to see the project running.

10. Login to website using google account.

11. After logging in to an account in the local environment, go to supabase studio, go to table editor > users > find your email > change member to `1` to make yourself president so that you can access everything.

### Common Commands

- `pnpm dev` - Start the development server

- `supabase start` - Start the supabase server

- `supabase stop` - Stop the supabase server

- `supabase db reset` - Reset the supabase database

- `pnpm generate:supabase-types` - Generate types for supabase queries

### Basic database workflow

If you want to create a new table in Supabase Studio (which runs on http://localhost:54323 by default):

- Open the SQL Editor in the Studio and create your table by writing an SQL script. After successfully creating the table, copy the SQL code you used.

- Next, generate a schema diff by running the following command:

    `supabase db diff -f <migration_name>`

    You can choose a descriptive name for the migration file.

- This command will create a migration file at `supabase/migrations/<timestamp>_<migration_name>.sql`.

- Open the generated migration file and paste the SQL code you copied earlier. This makes the migration file much easier to read and maintain, since the auto-generated ones are often difficult to follow.



If you want to make some changes in production and development databases, you should push the migration file to the repository.

For more detailed information about managing environments, you can refer to the [supabase documentation](https://supabase.com/docs/guides/deployment/managing-environments?queryGroups=environment&environment=ci#auto-schema-diff)
