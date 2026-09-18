# 0005 — Stay on Vercel Hobby and knowingly accept its non-commercial clause, never pay to dodge it

**What this decides:** Hosting was re-opened on 2026-09-18 because the team has no budget and Cloudflare looked cheaper. It isn't. We stay where we are, on the free plan, with our eyes open about the one term that could bite us.

## Decision

**The site stays on Vercel Hobby at zero cost, and the non-commercial clause in Vercel's terms is an accepted risk rather than a reason to migrate or to pay.**

Vercel's Hobby docs say the plan "restricts users to non-commercial, personal use only." The team's site sells nothing, takes no payments and runs no store. Sponsor logos are credit for support, not commerce. That reading is ours, not Vercel's, so it can be overruled by them at any time — which is exactly why 0002 keeps the exit cheap.

If Vercel ever rules against us, we do not upgrade. We leave. The team budget for hosting is zero and stays zero.

**Binding constraints.**
- No paid hosting plan without a team ruling. Not $5/month, not $20/month.
- Nothing about the site may become commercial while it is on Hobby: no payments, no store, no paid placements. Sponsor logos and credit are fine.
- If Vercel contacts us about the clause, execute 0002's exit instead of upgrading. Self-hosting on a Politecnico box is the first destination to try.
- 0002's other triggers still stand: repeated bundle-size deploy failures, or any metered metric sustained past ~60%.
- Re-check this record before adding anything that takes money through the site.

## Context

**Cloudflare Workers was checked properly on 2026-09-18 and rejected.** The old objection — a 3 MB compressed worker bundle cap on free, 10 MB on paid — is dead. Cloudflare removed it on 2026-09-04 and now checks only uncompressed size, 64 MiB on every plan; gzip size is reported but no longer enforced. Source: https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/ — do not re-raise the bundle cap as an objection. (Check a bundle with `wrangler deploy --outdir bundled/ --dry-run`; the `Total Upload` figure is the one that counts.)

The objection that killed it is a different one: **Workers Free allows 10 ms of CPU per request.** This is CPU only — waiting on a Neon query does not count — so the question is purely how long our JS runs. Cloudflare answers it themselves on the limits page: "Heavier workloads that handle authentication, server-side rendering, or parse large payloads typically use 10-20 ms." That is exactly our dynamic routes, against a 10 ms ceiling.

It would not fail cleanly either. An isolate flexes for the odd overrun, but a route that hits the limit consistently is terminated and the visitor gets Error 1102, "Worker exceeded resource limits." Intermittent 1102s on the dashboard are worse than a plain no. Workers Paid lifts that to 5 minutes and carries no non-commercial clause, at $5/month — rejected because the budget is zero, not because it is a bad plan. If money ever appears, it is the first option to reconsider, and with the bundle cap gone it is a better option than 0002 assumed.

**Vercel Hobby, for the record:** free, no card, 100 GB bandwidth a month, functions up to 5 minutes, auto-deploy on push. Over a limit the project pauses for 30 days rather than billing. Generous enough that traffic is not the concern here; the terms are.

**The exit was verified, not assumed.** On 2026-09-18 a grep of `app/`, `lib/`, `db/` and `components/` found zero Vercel-specific imports; the only `vercel` package is the deploy CLI. Self-hosting is a Node box running `next build && next start` behind nginx, plus the env vars. Neon, R2 and email are already external and do not move (0003). Estimated half a day, mostly DNS and certificates.

## Records

no vocabulary impact
