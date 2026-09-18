# 0002 — Deploy on Vercel Hobby; keep the app host-agnostic so Netlify or self-hosting stays a config change

**What this decides:** Vercel's free tier is the deploy target today. App code must never import anything host-specific, so a move to Netlify or a self-hosted Node server is a config/deploy-pipeline change only.

## Decision

**Deploy to Vercel (Hobby) for now.** If its limits bite again, migrate to Netlify free or self-host — the app must make that a half-day change, not a rewrite.

Accepted risk, from prior experience: Vercel Hobby's per-function bundle-size ceilings have failed this app's deploys before (heavy deps: Better Auth, Drizzle, AWS SDK, zod, nodemailer). Mitigation is dep hygiene when build output shows bloat — not an immediate work item.

**Binding constraints.**
- Zero host-specific APIs in `app/`, `lib/`, `db/` — all host config lives in platform dashboards / config files at the repo root.
- The production shape that must keep working anywhere: plain Node (`next build && next start`).
- Email sending goes through a swappable provider abstraction, never through host integrations.
- If any free-tier metric trends past ~60% of its monthly allowance, raise it rather than silently upgrading plans.
- Migration triggers worth acting on: repeated bundle-size deploy failures, or sustained >60% on any metered metric.

## Context

Netlify free was decided earlier (2026) because of those bundle-size failures. Team ruling superseded it the same day: use Vercel for now, migration path preserved instead. This record supersedes the hosting half of the earlier decision; the runtime-cost analysis in it (static-heavy site, CDN-cached landing, lightly-used dashboard) still holds and applies to either host. Database choice is separate — see the database ADR.

## Amendments

- **#0005 — Vercel Hobby's non-commercial clause named as an accepted risk; Cloudflare re-checked and rejected on CPU time, not bundle size (2026-09-18).**

## Records

no vocabulary impact
