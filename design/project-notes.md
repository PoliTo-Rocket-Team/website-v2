# PRT website — project notes

Ground-up rewrite of politorocketteam.it. Not just a landing page: it's also a dashboard.

## What it is
- Public site (landing, projects, team, outreach, partners, open positions).
- No apply form on our site. `/apply` page = list of open positions, each links out to the university's application site. Landing page has no positions list — just the Apply CTA → `/apply`.
- Dashboard behind login (recruiting: applications, positions, members — exists in `website-v2`).
- Navbar gets a Sign in / Log in button (maybe more: profile menu when logged in).

## Pages
- Not decided yet which old pages stay, change, or get added. Decide page by page.
- Current 03 board sections are a draft, not a final sitemap.

## Prior work
- `~/Documents/projects/website-v2` — earlier attempt. Stack: Next.js, Tailwind, shadcn/Radix, Better Auth (magic link + Google), Drizzle + Neon Postgres, Vercel.
- Existing routes there: `/`, `/apply`, `/login`, `/sign-in`, `/sign-up`, `/reset-password`, `/dashboard`, `/dashboard/applications`, `/dashboard/positions`, `/dashboard/members`.
- Auth + dashboard logic from website-v2 can likely be reused; the UI gets redesigned.

## Design
- Design first in Pencil (`prt-website.pen`), code only after approval.
- Brand: orange #FF5100, existing logo. Dark ground #0B0B0C.
- Tokens live as Pencil variables (ground, panel, hairline, text, muted, accent, it-green, it-red, Archivo, Geist Mono).
- Components in Pencil (done Aug 23 2026): 00 Tokens, 01 Navbar, 02 Buttons & Pills, 03 Cards, 04 Form fields.
- Navbar: Projects · About · Outreach · Partners | Apply (orange) + Sign in. Logged in: name + avatar chip. Logo = mark only (`prt-mark.png`).
- Priority: landing page first. Hero is mostly done.

## Landing page content
- Section 1 under the hero = "Latest": news/posts cards (launches, outreach, team, competitions). Posts are written in the dashboard (own posts table: title, excerpt, image, tag, date, link). Newest first.
- Competition results become a thin stats strip, not a full section.

## Open
- React vs Next.js (website-v2 is Next.js — strong reason to stay).
- Navbar: which links, logged-in vs logged-out state.

## Members data (decided 2026-08-23)
- Members have joined/left dates. Active = no leave date.
- "The Team" page = active members. "Alumni" = grouped by academic year, computed from date ranges.
- Landing S3 = title left + 4 links right: The Team, Alumni, Our University, Mission & Vision (board 07).

## 2026-08-24
- Landing page design APPROVED (boards 04–10). See HANDOFF.md for full state + rules.
