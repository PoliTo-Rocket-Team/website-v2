---
id: 0003
title: "Neon Postgres direct with pooled connections; no host-managed Postgres"
status: amended-in-part by [0016](0016-previews-read-their-own-seeded-branch.md), [0018](0018-v2-hosting-and-launch.md)
date: 2026-08-24
---

# 0003 — Neon Postgres direct with pooled connections; no host-managed Postgres

**What this decides:** The database stays Neon Postgres accessed directly from the app — never through Vercel/Netlify-managed Postgres integrations — over a pooled connection string.

> Amended in part by [ADR 0018](0018-v2-hosting-and-launch.md) (2026-10-22): the database is now the Neon project the Vercel integration made. The "no host-managed Postgres" title, the "never through … integrations" clause above, the "own account" in the Decision, the first reasoning bullet and the binding constraint "No host-marketplace database integrations" no longer bind. The pooled connection, the caching rule and the `pg_dump` exit path stand.

## Decision

**Neon is accessed directly (own account, own `DATABASE_URL`), connections go through Neon's pooled endpoint, and heavy reads are cached in the app rather than re-queried per view.**

Reasoning:
- Vercel Postgres is Neon resold through the host; using it would couple DB lifecycle to the host we deliberately keep exitable (0002). *(Replaced by [ADR 0018](0018-v2-hosting-and-launch.md).)*
- Serverless functions open connections per instance; the unpooled endpoint exhausts Postgres connection limits on traffic bursts before any usage quota is reached.
- The member directory (~150 rows, rare mutations) is read-cached app-side (`unstable_cache` + `revalidateTag` on member mutations), not fetched per dashboard view — this was the cause of earlier free-tier compute burn.

**Binding constraints.**
- `DATABASE_URL` points at Neon's pooled endpoint; direct (unpooled) is reserved for migrations only.
- No host-marketplace database integrations. *(Replaced by [ADR 0018](0018-v2-hosting-and-launch.md).)*
- Full-directory reads are cached with tag invalidation from the mutations that change membership.
- Self-host migration path stays `pg_dump` → own Postgres + one env var change; schema stays plain Drizzle SQL with nothing host-specific.

## Context

Schema (roles typed president/head/lead/core scoped by dept/division, date-ranged) already supports division-scoped visibility; runtime cost came from uncached full-table joins per view, addressed by the caching constraint above rather than schema changes.

## Records

no vocabulary impact
