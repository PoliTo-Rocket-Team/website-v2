[![Netlify Status](https://api.netlify.com/api/v1/badges/4c661322-7277-43f5-aff6-5485d5c49180/deploy-status)](https://app.netlify.com/sites/dashing-pika-6e410b/deploys)

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
    
6. For google client id and secret, you should have the google api credentials. You can get them from the google cloud console. Copy and paste the client id and secret in the .env file in the root directory of the project.(if you don't have, contact the team)

7. Once you have the .env file setup, you can run the following commands to start the project:
    ```bash
    pnpm install
    pnpm dev
    ```
    This will start the project on localhost:3000


### Common Commands
- `pnpm dev` - Start the development server

- `supabase start` - Start the supabase server

- `supabase stop` - Stop the supabase server

- `supabase db reset` - Reset the supabase database

- `supabase studio` - Open the supabase studio in the browser

- `pnpm generate:supabase-types` - Generate types for supabase queries

### Basic database workflow
- Create a new table in the supabase studio which is localhost:54323 by default.

- Next, generate a schema diff by running the following command:
  ```
  supabase db diff -f <migration_name>
  ```
  You can set migration name to anything you want. 

- This will generate a migration file in the `supabase/migrations/<timestamp>_<migration_name>.sql`. 

If you want to make some changes in production and development databases, you should push the migration file to the repository.

For more detailed information about managing environments, you can refer to the [supabase documentation](https://supabase.com/docs/guides/deployment/managing-environments?queryGroups=environment&environment=ci#auto-schema-diff)
  