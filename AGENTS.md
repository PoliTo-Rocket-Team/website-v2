# PoliTo Rocket Team website

The team's public site and its members' dashboard: one Next.js app (App Router, React 19) at the
repo root. Pages live in `app/`, shared components in `components/` (shadcn/ui primitives on Radix
in `components/ui/`), server helpers in `lib/`, and the Drizzle schema in `db/schema/` with its
generated migrations in `drizzle/`. Data is Neon Postgres, auth is Better Auth, styling is
Tailwind 3.

## Working rules

- Use `pnpm`, and `pnpm exec` / `pnpm dlx` in place of `npx`. The scripts are in
  [package.json](package.json); [README.md](README.md) explains setup.
- Run locally: copy `.env.example` to `.env`, then `pnpm db:migrate`, `pnpm db:seed` and
  `pnpm dev`.
- Change the schema in `db/schema/`, then `pnpm db:generate`, read the new SQL in `drizzle/`, and
  `pnpm db:migrate`. Keep generated migrations as generated.
- Databases ([ADR 0016](.decisions/0016-previews-read-their-own-seeded-branch.md), amendment of
  2026-10-24): you may write to the shared `preview` database through a preview deployment to
  set up and check a state, and a test write needs no revert migration. It is re-seeded on
  demand, never on every build: the owner sets `PREVIEW_RESEED_REQUEST` and redeploys a preview
  ([docs/seed-cases.md](docs/seed-cases.md#re-seed-the-preview-branch)). Never write to, seed or
  migrate production. Never run a Neon "reset from parent" on `preview`: its parent is
  production. Do not run the seed against a real database, set that variable or read env files.
- Check a signed-in page with a real session, never a fake one. Under `next dev` and on a preview
  of the shared `preview` database, sign in with no Google account at `/api/auth/dev-tester` as a
  seeded seat or admin tester (keys in [lib/seeded-accounts.ts](lib/seeded-accounts.ts),
  [README.md](README.md#sign-in-as-a-tester)); on production those routes answer 404. To see
  another person's dashboard, sign in as an admin tester and open "View as…" in the user menu on a
  seeded seat. On production only the IT lead seat may use View as. The seats and admin testers,
  with what each holds, are listed in [docs/seed-cases.md](docs/seed-cases.md#test-seats)
  (Test seats, Admin testers).
- The check every change passes is `pnpm exec tsc --noEmit`, the same one CI runs
  ([ci.yml](.github/workflows/ci.yml)). `pnpm build` prerenders pages that query Neon, so it
  needs `DATABASE_URL`.
- Another session may share this checkout. Run `git branch --show-current` before editing, and
  leave the branch where you found it.
- An agent lane works in its own linked worktree. Lefthook's post-checkout hook
  ([lefthook.yml](lefthook.yml)) sets it up: it links `.env` and `.env.local` from the main
  checkout and runs `pnpm install`. `pnpm install` in the main checkout installs the hook.
- Never ask Huey to type approval comments. Ask him in chat, then record his chat decision on the
  issue as a neutral owner-decision statement, never a quote, as
  [ADR 0006](.decisions/0006-pitch-approval-from-chat-ruling.md) says.
- The default branch is `huey/landing-page` for now (the redesign lives there and `dev` does not have it yet); pull requests target it. Branches you create by hand start with
  `huey/`. Fabrika lanes name their own branches.
- Decisions live in `.decisions/` as `NNNN-slug.md`. Filenames plus each record's frontmatter
  (`id`, `title`, `status`) are the index. Read the records that govern a choice before changing
  it, and record a new decision with the `adr` skill. CI reds a duplicate id or a filename that
  disagrees with its frontmatter (`pnpm exec fabrika guard decisions-index validate`).
- Use the definitions in [.glossary/TERMS.md](.glossary/TERMS.md) (domain nouns) and
  [.glossary/LANGUAGE.md](.glossary/LANGUAGE.md) (architecture terms) when you name or change a
  concept. Update them with the `glossary` skill when a name is coined or redefined.
- Before a change, read the rows of [.patterns/index.md](.patterns/index.md) that match it, and
  follow the docs they link. Update a doc when your change moves the shape it describes.
- Rendered UI follows [design-system-manifest.md](design-system-manifest.md). Its source is the
  Pencil design in `design/` (`prt-website.pen` plus `HANDOFF.md`). Open `.pen` files only
  through the Pencil MCP tools.

## Work flows through Fabrika

Every unit of work is a GitHub issue that moves report → triage → build → review → ship.
[CLAUDE.md](CLAUDE.md) maps each intent to its skill and agent; the `fabrika` CLI's verbs are the
ground truth at every step.

- New work starts as an issue, labelled `status:needs-triage`.
  [`triage`](https://github.com/kamp-us/phoenix/blob/main/claude-plugins/fabrika/skills/triage/SKILL.md)
  types it, prioritises it, and homes it on a milestone that [ROADMAP.md](ROADMAP.md) pins.
- One issue becomes one pull request, built by the matching shell: **builder** for code and
  prose, **ui-builder** for a rendered surface, **mixed-builder** for both. An
  [`operate`](https://github.com/kamp-us/phoenix/blob/main/claude-plugins/fabrika/skills/operate/SKILL.md)
  lane drives the whole run.
- Every agent posts from the active `hueypov` account, reviews included, and never switches
  account. A reviewer is never the agent that built the change: it is a different agent from the
  builder. It posts SHA-bound verdicts:
  [`review`](https://github.com/kamp-us/phoenix/blob/main/claude-plugins/fabrika/skills/review/SKILL.md)
  for text,
  [`review-ui`](https://github.com/kamp-us/phoenix/blob/main/claude-plugins/fabrika/skills/review-ui/SKILL.md)
  for rendered surfaces, and
  [`governance`](https://github.com/kamp-us/phoenix/blob/main/claude-plugins/fabrika/skills/governance/SKILL.md)
  for a diff that touches a governed root in [.fabrika.jsonc](.fabrika.jsonc). A builder does not
  review its own change, and a reviewer does not fix what it finds.
- Only the **shipper**
  ([`ship`](https://github.com/kamp-us/phoenix/blob/main/claude-plugins/fabrika/skills/ship/SKILL.md))
  merges, and only when every required verdict is PASS at the head commit.
- `ready-for:human` holds an issue or pull request for Huey (@hueypov).
- Work you notice but will not do now goes in its own issue through
  [`report`](https://github.com/kamp-us/phoenix/blob/main/claude-plugins/fabrika/skills/report/SKILL.md),
  at the moment you find it.

## Home documents

Keep each fact in the document that owns it, and link to it from elsewhere.

| Home | Owns |
|---|---|
| [README.md](README.md) | Setup, environment and common commands |
| [CLAUDE.md](CLAUDE.md) | Which Fabrika skill and agent handle each kind of work |
| [.fabrika.jsonc](.fabrika.jsonc) | Fabrika's settings here: UI surfaces, validators, CI gate, governed roots |
| [.github/CODEOWNERS](.github/CODEOWNERS) | Who approves changes to governed files |
| [ROADMAP.md](ROADMAP.md) | Arcs and campaigns, each pinned to a milestone that triage homes issues on |
| [design-system-manifest.md](design-system-manifest.md) | Rendered UI law |
| `.decisions/` | Decisions, their rationale and history |
| [.glossary/](.glossary/TERMS.md) | Canonical terms: domain nouns in `TERMS.md`, architecture terms in `LANGUAGE.md` |
| [.patterns/](.patterns/index.md) | How the code is shaped today, and when to read each pattern |
| [docs/dashboard-rules.md](docs/dashboard-rules.md) | Dashboard rules: who sees each page and the conditions behind each action |
