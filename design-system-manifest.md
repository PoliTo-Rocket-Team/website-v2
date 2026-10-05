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
  and paints `<html>` with the `ground` colour and `color-scheme: dark` before CSS loads.

## Colour

The PRT tokens in `tailwind.config.ts` (marked "Pencil variables, board 00") are the palette
for redesigned surfaces. The brand colours (ground, text, accent) come from board 21's brand
sheet and live in `lib/brand-colors.ts`: `tailwind.config.ts` builds its tokens from that module,
and code that cannot take a class (the `<html>` paint in `app/layout.tsx`, the hero scrim in
`hero.tsx`) imports it, so a brand change is one edit.

| Role | Token | Value |
|---|---|---|
| Page ground (ink) | `ground` | `#0A0A0A` |
| Card / panel | `panel` | `#141416` |
| Hovered card | `surface-2` | `#1C1C1F` |
| Hairline border | `hairline` | `#232326` |
| Hovered border | `border-strong` | `#34343A` |
| Primary text (paper) | `prt-text` | `#FAF9F7` |
| Secondary text, links | `text-2` | `#C9C9CE` |
| Muted body copy | `prt-muted` | `#8A8A8F` |
| Labels, numbers, meta | `dim` | `#5E5E64` |
| Brand accent (signal orange) | `accent` / `-hover` / `-pressed` | `#FF5E00` / `#FF7526` / `#E05200` |
| Accent tint, text on accent | `accent-soft`, `accent-on-accent` | `#FF5E0024`, `#0A0A0A` |
| Overlays | `white-5`, `white-10` | 5% and 10% white |
| Status | `success`, `warning`, `danger` (+ `-soft`) | `#2E9B4F`, `#F5A623`, `#CE2B4B` |

Rules:

- Orange `accent` is the one brand colour. Use it for section eyebrows, the Apply pill,
  hover text, and the Launch tag. Do not add a second accent.
- Tags and status pills pair a `-soft` fill with the solid text colour: Launch = accent,
  Competition = warning, Outreach = success, Team = `white-10` with `prt-text`
  (`latest.tsx`, HANDOFF board 05). Project status pills sit on a texture, so they follow
  board 21 instead: flown = `ground/70` with `prt-text`, In design = `prt-text` with `ground`
  (`projects.tsx`).
- The legacy palettes `rocket`, `space`, `mission`, `cosmos` and the shadcn role variables in
  `app/globals.css` serve `app/(legacy)/` and `components/ui/` only. Do not use them on a
  redesigned surface. Note the shadcn `accent` name is taken by the PRT orange
  (`tailwind.config.ts` comment).
