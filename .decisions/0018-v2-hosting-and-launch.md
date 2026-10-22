---
id: 0018
title: "v2 uses the Neon project the Vercel integration made, keeps production on its own branch, and launches unindexed on v2.politorocketteam.it first"
status: accepted
date: 2026-10-22
tags: [hosting, database, neon, vercel, launch]
---

# 0018 — v2 uses the Neon project the Vercel integration made, keeps production on its own branch, and launches unindexed on v2.politorocketteam.it first

**What this decides:** The site's database is the Neon project that the Vercel integration created. Production is that project's `main` branch, previews keep the `preview` branch, and a new `development` branch serves the Vercel Development environment, so `vercel env pull` never brings production's connection strings. v2 goes live first on v2.politorocketteam.it, deployed from the GitHub branch `main` and hidden from search engines; politorocketteam.it moves to it later.

## Context

Decided 2026-10-22 by the project owner in chat, while the v2 launch was set up. The decisions are recorded as neutral owner-decision statements at https://github.com/PoliTo-Rocket-Team/website-v2/issues/555#issuecomment-6340615126, as [ADR 0006](0006-pitch-approval-from-chat-ruling.md) says. The settings below were already applied when this record was written; it records them and changes none of them.

Two records described the old setup. [ADR 0003](0003-neon-direct-pooled.md) ruled out a database managed through the host, and [ADR 0016](0016-previews-read-their-own-seeded-branch.md) Decision 9 allowed the Neon integration only in the form that links the project's own Neon account, with a connection that covered Production and Development alike. An agent reading them could move the hosting back. This record amends both in part; the lines it replaces are listed below.

## Decision

**The database is the Neon project the Vercel integration made, with production, previews and development each on their own branch, and v2 launches unindexed on v2.politorocketteam.it before it takes politorocketteam.it.**

1. **One Neon project, made through the Vercel integration.** The database is the Neon project `neon-cinereous-pendant` (id `hidden-sky-22757123`), created through the Neon integration for Vercel. The separate PoliTo-org project `web-v2` held only old data and was deleted.
2. **Three branches, one per environment.**
   - `main` is production.
   - `preview` serves Vercel previews only, as ADR 0016 says.
   - `development`, copied from `preview`, is the Vercel Development environment. So `vercel env pull` brings the `development` branch's connection strings and never production's.
   - The production database variables are set for the Vercel Production environment only. `BETTER_AUTH_URL=https://v2.politorocketteam.it` is set for Production.
3. **Launch on v2.politorocketteam.it first.**
   - v2 goes live on v2.politorocketteam.it, deployed from the GitHub branch `main`, which is the Vercel production branch.
   - `SITE_INDEXABLE` stays unset there, so search engines do not index it ([#549](https://github.com/PoliTo-Rocket-Team/website-v2/issues/549), PR [#552](https://github.com/PoliTo-Rocket-Team/website-v2/pull/552)).
   - The team uses it with real data while the remaining work is finished. Later politorocketteam.it, now on Netlify, moves to it and `SITE_INDEXABLE=true` is set.
   - The GitHub branch `main` is protected: a pull request, CI (`ci-required`) and the secrets scan are required, and force-push and deletion are blocked.
   - The test site v2dev.politorocketteam.it stays on the `preview` branch.

**What this replaces in ADR 0003.** These lines stay as written and no longer bind:
- the title's "no host-managed Postgres", and the "What this decides" line's "never through Vercel/Netlify-managed Postgres integrations";
- the Decision's "(own account, own `DATABASE_URL`)", where it means a Neon account apart from the host's integration;
- the first reasoning bullet ("Vercel Postgres is Neon resold through the host …");
- the binding constraint "No host-marketplace database integrations".

These lines of 0003 still stand: the pooled `DATABASE_URL`, with the direct string reserved for migrations (and ADR 0016's bounded exception for the preview build step); the app-side cache of full-directory reads; and the exit path, `pg_dump` to an own Postgres with one variable changed and a schema with nothing host-specific.

**What this replaces in ADR 0016.** These lines stay as written and no longer bind:
- Decision 9 ("Previews connect through the project's own Neon account …"), in full;
- the binding constraint "No database created or billed through the host ([ADR 0003](0003-neon-direct-pooled.md)); the Neon integration only links the project's own Neon account";
- the first amendment's "which connects Production and Development only", where it says one integration connection covers Production and Development on the same database setup. Production now reads `main` and Development reads `development`.

Everything else in 0016 still stands: Decisions 1 to 8, the `preview` branch and its endpoint `PREVIEW_ENDPOINT` in [lib/seed/target.ts](../lib/seed/target.ts), the seed guard, the other binding constraints and every later amendment. The `preview` branch is the same one 0016 describes (created 2026-10-16 from `main` in this project), so its endpoint is unchanged.

**Binding constraints.**
- Production reads only the Neon `main` branch, and its connection strings are set for the Vercel Production environment only.
- The Vercel Development environment reads the `development` branch, never `main`.
- `SITE_INDEXABLE` stays unset until politorocketteam.it moves to v2.
- The GitHub branch `main` stays protected as Decision 3 says.
- Changing a Vercel, Neon or GitHub setting or an environment variable is an owner action; a build documents it and does not change it.

## Consequences

- A developer who runs `vercel env pull` gets the `development` branch, so local work cannot reach production through those strings.
- The seed guard in [lib/seed/target.ts](../lib/seed/target.ts) refuses the `development` branch, as it refuses every Neon endpoint but `preview`'s. `pnpm db:seed` runs only on a local database, or on the `preview` branch from a Vercel preview build.
- Database billing now runs through the Vercel integration. Moving off the host still goes through the `pg_dump` exit path 0003 keeps.
- The team checks real data on v2.politorocketteam.it before the main domain moves, so search engines never index a site that is still being finished.
