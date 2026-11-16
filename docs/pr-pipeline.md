# Pull requests, tests, merging and releases

Reference for agents: what happens to a change from branch to production, and what each step
checks. The Fabrika stages (build, review, ship) run on top of this; see [AGENTS.md](../AGENTS.md)
and [CLAUDE.md](../CLAUDE.md) for those.

## Branches

- `dev` is the trunk and the default branch. Every pull request targets `dev`.
- `main` is production. Only a release pull request (`dev` into `main`) changes it.
- Branch from `origin/dev` in a `/tmp` worktree; never switch branches in the shared checkout.
  Hand-made branches start with `huey/`; Fabrika lanes name their own.
- `huey/design-boards` holds board images linked from old issues. Never delete it.

## What runs on a pull request

| Check | Workflow | What it does |
|---|---|---|
| `typecheck` | [ci.yml](../.github/workflows/ci.yml) | pnpm catalog guard (every dependency reads `catalog:`), `tsc --noEmit`, ADR corpus validation. |
| `test (1)` to `test (4)` | ci.yml | The test suite in four shards (`--test-shard=N/4`), about 2 to 5 minutes each. |
| `ci-required` | ci.yml | Passes only when `typecheck` and every test shard pass. In the merge queue it also fails while the pull request carries `ready-for:human`. |
| secrets scan | [secrets.yml](../.github/workflows/secrets.yml) | gitleaks on the changed files: no secrets, no machine-local paths (`/Users/...`, `/private/tmp/...`). |
| preview marker | [preview-marker.yml](../.github/workflows/preview-marker.yml) | Posts the Vercel preview URL as a sticky comment, in the shape `fabrika review-ui` reads. |
| Vercel | Vercel | Builds a preview deployment. The build applies pending migrations to the shared `preview` database first. |

The merge queue requires `ci-required` and the secrets scan. The rest inform review.

## Tests

- Run them all: `pnpm test` (node's test runner through tsx, files `lib/**/*.test.ts` and
  `scripts/**/*.test.ts`). One file: `pnpm exec tsx --test path/to/file.test.ts`.
- Tests need no secrets and no network. A test that reads env passes its own values.
- **Server tests** (`*-server.test.ts`) run real server actions and loaders against an in-memory
  Postgres (PGlite) with every migration applied. Start the file with
  `import "./access-matrix/install";` (path relative to `lib/dashboard/`), seed with
  `seedFixture`, sign in with `signInAs`, and read results with `tableRows` / `databaseWrites`.
  See [lib/dashboard/seat-hand-over-server.test.ts](../lib/dashboard/seat-hand-over-server.test.ts)
  for the shape and [lib/dashboard/access-matrix/](../lib/dashboard/access-matrix) for the helpers.
- Pure logic gets a plain unit test next to its module.
- Never run `next dev` to check a change. Evidence is tests, CI and the PR's preview.

## Migrations

- Change `db/schema/`, then `pnpm db:generate`. Keep generated SQL as generated; hand-written
  data steps go in their own migration.
- Every preview build migrates the shared `preview` database, and the production build migrates
  production before its code goes live ([ADR 0020](../.decisions/0020-production-builds-migrate.md)).
  So a migration must not drop or rewrite anything the currently deployed code still reads: expand
  first, and remove in a later release. An exception needs a recorded owner ruling.
- More in [.patterns/schema-migrations.md](../.patterns/schema-migrations.md).

## Checking on the preview

- Each pull request gets its own preview URL (the preview marker comment) on the shared `preview`
  database. Writing there to set up a state is allowed; production is never touched.
- Sign in without Google at `/api/auth/dev-tester?cb=<path>` (or
  `/api/auth/dev-tester/sign-in?tester=<key>&cb=<path>` for one seeded person). The keys are in
  [docs/seed-cases.md](seed-cases.md#test-seats).
- Previews upload photos to their own public Blob store (`PREVIEW_PUBLIC_STORE_ID`), never
  production's.

## Merging

- A pull request merges only through the GitHub **merge queue** on `dev`
  ([ADR 0007](../.decisions/0007-shipper-merges-through-queue.md)): `gh pr merge <n> --auto`, or
  the Fabrika shipper. The queue re-runs CI on the pull request rebased onto `dev`, then
  squash-merges. No direct pushes to `dev`.
- `ready-for:human` on a pull request holds it in the queue for the owner. Remove the label and
  queue again to release it.
- Closing keywords (`Closes #N`) in the body close the issue when the merge lands.

## Releases

- A release is one pull request from `dev` into `main`, with a body listing what ships and the
  migrations it applies. The owner decides when.
- `main` needs one approving review, and the owner cannot approve their own pull request, so the
  owner merges it with an admin bypass as a merge commit (`gh pr merge <n> --merge --admin`), on
  their explicit go-ahead.
- Merging deploys production: the build applies the migrations first, and its log lists them
  (`Production database migrated: applied N migrations: ...`).
- One-time production data tools (imports, repairs) run by the owner after a release, dry run
  first, then a real run, then a pull request that removes the tool.
- Three daily jobs run on production only ([vercel.json](../vercel.json)): anonymize deleted
  accounts, delete withdrawn application files, delete unused editor uploads.