- Use a token, not a hex value, in components. Code holds these deliberate exceptions, each with
  a comment: hero sky `#010101` (the earth photo's measured black, `hero.tsx`), star-dimming
  radial fades (`hero.tsx`, `navbar.tsx`), the `.hero-type` gradient (`app/globals.css`), the
  `RocketArrow` grey hull and fin fills (`rocket-arrow.tsx`; its ring and nose use
  `fill-prt-text` and `fill-accent`), and the board 21 spec values for the page sky and the
  liquid glass utilities (`.page-sky-light`, `.glass-*` in `app/globals.css`).
  A new exception needs the same kind of comment.

## Type

- Two families, loaded in `app/layout.tsx` with `next/font/google`:
  - `font-display` = Archivo (weights 400 to 900). The body default.
  - `font-mono` = Geist Mono. Eyebrows, dates, tags, spec labels, footer meta, fact strip.
- Do not add a third family without a decision record.
- Patterns in code (`latest.tsx`, `projects.tsx`, `inside-team.tsx`, `partners.tsx`):
  - Eyebrow: `font-mono text-xs tracking-[0.3em] text-accent`, uppercase.
  - Section title (board 21: 48px, weight 700, line height 1.25, tracking -0.025em):
    `text-4xl md:text-[48px] font-bold leading-[1.25] tracking-[-0.025em]`.
  - Section intro: `text-base leading-relaxed text-text-2`, right of the title.
  - Spec label / value on a project info box: `font-mono text-[10px] tracking-[0.2em]
    text-prt-muted` over `font-mono text-[13px] text-prt-text`.
- Hero type is fixed in px on a 1440 x 900 board: title 90px extrabold, slogan 148px extrabold,
  body 22px, fact strip 11px mono (`hero.tsx`). Title and slogan words use `.hero-type`: a white
  to grey gradient clipped to text, with `drop-shadow` (not `text-shadow`), set on each animated
  word span, not the heading (`app/globals.css`, `handoff-hero-rocket.md` §5).
- Site copy has no em dashes (HANDOFF, hard rules).

## Spacing, layout, shape

- Content width: `max-w-[1312px]` centred. Navbar and partner strip use `max-w-[1440px]`.
- Section padding: `px-6 py-[120px] md:px-16` (partners `py-[100px]`). Sections below the
  hero have no borders between them and no background of their own: they sit on the page sky.
- Section header: eyebrow and title left, intro or link right, `md:flex-row md:items-end`,
  then content at `mt-16`.
- Grids: Latest `lg:grid-cols-[1.58fr_1fr]` with `gap-5`; Projects `lg:grid-cols-3`;
  Inside the team: figures and link cards `lg:grid-cols-4`; otherwise `gap-4`.
- Radii: glass cards `rounded-xl`; project cards `rounded-2xl` (16px) and their info boxes
  `rounded-xl` (12px); inset photos `rounded-[6px]`; buttons, pills and tags `rounded-full`.
  The shadcn `--radius` (`0.5rem`) is for `components/ui/` only.
- Cards on the page sky are liquid glass, from the utilities in `app/globals.css` (board 21
  spec table):

  | Class | Surface | Fill | Blur | Edge |
  |---|---|---|---|---|
  | `.glass-card` | track record and team cards | `rgba(255,255,255,.03)` | 16px | 1px, white 20% to 4%, inset `0 1px 0` white 12% |
  | `.glass-project` | project card (texture is the fill) | the texture image | none | 1.5px at 215deg, white 70/20/5/15/50%, inset `0 1px 2px` white 25%, shadow `0 16px 40px` black 60% |
  | `.glass-info` | project info box | `rgba(10,10,10,.6)` (Efesto `.82` via `--glass-tint`) plus a 200deg sheen | 24px | 1px as the card edge, inset `0 1px 0` white 18% |

  Each edge is a gradient ring on `::before`, cut out with a mask. A project card's edge
  brightens on hover through a second ring on `::after`.
- The legacy `border border-hairline bg-panel` card is not used on the landing page any more.
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
- Brand assets (board 21) are in `public/brand/` and `public/textures/`. The navbar and footer
  use `prt-logo-white.svg`; never recolour or stretch the logo. Project cards use
  `project-cavour.webp`, `project-ves.webp`, `project-efesto.webp`; the apply band uses
  `apply-band.webp`; the footer uses `streaks.webp`. Photos use `next/image` with
  `placeholder="blur"` from `news-blur.ts`.
- Reach for an existing `components/ui/` primitive before writing a new control. Toasts go
  through `sonner` (`app/layout.tsx`).
- Every WebGL canvas starts hidden with `opacity-0` on its wrapper and is revealed by
  `RevealOnFirstFrame` after the second frame. This stops the white flash
  (`reveal-on-first-frame.tsx`, `handoff-hero-rocket.md` §9).

## Motion

| Name | Value | Use |
|---|---|---|
| Hover transitions | 300ms ease-out | cards, arrows, textures, glass edges |
| Project rocket rise | 170px, 450ms ease-out | project card hover (`projects.tsx`) |
| `word-up`, `slogan-down` | 0.7s `cubic-bezier(0.22,1,0.36,1)` | hero type in |
| `hero-fade` | 0.9s ease-out | hero copy once settled |
| `rocket-drive-in`, `hero-separate` | 7s linear, easing baked into stops | hero entrance |
| `marquee` | 40s linear infinite | partners strip |
| `twinkle` | 4s ease-in-out infinite | stars |
| `shooting-star` | 20s linear infinite | footer |

All values from `tailwind.config.ts`, except the rocket rise, which is set on the card.

## Page rules

**Landing order** (`app/page.tsx`, board 21): navbar, hero, Latest (track record), Projects,
Inside the team, Partners, Apply band, footer.

**Brand:** the navbar logo is `prt-logo-white.svg` at 220px wide. The footer logo's left edge
lines up with the tagline and its width matches the tagline's first line: the brand block is
`w-max`, the first line does not wrap, and the logo fills the block (`footer.tsx`).

**Page sky** (board 21, `app/page.tsx`, `app/globals.css`): one background runs from below the
hero to the apply band, behind Latest, Projects, Inside the team and Partners. It is ground,
soft diagonal light streaks and a fine grain at about 16% strength (`.page-sky-light`), plus a
`Starfield` with no shooting star. It is drawn in code: the streaks are repeating gradients and
the grain is a stitched SVG tile, so it is periodic and shows no seam at any page height. Never
ship it as one tall image. Its top fades in so the hero scrim, which ends on `ground`, meets it
without a line.

**Hero** (`.decisions/0004-hero-entrance.md`, `hero.tsx`):
- Plays once per load. Title and slogan stagger in, gathered. Hold 2s (`HOLD_MS`). The rocket
  climbs in from off-screen lower-left over the type for 7s (`DRIVE_MS`), nose easing 14° to 6°,
  while title and slogan part on the same curve. Body copy, hairline and fact strip fade in after.
- No pinning, no scroll effect, no lift-off, no replay. The parked rocket only bobs; no shake.
- The belly light rises as the rocket climbs and fades once parked, driven by the rocket's
  screen height. Do not add a fixed fill lamp from below (`handoff-hero-rocket.md` §4).
- No PNG fallback. Without WebGL the hero is text only.
- Render budget: pixel ratio capped at 1.5, shadow map 1024 (`hero-rocket-3d.tsx`).

**Stars:** on the hero, the page sky and the footer (board 21 replaced HANDOFF's "hero and
footer only"). The shooting star is the footer's alone. Use `Starfield` (seeded, so SSR and
client match).

**Latest:** featured card plus a three-row list, then a centred "All news" link. The cards are
`.glass-card` with no texture of their own; the featured card keeps its inset photo
(`latest.tsx`).

**Projects:** exactly three cards, Cavour, VES and Efesto, with the board 21 data from
`design/specs-from-old-site.md`, each on its texture, 618px tall, with a `.glass-info` box
inset at the bottom. Each card renders Cavour live in 3D. At rest it shows from the nose to
mid-body above the info box. On hover the rocket rises 170px over 450ms ease-out and its nose
leaves the card top; on leave it sinks back the same way. The rise is a CSS transform on the
canvas wrapper, which hangs above and below the card and is clipped to the card's sides and
bottom only. The vehicle and camera hold still in the scene. Under reduced motion there is no
rise; only the glass edge brightens. The canvas takes no pointer events. No raycast hover
(`projects.tsx`, `rocket-card-3d.tsx`). Change tuning constants at the top of
`rocket-card-3d.tsx`, not the JSX. Any new vehicle model follows
`.claude/skills/rocket-surface/`.

**Partners:** no box and no fill; the page sky shows behind the logos. Full-colour logos,
never greyscale. Right-to-left loop, 40s, paused on hover and still under reduced motion,
edges faded with a mask. Each logo is a link (`partners.tsx`, HANDOFF).

**Apply band** (board 21): `bg-accent` (`#FF5E00`) with `public/textures/apply-band.webp` on
top in multiply at 60%. Eyebrow "APPLY · 2025/26"; headline "Build the / next one with us." at
80px, weight 800, vertically centred against the right block; body at 22px, then the inverted
"Apply to join" button. There is no open-positions count (`apply-band.tsx`).

**Footer:** its own background: `ground` with `public/textures/streaks.webp` at 30% in screen
blend, a starfield and one shooting star about every 20s in the upper half. Brand block, then
four columns (About, Projects, Get involved, Contact); the email link is accent
(`footer.tsx`).

## Accessibility

- Reduced motion: the hero jumps to its settled state and mounts no rocket (`hero.tsx`). The
  hero bob, the card rocket's drift and its hover rise, star twinkle, the shooting star and the
  partners marquee are off under reduced motion (`hero-rocket-3d.tsx`, `rocket-card-3d.tsx`,
  `projects.tsx`, `starfield.tsx`, `footer.tsx`, `partners.tsx`). Any new motion must honour
  `prefers-reduced-motion`.
- Decorative layers (stars, fades, textures, `RocketArrow`) carry `aria-hidden` or `alt=""`.
  Meaningful images carry real alt text; logo links carry `aria-label` (`partners.tsx`).
- External links open with `target="_blank" rel="noopener noreferrer"` (`partners.tsx`).
- `lang="en"` on `<html>` (`app/layout.tsx`).

## What a reviewer checks

1. Colours come from the PRT tokens, or are a commented exception from the list above.
2. Fonts are Archivo or Geist Mono, in the type patterns above.
3. Width, padding, radii and glass surfaces match the layout rules.
4. Hover uses the 300ms ease-out pattern (the project rocket rise is 450ms); links use
   `RocketArrow`.
5. The hero still follows ADR 0004: once, no pinning, no replay, no shake, no PNG.
6. Sections below the hero paint no background of their own; the page sky is drawn in code;
   the shooting star appears only in the footer.
7. Any canvas uses `RevealOnFirstFrame`; there is no white flash on reload.
8. Reduced motion leaves no moving part in the change.
9. The change renders at 1440 x 900 and scales down without showing the next section.
   Hero shots: `node scripts/shoot-hero-settled.mjs <outdir>` against `pnpm preview`.
10. Copy has no em dashes.

## Open gaps

- **Footer projects.** The landing Projects section shows three projects (board 21), but the
  footer's Projects column still lists VES Mark II separately, as board 21's footer does.
- **Hover turn.** `handoff-hero-rocket.md` §8 describes a card hover where the rocket turns its
  nose toward the viewer. Board 21 replaced it with a straight rise; the handoff is stale there.
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
