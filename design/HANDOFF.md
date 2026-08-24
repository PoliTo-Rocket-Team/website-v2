# PRT website redesign — handoff (2026-08-24)

Redesign of politorocketteam.it. **Design-first in Pencil; no website code until design approved.**
Landing page design is APPROVED. Now designing subroutes.

## Files
- Everything lives in the `website-v2` repo now (moved 2026-08-24 so sessions start at repo root and threejs skills auto-load).
- Pencil doc (the only working file): `website-v2/design/prt-website.pen`. STALE copies exist at `~/.pencil/documents/413de05c-.../` and `~/Documents/projects/test/prt-design/` — never edit those.
- Images live NEXT TO the .pen file (referenced as `./name.png`). Partner logos in `./sponsors/` (use `color-*.png` versions).
- Site stack: Next.js, Tailwind, shadcn, Better Auth magic link + Google, Drizzle + Neon, Vercel.
- `.claude/skills/` has threejs-* skills — USE THEM for any 3D work.

## Hard rules
- NEVER modify boards 00–03 (`Bqh4w` 00 Tokens, `lKPB9` 01 Navbar, `LJCAP` 02 Buttons & Pills, `H4S7dd` 03 Cards, `onDQB` 04 Form fields, `X45Jje` 03 Landing draft). New ideas → new boards.
- User style: plain language, ≤6 lines per message, one yes/no question at a time, recs with why + tradeoffs + confidence. No em dashes in site copy. Verify visually with Export (note: unfilled nested frames export dim — add `fill:"$ground"` to parents; it's fine in Pencil itself).
- Branch prefix `huey/`, GitHub via `gh`, user handle `hueypov`.

## Approved landing page = these boards, in page order
1. `dXIoU` 04 Hero (+ `SOhKN` 04a load-in, `cFTg5` 04b scroll 30%, `A0XGR` 04c scroll 60%). Team name 90px, "BORN FOR SPACE", body text, footer strip "EST. 2021 · TORINO, ITALY …". **Starfield added to idle board only** (`T7pTl4`): 34 dim stars + 8 navbar stars; mirror to 04a/b/c when final. Plume smoke/shake/zoom = Three.js stage later.
2. `EcEwO` 05 "Latest" (track record): header "TRACK RECORD / We fly against the best student teams on earth." + featured post card + 3-row list + centered "All news →". Posts come from dashboard posts table. Tag colors: Launch=accent, Competition=warning, Outreach=success, Team=white-10.
3. `qXl0e` 06 Projects section: header "Three flown. A fourth on the pad." + 4 cards. Cavour card (`iaTkL`): rocket render INSIDE card, tilted 16°, nose stays inside border; tail fades under text (gradient rect). Hover (`Q7XFK1`): scales ~15% in place ("toward viewer"), rotates to 12°, nose pops out of top-right corner; card fill surface-2, stroke border-strong; ≈`transform: scale(1.15) rotate(4deg)`, 300ms ease-out. Other 3 cards empty until renders exist. Render file: `cavour-render-vert.png`.
4. `mi7Mb` 07 Inside the team: title left "Who's behind the rockets." intro "People who design, machine, solder, test and fly the vehicle themselves, between lectures and exams." Links right (03-style rows): 01 The Team ("The 150+ people flying this year's vehicle"), 02 Alumni ("Everyone who got us off the ground since 2021"), 03 Our University ("Where the team studies, builds and gets its funding"), 04 Mission & Vision ("What we're trying to prove, and where it's going").
5. `b46m8` 08 Partners: "Their logos fly with the rocket." + logo marquee (right→left loop ~40s, pause on hover) + "Become a partner" → mailto to team address. In Pencil the strip is unclipped/full-length for review; on site it clips + edge-fades. BETA CAE is styled text (their SVG is broken UTF-16 — get a clean file). Magicar/Mul2 logos are low-res (user kept them).
6. `gDMOf` 09 Apply band (orange): "Build with us." / "Open to every student. No rocketry experience required. We learn together." / Apply to join button / "6 POSITIONS OPEN NOW" = live count from dashboard positions table, hidden at 0.
7. `xLYRW` 10 Footer: 4 columns; About order = The Team, Alumni, Our University, Mission & Vision; Projects = Cavour, VES, VES Mark II, Efesto (no "All projects"). **Starfield bg** (`eUZY1`, ~52 stars, few twinkle) + shooting star every ~20s upper half. Stars ONLY on hero + footer (bookends) — user rejected stars on middle sections.

## Animations (all agreed with user)
- **Hero — SUPERSEDED by website-v2 `.decisions/0004-hero-entrance-and-liftoff.md` (2026-08-24, user rejected pinning + scroll dimming).** Built: gathered title+slogan block staggers in → ~2s hold → block separates while rocket drives in slowly from left (~4.5s, heavy SpaceX pace, shader plume) → settles center. One-shot lift-off at ~18% scroll; full replay when hero fully visible again. No PNG fallback (no-WebGL = text only). No vibration/shake — bob only. Boards 04a/b/c are design history now.
- **Projects card hover:** rocket scales ~15% IN PLACE ("toward the viewer" — user explicitly rejected sliding up) + rotates 16°→12°; nose crosses the top-right border because it grows, not because it moves. Card fill → surface-2, stroke → border-strong. 300ms ease-out. ≈ `transform: scale(1.15) rotate(4deg)`, transform-origin center, on the rocket img.
- **Partners marquee:** logos scroll right→left, continuous loop ~40s, pause on hover. Full-color logos (user rejected grayscale). Edge fade masks on site only (removed in Pencil for review).
- **Footer starfield:** stars fixed, a few brighter ones twinkle slowly (opacity pulse). One shooting star streaks across the upper half every ~20s. Same field (dimmer, sparser) behind hero navbar + team name. Stars ONLY hero + footer.
- All doable in CSS except the hero (Three.js).

## Site structure decisions
- Public: `/` landing; `/projects` index (board `yDRL8` 11, in progress); `/projects/[slug]`; `/about/{the-team,alumni,our-university,mission-vision}`; `/outreach`; `/partners`; `/apply` = list of open positions LINKING TO UNI SITE (no application form on our site, no positions on landing); news post page for "Read the record".
- Navbar: Projects · About · Outreach · Partners | Apply (orange pill) + Sign in ghost. Logged in: Apply + name+avatar.
- Members data: joined/left dates on member rows. Active = no leave date → "The Team" page. Alumni = grouped by academic year computed from date ranges. No yearly maintenance.
- Posts written in dashboard → landing "Latest".
- PoliTo funds 28% of team budget (use on partners/university pages).

## In progress
- Board `yDRL8` 11 = /projects index: solid navbar copy, H1 "Every vehicle since 2021.", 4 full-width rows (render left, meta/name/desc/specs right). Cavour uses `cavour-hero.png`; others "RENDER TBD". **Specs/dates are placeholder guesses — confirm with user.** Awaiting user feedback on row layout.

## Todo / open
- Subroutes to design: /projects/[slug] (next after index), /apply, /about pages, news post page, /outreach, /partners.
- Full-page assembly board of landing (user hasn't said yes yet).
- Mirror hero starfield to 04a/b/c once hero final.
- Real renders for VES, VES Mark II, Efesto; clean BETA CAE + better Magicar logos.
- Real specs for all vehicles; VES Mark II 2025 IREC result wording verify.
- ~~Three.js hero stage~~ DONE 2026-08-24 in website-v2 `components/landing/hero.tsx` + `hero-rocket-3d.tsx` (pinned scroll hero, cavour.glb with GLB plume meshes stripped, sprite plume, bob/shake, fly-in). Verify with `node scripts/shoot-hero.mjs <outdir>`.
- React vs Next.js final call (leaning: keep website-v2 Next.js stack).
- prt-3d roadmap.md step numbering is stale.
