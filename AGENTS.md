# PoliTo Rocket Team website

The team's public site and its members' dashboard: one Next.js app (App Router, React 19) at the
repo root. Pages live in `app/`, shared components in `components/` (shadcn/ui primitives on Radix
in `components/ui/`), server helpers in `lib/`, and the Drizzle schema in `db/schema/` with its
generated migrations in `drizzle/`. Data is Neon Postgres, auth is Better Auth, styling is
Tailwind 3. Local email goes through Mailpit (`mailpit/`).

## Working rules

- Use `pnpm`, and `pnpm exec` / `pnpm dlx` in place of `npx`. The scripts are in
  [package.json](package.json); [README.md](README.md) explains setup.
- Run locally: copy `.env.example` to `.env`, then `pnpm db:migrate`, `pnpm db:seed`,
  `pnpm mailpit:start` (needs Docker) and `pnpm dev`. Mailpit's inbox is at http://localhost:8025.
- Change the schema in `db/schema/`, then `pnpm db:generate`, read the new SQL in `drizzle/`, and
  `pnpm db:migrate`. Keep generated migrations as generated.
- The check every change passes is `pnpm exec tsc --noEmit`, the same one CI runs
  ([ci.yml](.github/workflows/ci.yml)). `pnpm build` prerenders pages that query Neon, so it
  needs `DATABASE_URL`.
- Another session may share this checkout. Run `git branch --show-current` before editing, and
  leave the branch where you found it.
- The default branch is `dev`; pull requests target it. Branches you create by hand start with
  `huey/`. Fabrika lanes name their own branches.
- Decisions live in `.decisions/` as `NNNN-slug.md`. Filenames plus each record's frontmatter
  (`id`, `title`, `status`) are the index. Read the records that govern a choice before changing
  it, and record a new decision with the `adr` skill. Records 0001–0005 exist on the unmerged
  `huey/landing-page` branch; take the next free number after them.
- Rendered UI follows [design-system-manifest.md](design-system-manifest.md). Its source is the
  Pencil design in `design/` (`prt-website.pen` plus `HANDOFF.md`, arriving with
  `huey/landing-page`). Open `.pen` files only through the Pencil MCP tools.

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
- A reviewer is never the pull request's author. It posts SHA-bound verdicts from its own GitHub
  account with write access:
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
| [mailpit/EMAIL_SETUP.md](mailpit/EMAIL_SETUP.md) | Local email testing |
