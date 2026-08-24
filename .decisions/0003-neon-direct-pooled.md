# 0003 — Neon Postgres direct with pooled connections; no host-managed Postgres

**What this decides:** The database stays Neon Postgres accessed directly from the app — never through Vercel/Netlify-managed Postgres integrations — over a pooled connection string.

## Decision

**Neon is accessed directly (own account, own `DATABASE_URL`), connections go through Neon's pooled endpoint, and heavy reads are cached in the app rather than re-queried per view.**

Reasoning:
- Vercel Postgres is Neon resold through the host; using it would couple DB lifecycle to the host we deliberately keep exitable (0002).
- Serverless functions open connections per instance; the unpooled endpoint exhausts Postgres connection limits on traffic bursts before any usage quota is reached.
- The member directory (~150 rows, rare mutations) is read-cached app-side (`unstable_cache` + `revalidateTag` on member mutations), not fetched per dashboard view — this was the cause of earlier free-tier compute burn.

**Binding constraints.**
- `DATABASE_URL` points at Neon's pooled endpoint; direct (unpooled) is reserved for migrations only.
- No host-marketplace database integrations.
- Full-directory reads are cached with tag invalidation from the mutations that change membership.
- Self-host migration path stays `pg_dump` → own Postgres + one env var change; schema stays plain Drizzle SQL with nothing host-specific.

## Context

Schema (roles typed president/head/lead/core scoped by dept/division, date-ranged) already supports division-scoped visibility; runtime cost came from uncached full-table joins per view, addressed by the caching constraint above rather than schema changes.

## Records

no vocabulary impact
