# 0001 — Reuse website-v2 as the base; every line of it is changeable

**What this decides:** The redesign happens inside the existing website-v2 repo rather than a fresh scaffold — but as a convenience of history, not a preservation order: any file, dependency, schema or convention in it may be rewritten, replaced or deleted when the new design calls for it.

## Decision

**website-v2 is the working repo for the ground-up site, and no part of it carries protected status.**

The Next.js + React + Tailwind + Better Auth + Drizzle/Neon stack is today's starting point because it exists and works — not because it is decided. Any piece may be swapped (framework included) if a concrete need appears; such a swap gets its own ADR before the work starts.

**Binding constraints.**
- Replacements must land complete: an old route/page is deleted in the same change that introduces its successor, never left dangling or half-migrated.
- Stack changes are ADR-worthy events, one record each.

## Context

Earlier framing treated the auth/dashboard plumbing and stack as fixed reuse. Corrected per team ruling (2026): nothing on v2 is unchangeable; only the repo continuity itself is the decision.

## Records

no vocabulary impact
