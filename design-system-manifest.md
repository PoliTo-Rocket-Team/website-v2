# Design system manifest

The design law for the PoliTo Rocket Team website. Build and review of any rendered change
read this page. It records the approved redesign as the code defines it. It invents nothing:
each rule cites the file it comes from.

**What rules when sources disagree.** Code is the source for numbers (`tailwind.config.ts`,
`app/globals.css`, `components/landing/`). Design intent comes from `design/HANDOFF.md`.
`.decisions/0004-hero-entrance.md` and `design/handoff-hero-rocket.md` are newer and override
HANDOFF where they speak. Hero timing lives in `components/landing/hero.tsx`; ADR 0004 says to
trust that code over the ADR. Unsettled conflicts are listed under "Open gaps".

## Stack

- Next.js App Router. The redesigned landing page is `app/page.tsx`, built from
  `components/landing/`. Routes not yet redesigned sit under `app/(legacy)/` with the old chrome
  (`app/(legacy)/layout.tsx`).
- Tailwind CSS 3 (`tailwind.config.ts`) plus `tailwindcss-animate`. shadcn/ui primitives in
  `components/ui/` (`components.json`: style `default`, CSS variables on).
- Three.js through `@react-three/fiber` for the hero rocket and the project card rockets
  (`hero-rocket-3d.tsx`, `rocket-card-3d.tsx`, `rocket-cavour.tsx`, `hero-plume.tsx`,
  `hero-weathering.ts`).
- The site is dark only. `app/layout.tsx` sets `defaultTheme="dark"`, `enableSystem={false}`,
  and paints `<html>` with `#0B0B0C` and `color-scheme: dark` before CSS loads.

## Colour

The PRT tokens in `tailwind.config.ts` (marked "Pencil variables, board 00") are the palette
for redesigned surfaces.

| Role | Token | Value |
|---|---|---|
| Page ground | `ground` | `#0B0B0C` |
| Card / panel | `panel` | `#141416` |
| Hovered card | `surface-2` | `#1C1C1F` |
| Hairline border | `hairline` | `#232326` |
| Hovered border | `border-strong` | `#34343A` |
| Primary text | `prt-text` | `#F2F2F0` |
| Secondary text, links | `text-2` | `#C9C9CE` |
| Muted body copy | `prt-muted` | `#8A8A8F` |
| Labels, numbers, meta | `dim` | `#5E5E64` |
| Brand accent | `accent` / `-hover` / `-pressed` | `#FF5100` / `#FF6A26` / `#E04700` |
| Accent tint, text on accent | `accent-soft`, `accent-on-accent` | `#FF510024`, `#0B0B0C` |
| Overlays | `white-5`, `white-10` | 5% and 10% white |
| Status | `success`, `warning`, `danger` (+ `-soft`) | `#2E9B4F`, `#F5A623`, `#CE2B4B` |

Rules:

- Orange `accent` is the one brand colour. Use it for section eyebrows, the Apply pill,
  hover text, and the Launch tag. Do not add a second accent.
- Tags and status pills pair a `-soft` fill with the solid text colour: Launch = accent,
  Competition = warning, Outreach = success, Team = `white-10` with `prt-text`
  (`latest.tsx`, HANDOFF board 05). Project status: Flown = success, In design = warning
  (`projects.tsx`).
- The legacy palettes `rocket`, `space`, `mission`, `cosmos` and the shadcn role variables in
  `app/globals.css` serve `app/(legacy)/` and `components/ui/` only. Do not use them on a
  redesigned surface. Note the shadcn `accent` name is taken by the PRT orange
  (`tailwind.config.ts` comment).
- Use a token, not a hex value, in components. Code holds these deliberate exceptions, each with
  a comment: hero sky `#010101` (the earth photo's measured black, `hero.tsx`), star-dimming
  radial fades (`hero.tsx`, `navbar.tsx`), the Apply band `#EE4A00` (`apply-band.tsx`), the
  `.hero-type` gradient (`app/globals.css`), and the `RocketArrow` SVG fills (`rocket-arrow.tsx`).
  A new exception needs the same kind of comment.

## Type

- Two families, loaded in `app/layout.tsx` with `next/font/google`:
  - `font-display` = Archivo (weights 400 to 900). The body default.
  - `font-mono` = Geist Mono. Eyebrows, dates, tags, spec labels, footer meta, fact strip.
- Do not add a third family without a decision record.
- Patterns in code (`latest.tsx`, `projects.tsx`, `inside-team.tsx`, `partners.tsx`):
  - Eyebrow: `font-mono text-xs tracking-[0.3em] text-accent`, uppercase.
  - Section title: `text-4xl md:text-5xl font-bold leading-tight tracking-tight`.
  - Body: `text-sm leading-relaxed text-prt-muted`.
  - Spec label / value: `font-mono text-[10px] tracking-widest text-dim` over
    `font-mono text-xs text-text-2`.
- Hero type is fixed in px on a 1440 x 900 board: title 90px extrabold, slogan 148px extrabold,
  body 22px, fact strip 11px mono (`hero.tsx`). Title and slogan words use `.hero-type`: a white
  to grey gradient clipped to text, with `drop-shadow` (not `text-shadow`), set on each animated
  word span, not the heading (`app/globals.css`, `handoff-hero-rocket.md` §5).
- Site copy has no em dashes (HANDOFF, hard rules).

## Spacing, layout, shape

- Content width: `max-w-[1312px]` centred. Navbar and partner strip use `max-w-[1440px]`.
- Section padding: `px-6 py-24 md:px-16`. Sections after Latest are split by
  `border-t border-hairline`.
- Section header: eyebrow and title left, intro or link right, `md:flex-row md:items-end`,
  then content at `mt-14`.
- Grids: Latest `lg:grid-cols-[1.2fr_1fr]`; Projects `sm:grid-cols-2 xl:grid-cols-4`;
  Inside the team `lg:grid-cols-[600px_1fr]`; grid gap `gap-4`.
- Radii: cards `rounded-[10px]`; inset photos `rounded-[6px]`; buttons, pills and tags
  `rounded-full`. The shadcn `--radius` (`0.5rem`) is for `components/ui/` only.
- Cards: `border border-hairline bg-panel`. Hover: `border-border-strong`, and `bg-surface-2`
  where the card fill changes (`projects.tsx`).
- The hero is a fixed 1440 x 900 board. It scales down only, by
  `min(1, vw/1440, vh/900)`. Section height is clamped to 900 to 1080 board px. An inline script
  sets `--hero-scale` and `--hero-h` before first paint (`hero.tsx`).

## Components

- Buttons: Apply = accent pill (`bg-accent`, hover `accent-hover`, active `accent-pressed`,
  text `accent-on-accent`). Sign in = ghost pill (`border-white-10`, hover `border-strong`)
  (`navbar.tsx`, HANDOFF). On the orange band the button inverts to `bg-ground`
  (`apply-band.tsx`).
- Text links with an arrow use `RocketArrow` (`components/landing/rocket-arrow.tsx`), not a
  `→` glyph. Hover: link to `text-accent`, arrow `translate-x-1.5`, opacity 0.8 to 1, 300ms
  ease-out.
- Images without a photo fall back to the brand textures `public/design/news/tex-*.jpg`, handed
  out in order so no two visible cards share one (`latest.tsx`, `projects.tsx`). Use
  `next/image` with `placeholder="blur"` from `news-blur.ts`.
- Reach for an existing `components/ui/` primitive before writing a new control. Toasts go
  through `sonner` (`app/layout.tsx`).
- Every WebGL canvas starts hidden with `opacity-0` on its wrapper and is revealed by
  `RevealOnFirstFrame` after the second frame. This stops the white flash
  (`reveal-on-first-frame.tsx`, `handoff-hero-rocket.md` §9).

## Motion

| Name | Value | Use |
|---|---|---|
| Hover transitions | 300ms ease-out | cards, arrows, textures |
| `word-up`, `slogan-down` | 0.7s `cubic-bezier(0.22,1,0.36,1)` | hero type in |
| `hero-fade` | 0.9s ease-out | hero copy once settled |
| `rocket-drive-in`, `hero-separate` | 7s linear, easing baked into stops | hero entrance |
| `marquee` | 40s linear infinite | partners strip |
| `twinkle` | 4s ease-in-out infinite | stars |
| `shooting-star` | 20s linear infinite | footer |

All values from `tailwind.config.ts`.

## Page rules

**Landing order** (`app/page.tsx`, HANDOFF): navbar, hero, Latest, Projects, Inside the team,
Partners, Apply band, footer.

**Hero** (`.decisions/0004-hero-entrance.md`, `hero.tsx`):
- Plays once per load. Title and slogan stagger in, gathered. Hold 2s (`HOLD_MS`). The rocket
  climbs in from off-screen lower-left over the type for 7s (`DRIVE_MS`), nose easing 14° to 6°,
  while title and slogan part on the same curve. Body copy, hairline and fact strip fade in after.
- No pinning, no scroll effect, no lift-off, no replay. The parked rocket only bobs; no shake.
- The belly light rises as the rocket climbs and fades once parked, driven by the rocket's
  screen height. Do not add a fixed fill lamp from below (`handoff-hero-rocket.md` §4).
- No PNG fallback. Without WebGL the hero is text only.
- Render budget: pixel ratio capped at 1.5, shadow map 1024 (`hero-rocket-3d.tsx`).

**Stars:** only on the hero and the footer. Never on middle sections (HANDOFF). Use
`Starfield` (seeded, so SSR and client match).

**Latest:** featured card plus a three-row list, then a centred "All news" link. Texture fills
each card under a `from-panel` gradient (`latest.tsx`).

**Projects:** each card renders Cavour live in 3D. On hover the rocket itself turns its nose
toward the viewer and climbs, eased over about 2s. The camera never moves. The canvas
overhangs the card top so the nose can leave the card. Hover is read off the `<article>`; the
canvas takes no pointer events. No raycast hover (`handoff-hero-rocket.md` §8,
`rocket-card-3d.tsx`). Change tuning constants at the top of `rocket-card-3d.tsx`, not the JSX.
Any new vehicle model follows `.claude/skills/rocket-surface/`.

**Partners:** full-colour logos, never greyscale. Right-to-left loop, 40s, paused on hover,
edges faded with a mask. Each logo is a link (`partners.tsx`, HANDOFF).

**Apply band:** `#EE4A00`, one step darker than the accent; brighter, gradient, pressed and
inverted versions were rejected. The open-positions line hides at 0 (`apply-band.tsx`).

**Footer:** four columns (About, Projects, Get involved, Contact), starfield, one shooting star
about every 20s in the upper half (`footer.tsx`).

## Accessibility

- Reduced motion: the hero jumps to its settled state and mounts no rocket (`hero.tsx`). The
  hero bob and the card hover turn are off under reduced motion (`hero-rocket-3d.tsx`,
  `rocket-card-3d.tsx`). Any new motion must honour `prefers-reduced-motion`.
- Decorative layers (stars, fades, textures, `RocketArrow`) carry `aria-hidden` or `alt=""`.
  Meaningful images carry real alt text; logo links carry `aria-label` (`partners.tsx`).
- External links open with `target="_blank" rel="noopener noreferrer"` (`partners.tsx`).
- `lang="en"` on `<html>` (`app/layout.tsx`).

## What a reviewer checks

1. Colours come from the PRT tokens, or are a commented exception from the list above.
2. Fonts are Archivo or Geist Mono, in the type patterns above.
3. Width, padding, radii and card borders match the layout rules.
4. Hover uses the 300ms ease-out pattern; links use `RocketArrow`.
5. The hero still follows ADR 0004: once, no pinning, no replay, no shake, no PNG.
6. Stars appear only in the hero and footer.
7. Any canvas uses `RevealOnFirstFrame`; there is no white flash on reload.
8. Reduced motion leaves no moving part in the change.
9. The change renders at 1440 x 900 and scales down without showing the next section.
   Hero shots: `node scripts/shoot-hero-settled.mjs <outdir>` against `pnpm preview`.
10. Copy has no em dashes.

## Open gaps

- **Project split.** `design/specs-from-old-site.md` and HANDOFF (board 11b, approved
  2026-09-20) say three projects: Cavour, VES, Efesto. The landing Projects section and footer
  still show four (VES Mark II separate). Landing card data (Cavour motor "M") also differs from
  the old-site specs (class L). HANDOFF rules; the code is behind.
- **Stale comment.** `projects.tsx` still describes the old 2D hover (scale 1.15, rotate). The
  3D hover in `handoff-hero-rocket.md` §8 is what rules.
- **Reduced motion gaps.** The partners marquee, twinkle and shooting star have no
  reduced-motion guard (`partners.tsx`, `footer.tsx`, `starfield.tsx`).
- **Focus styles.** Landing links and pills have no `focus-visible` style. Only
  `components/ui/` primitives do (`components/ui/button.tsx`).
- **Unused keyframes.** `rocket-hover`, `rocket-fly-in` and `shoot` in `tailwind.config.ts`
  are not used by the landing page.
- **Old font stack.** `app/globals.css` still sets Plus Jakarta Sans on `html`. The body class
  overrides it with Archivo.
- **Small screens.** The navbar is absolutely placed at desktop sizes, and the hero only scales
  the 1440 board. No mobile design is recorded.
- **Subroutes.** `/projects`, `/projects/[slug]`, `/about/*`, `/outreach`, `/partners`,
  `/apply` and the news page are still being designed (HANDOFF "Todo").
