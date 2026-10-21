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
  (`hero-rocket-3d.tsx`, `rocket-card-3d.tsx`, `rocket-cavour.tsx`, `rocket-ves.tsx`,
  `hero-plume.tsx`, `hero-weathering.ts`). The `/projects/cavour` hero shows a still of the
  parked rocket (`CAVOUR_STAGE_POSTER`), rendered offline from `cavour-stage-3d.tsx` by
  `scripts/render-cavour-stage.mjs`; that page loads no 3D. `/projects/ves` shows VES Mark I's
  still (`VES_STAGE_POSTER`) the same way, and `/projects/efesto` the still of Efesto's
  outline engine (`EFESTO_STAGE_POSTER`, `engine-efesto.tsx`, issue #382).
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
| Status | `success`, `warning`, `danger`, `info` (+ `-soft`) | `#2E9B4F`, `#F5A623`, `#CE2B4B`, `#4DA3FF` |

Rules:

- Orange `accent` is the one brand colour. Use it for section eyebrows, hover text, the
  Launch tag, the award tag on the home Track record cards and the apply band. Do not add a
  second accent. The navbar has no Apply pill any more: Apply is a link like the others
  (issue #119).
- Tags and status pills pair a `-soft` fill with the solid text colour: Launch = accent,
  Competition = warning, Outreach = success, Team = `white-10` with `prt-text` (HANDOFF
  board 05). Outreach tags are data, so the home Track record cards (`latest.tsx`) give the
  award tag accent and every other tag `white-10` with `prt-text`. Project status pills sit on a texture, so they follow
  board 21 instead: flown = `ground/70` with `prt-text`, In design = `prt-text` with `ground`
  (`project-card.tsx`).
- Application stage pills on the dashboard follow the same pairing (board 58b, issue #171,
  `stage-pill.tsx`): New and "Interview · no time yet" = `white-10` with `prt-text`, In review =
  `info`, a booked interview = accent, Accepted and Joined = success, Rejected and Withdrawn =
  `white-5` with `prt-muted`. `info` marks In review (on the stage pill and tag, and on the
  panel's stage menu trigger and its dot: `toneSurface`, `toneDot`) and, on the Team tree only
  (board 54e, issue #229, `team-tree.tsx`), someone in another division: the dashed line from a
  division to someone drawn under another one, their "also {division}" tag (`info-soft` fill,
  `info` text) and the legend's line, so they read apart from the accent path. It is not a second
  accent and marks nothing else.
- The legacy palettes `rocket`, `space`, `mission`, `cosmos` and the shadcn role variables in
  `app/globals.css` serve `app/(legacy)/` and `components/ui/` only. Do not use them on a
  redesigned surface. Note the shadcn `accent` name is taken by the PRT orange
  (`tailwind.config.ts` comment).
- Use a token, not a hex value, in components. Code holds these deliberate exceptions, each with
  a comment: hero sky `#010101` (the earth photo's measured black, `hero.tsx`), star-dimming
  radial fades (`hero.tsx`, `navbar.tsx`), the `.hero-type` gradient (`app/globals.css`), the
  `RocketArrow` grey hull and fin fills (`rocket-arrow.tsx`; its ring and nose use
  `fill-prt-text` and `fill-accent`), and the page sky grain (one octave of pixel-fine grey SVG
  noise in soft-light blend, frequency 2 at 60% on 2x screens and 1.8 at 70% on 1x, with no threshold, so it reads as even
  film grain, not as specks, and keeps the sky's tone; matched to board 21, and the same at
  each density, issue #89), and the
  board 21 spec values for the liquid glass utilities, the navbar bar and the panel that
  hangs from it included, with the white noise dither on `.glass-card` and `.glass-info`
  taken off their white fill (`.page-sky-grain`, `.glass-*` in `app/globals.css`), and the
  /login rocket flame's warm ramp `#FF7A2E`, `#FFD2A6`, `#FFE6CC` and white beside the accent
  (board 36, `components/login/rocket-flame.tsx`, issue #159).
  A new exception needs the same kind of comment.

## Type

- Two families, loaded in `app/layout.tsx` with `next/font/google`:
  - `font-display` = Archivo (weights 400 to 900). The body default.
  - `font-mono` = Geist Mono. Eyebrows, dates, tags, spec labels, footer meta, fact strip.
- One allowed exception (`.decisions/0017-ampersand-from-inter-tight.md`): the "&" glyph
  (U+0026) comes from Inter Tight, weights 400 to 900. Its face, `--font-ampersand`, is loaded in
  `app/layout.tsx` with `next/font/local`, claims `unicode-range: U+0026` only, and sits first in
  the `font-display` stack, so every other glyph stays Archivo.
- Do not add a third family, or draw any other glyph from Inter Tight, without a decision record.
- Patterns in code (`latest.tsx`, `projects.tsx`, `inside-team.tsx`, `partners.tsx`):
  - Eyebrow: `font-mono text-xs tracking-[0.3em] text-accent`, uppercase.
  - Section title (board 21: 48px, weight 700, line height 1.25, tracking -0.025em; board 24
    phone: 26px): `text-[26px] md:text-[48px] font-bold leading-[1.25] tracking-[-0.025em]`.
  - Section intro: `text-[15px] md:text-[17px] leading-relaxed text-text-2`, right of the
    title from md, under it on phones.
  - Spec label / value on a project info box: `font-mono text-[10px] tracking-[0.2em]
    text-prt-muted` over `font-mono text-[13px] text-prt-text`.
- Hero type is fixed in px on a 1440 x 900 board: title 90px extrabold, slogan 148px extrabold,
  body 22px, fact strip 11px mono (`hero.tsx`). On phones (board 24) the title is 30px, the
  slogan 52px on two lines ("BORN FOR / SPACE") and the body 14px (`hero-phone.tsx`). Title and slogan words use `.hero-type`: a white
  to grey gradient clipped to text, with `drop-shadow` (not `text-shadow`), set on each animated
  word span, not the heading (`app/globals.css`, `handoff-hero-rocket.md` §5).
- Site copy has no em dashes (HANDOFF, hard rules).

## Spacing, layout, shape

- Content width: `max-w-[1312px]` centred. Navbar and partner strip use `max-w-[1440px]`.
- Section rhythm: one spacing token, `section` (`tailwind.config.ts`, value in
  `--section-pad` in `app/globals.css`): 56px on phones (board 24), 120px from md (board 21).
  Every landing section pads its top and bottom by it (`py-section`), the apply band and
  partners included, so the gap between any two adjacent sections is twice the token: 112px
  on phones, 240px from md. The hero has no pad of its own, so the page sky adds one under it,
  less `--hero-bottom-space` (the empty hero below its last line of text, `app/globals.css`):
  the gap from that line to the Track record eyebrow is the same 112px / 240px. The footer's
  top pad and the /projects page's bottom pad are `section` too, and /projects keeps one
  `section` pad between the bar and its header. Never
  set a section's vertical padding with another value. Sides are `px-5 md:px-16` (board 24
  gives phones 20px sides). Sections below the hero have no borders
  between them and no background of their own: they sit on the page sky.
- Section header: eyebrow and title left, intro or link right, `md:flex-row md:items-end`,
  then the content under it: 40px in Latest (`md:mt-10`, board 21), 56px in Projects
  (`md:mt-8` on the swipe row plus the row's own 24px top room, `pt-6`), 24px on phones.
- Grids: Latest `lg:grid-cols-[1.58fr_1fr]` with `gap-5`, and from lg a cards row at least
  560px tall (`lg:grid-rows-[minmax(560px,auto)]`); Projects is a swipe row, not a grid (below);
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
  brightens on hover through a second ring on `::after`. `.glass-linked` gives a `.glass-info`
  card that links to its page the same brighter edge on hover and on keyboard focus.
  `.glass-card` and `.glass-info` lay a pixel-fine white noise dither over their fill: the blur
  averages the sky's own dither away, and without it the sky inside shows one-level tone
  steps. The dither's mean is taken off the white fill, so the tone above holds on average
  (issue #89).
- The navbar is `.glass-bar`: a full-width bar fixed to the top edge, not floating (no side
  margins, no radius). Fill `rgba(10,10,10,.35)` under the 200deg sheen, blur 24px, a 1px
  bottom edge white 8% to 25% to 8% (brightest in the middle), shadow `0 8px 24px` black
  35%. The bar spans the viewport; its contents stay on the 1440 board columns. No UI
  package in the repo ships a glass surface, so it is CSS beside the other glass.
  While the hero canvas shows under the bar, the bar has no blur and keeps the same fill,
  so a canvas frame never forces a re-blur; the blur fades out and back in over 300ms
  ease-out (issue #63, `glass-bar.ts`, `html[data-glass-bar="clear"]` in `app/globals.css`).
- The legacy `border border-hairline bg-panel` card is not used on the landing page any more.
- From md the hero is a fixed 1440 x 900 board. It scales down only, by
  `min(1, vw/1440, vh/900)`. Section height is clamped to 900 to 1080 board px. An inline script
  sets `--hero-scale` and `--hero-h` before first paint (`hero.tsx`). Below md the hero is board
  24's 650px frame, laid out from the 20px edges rather than scaled (`hero-phone.tsx`).

## Components

- Buttons: the primary pill is paper (`bg-prt-text`, text `ground`, hover opacity 90%),
  as "Apply for this role" on /apply. Sign in = ghost pill (`border-white-10`, hover
  `border-strong`) (`navbar.tsx`).
  On the orange band the button is `bg-ground` with `prt-text` (`apply-band.tsx`).
- Text links with an arrow use `RocketArrow` (`components/landing/rocket-arrow.tsx`), not a
  `→` glyph. Hover: link to `text-accent`, arrow `translate-x-1.5`, opacity 0.8 to 1, 300ms
  ease-out.
- Brand assets (board 21) are in `public/brand/` and `public/textures/`. The navbar and footer
  use `prt-logo-white.svg`; never recolour or stretch the logo. Project cards use
  `project-cavour.webp`, `project-ves.webp`, `project-efesto.webp`; the apply band uses
  `apply-band.webp`; the footer uses the page sky tile. The navbar on phones and the menu use
  `prt-mark-white.svg`. Photos use `next/image` with `placeholder="blur"` from the blur map
  beside their component: Outreach photos, the home Track record ones included, go through
  `components/outreach/photo.tsx` and `outreach-blur.ts`.
- An image slot with no image shows the PRT mark, never initials (issue #366): every person
  circle (the Team page, Alumni, Advisors, the dashboard's avatars, My profile, the account
  menu) and every empty photo frame draws `MarkFallback` (`components/mark-fallback.tsx`) in
  its own fill. `fit="circle"` (the default) is the mark at 78% of a round avatar;
  `fit="frame"` is a small, dimmed mark in the middle of a wider frame. Team page circles use
  `Avatar` from `components/about/person.tsx`, dashboard circles the dashboard `Avatar`.
- Reach for an existing `components/ui/` primitive before writing a new control. Toasts go
  through `sonner` (`app/layout.tsx`).
- Dialogs on redesigned pages use the repo's Radix dialog (`components/ui/dialog`) for
  `Dialog`, `DialogPortal`, `DialogOverlay`, `DialogTitle` and `DialogClose`, and build their
  content on `DialogPrimitive.Content` itself, as the phone menu (`nav-menu.tsx`) and the
  gallery lightbox (`gallery.tsx`) do. They animate only on open, and only under
  `motion-safe:` (a fade, or the menu's slide). They close at once, with no exit animation:
  Radix unmounts a closing layer only when its exit animation sends `animationend`, a tab that
  draws no frames never sends it, and the page then stayed scroll-locked (issues #79, #80). Do
  not use `motion-reduce:animate-none` for this: it loses to the `data-[state]` variants.
  `DialogOverlay` follows this rule; the shared `DialogContent` export does not. It still
  exit-animates (`data-[state=closed]:animate-out`), and its open animation is not under
  `motion-safe:` (`components/ui/dialog.tsx`). No component uses it now; do not use it on a
  redesigned page.
- Every WebGL canvas starts hidden with `opacity-0` on its wrapper and is revealed by
  `RevealOnFirstFrame` after the second frame. This stops the white flash
  (`reveal-on-first-frame.tsx`, `handoff-hero-rocket.md` §9).
- Back on the home page, the hero has no animation: no fly-in, no crossfade, no flame, even
  when the page was left mid-flight or in the opening hold (issue #111). It shows the
  rocket's last drawn frame at once, copied from the live canvas as the page hid
  (`last-frame.ts`) and drawn at rest, plume off. Once the new canvas has drawn, it takes
  the frame's place in one paint, with no transition: both show the parked rocket. A page
  that never drew the rocket holds no frame, so this is no poster and ADR 0004 holds.

## Motion

| Name | Value | Use |
|---|---|---|
| Hover transitions | 300ms ease-out | cards, arrows, textures, glass edges |
| `word-up`, `slogan-down` | 0.7s `cubic-bezier(0.22,1,0.36,1)` | hero type in |
| `hero-fade` | 0.9s ease-out | hero copy once settled |
| `rocket-drive-in`, `hero-separate` | 7s linear, easing baked into stops | hero entrance |
| Hero canvas fade-in | 200ms ease-out, `motion-safe:` only | a hero canvas that replaces a lost one (`hero-rocket-3d.tsx`) |
| `marquee` | 40s linear infinite | partners strip |
| `twinkle` | 4s ease-in-out infinite | stars |
| `shooting-star` | 20s linear infinite | footer |
| Card rocket hover turn | one turn in 20s; eases in (0.35s time constant) and back as a damped spring (0.5s) | a hovered card's rocket (`lib/card-turn.ts`) |

All values from `tailwind.config.ts`, except the card rocket turn, which is named in
`lib/card-turn.ts`. A project card has no hover motion of its own (issue #73): its glass
edge brightens and its rocket turns in place (issue #385).

## Page rules

**Landing order** (`app/page.tsx`, board 21): navbar, hero, Latest (track record), Projects,
Inside the team, Partners, Apply band, footer.

**Navbar** (board 21): `.glass-bar`, fixed, 72px tall from md. Logo left on the 64px column,
link row centred on the page, actions right; all three are centred on the bar's middle by
flex, never by fixed offsets. Page tops that clear the bar count from 72px (64px on phones):
`/projects` is the bar plus one `section` pad, 120px under the bar from md, 56px on phones.
This departs from board 22's 98px so the page keeps the section rhythm (issue #52). Below lg the link row moves into the menu (below), opened by a menu
icon right of the actions (`navbar.tsx`).

**About menu** (board 27, issue #93, `nav-hover-menu.tsx`): from lg, hovering or keyboard focus
on About opens a panel of the About pages (The Team, Alumni, Our University, Mission &
Vision). No other link has one; Projects has its own page. The panel is `.glass-hang`: it
hangs flush from the bar under About, 36px left of the link's text, with no top edge, white
12% side and bottom edges, 12px bottom corners and the bar's shadow clipped at the top. Its
fill is the tone of the bar's bottom edge above it, and the bar's bottom edge leaves a gap
over it (`openBarJoin` in `glass-bar.ts`), so bar and panel read as one shape with no line
and no step in tone at the join. A 2px `accent` line runs from the top of About's line down
to the last page. Pages are 16px, 12px apart, left-aligned with About: the current one
`prt-text`, the rest `text-2`, hover and keyboard highlight `accent`. It is the repo's Radix
dropdown menu, not modal: Escape, leaving (after 150ms) and an outside click close it; Tab
leaves it. Clicking About, or Enter on it, still goes to `/about/the-team`. It fades in over
150ms only under `motion-safe:` and closes at once.

**Navbar on phones** (board 24, below md): the same glass bar, 64px tall, 20px side padding.
The PRT mark only (`prt-mark-white.svg`, 32px tall) on the left and the menu icon on the
right. There is no Sign in on the bar: it is in the menu.

**Account menu** (board 01b, issue #261, `nav-account.tsx`): signed in, the bar's end is a
38px round avatar at every width (the photo, else the PRT mark on `accent`), with no name text;
on phones it sits beside the menu icon. Its accessible name is "Account menu". It opens the
repo's Radix dropdown below it, aligned right: a `panel` card with a `hairline` edge, the full
name and team email as header, then Dashboard (`text-2`) and Log out (`danger`). While open
the avatar wears a 2px `accent` ring. Signed in, the sidebar has no foot. Signed out nothing
changes. Log out is the one shared sign-out (`components/use-sign-out.ts`).

**Menu** (board 24b, `nav-menu.tsx`): a sidebar from the right, 330px wide and full height,
`.glass-sidebar` (ink at 70% under the 200deg sheen, blur 32px, a 1px left edge, a shadow onto
the page). The page behind dims (`ground` at 55% and a slight blur). Top: the mark and a close
icon. Then Projects, About, Outreach, Partners and Apply at 28px bold, each 66px tall over a
`white-10` rule with a `RocketArrow`; the current page is `accent`. The About pages sit
under About, indented 20px, 17px `text-2` (the current one `accent`). At the foot: the
outlined "Sign in" (`border-white-10`), full width, with no email. Apply is a link, never a
button (issue #119). It is the repo's Radix dialog (`components/ui/dialog`), so
focus, Escape and scroll lock come with it; the slide in is off under reduced motion.

**Brand:** the navbar logo is `prt-logo-white.svg` at 220px wide from md, and the mark on
phones (above). The footer logo's left edge
lines up with the tagline and its width matches the tagline's first line: the brand block is
`w-max`, the first line does not wrap, and the logo fills the block (`footer.tsx`).

**Page sky** (board 21, `app/page.tsx`, `app/globals.css`): one background runs from below the
hero to the apply band, behind Latest, Projects, Inside the team and Partners. It has three
layers. `.page-sky-light` is `public/textures/page-streaks-tile.webp`, a seamless 1440 x 1800
tile cut from the approved background, with the soft diagonal streaks baked onto `ground` at
the board's 16% strength, blurred so it holds no compression blocks and stored lossless. It
repeats down the page (`max(100%, 1440px) auto repeat-y`), so it shows no seam at any page
height. `.page-sky-grain` is the fine film grain, a
stitched SVG noise tile in soft-light blend at 60% on 2x, 70% on 1x (the exception above), kept apart because webp compression drops grain. It
is film texture only. The streak tile carries its own 8 x 8 ordered dither, so its dark
gradients show no bands; the grain is random noise and is not the layer that removes banding
(issue #87). On top
sits a `Starfield` with no shooting star and whole-pixel star sizes (2 or 3px,
`wholePixels`): a fractional box under 3px renders as a dash, not a dot. Its stars are also
kept apart (`minSpacing`, 1.5% on both axes): two stars that touch merge into one dash. Never ship the sky as one tall image. The stars
start at the sky's top edge, with no offset. The tile and the grain are drawn up from the sky's
bottom edge (`.page-sky-to-footer`), and the footer draws its own down from its top edge, so
where the sky meets the footer (`/projects`) both run on across the edge at the tile's own
wrap, with no line and no step in tone (issue #69). Under the hero only (`fadeTop`), the
streak tile ramps in over one `section` pad (`.page-sky-fade`): the tile is lighter than the
`ground` the hero scrim ends on, so a hard start would draw a line. No longer fade: a flat
dark band under the hero makes the page look like it starts halfway down (issue #52).

**Hero** (`.decisions/0004-hero-entrance.md`, `hero.tsx`, `hero-phone.tsx`):
- Plays once per load. Title and slogan stagger in, gathered. Hold 2s (`HOLD_MS`). The rocket
  climbs in from off-screen lower-left over the type for 7s (`DRIVE_MS`), nose easing 14° to 6°,
  while title and slogan part on the same curve. Body copy, hairline and fact strip fade in after.
- No pinning, no scroll effect, no lift-off, no replay. The parked rocket holds still: no bob,
  no shake (issue #385).
- The entrance burns its full plume and smoke. Once parked, the plume and smoke fade out to
  nothing over 1.25s, eased in and out (`FADE_S`, `hero-plume.tsx`), and stay off while the
  rocket is parked.
- The belly light rises as the rocket climbs and fades once parked, driven by the rocket's
  screen height. Do not add a fixed fill lamp from below (`handoff-hero-rocket.md` §4).
- No PNG fallback. Without WebGL the hero is text only.
- Phones (board 24): the same sky, earth, stars, live rocket and entrance on the 650px frame.
  Top to bottom: title at y≈113 (below the 64px bar), the rocket climbing right at about 21°
  with its nose near (325, 182), then "BORN FOR / SPACE" right below the rocket at y≈384, then
  the body copy from y≈510. The earth photo starts at y215, smaller than on desktop. No
  hairline or fact strip. Only the frame that is showing mounts the rocket canvas.
- Render budget: pixel ratio capped at 1.5 on every canvas, shadow map 1024
  (`hero-rocket-3d.tsx`). The hero draws every frame only through the entrance and the plume's
  fade-out. Parked, with no plume, it holds its finished frame and draws again only when a
  resize clears it (issue #385; it bobbed at up to 10 fps before, issue #63). The flame
  flicker and the smoke move by real elapsed time, so fewer frames never mean slower motion.
  Off screen or in a hidden tab it draws nothing. The card canvases draw only on demand
  (warm-up, resize, and each frame of a hovered card rocket's turn and its ease back), so a
  card at rest draws no frames (issue #48). No model turns itself, Efesto's outline engine
  included (issue #385 replaced issue #382's always-on turn).

**Stars:** on the hero, the page sky and the footer (board 21 replaced HANDOFF's "hero and
footer only"). The shooting star is the footer's alone. Use `Starfield` (seeded, so SSR and
client match). The hero and footer skies keep their seeds, positions, sizes and look at rest.
Their motion changed in issue #59, which replaced issue #33's rule that they stay exactly as
built: only half their bright stars twinkle, each twinkle and the footer's shooting star run
through the motion gate (Idle motion below), and under reduced motion every twinkle stops and
the shooting star is hidden (Accessibility below). Only the page sky passes `wholePixels` and
`minSpacing`. One star in `twinkleEvery` is bright, and one bright star in two twinkles; the
rest hold still at full brightness.

**Idle motion** (issue #59): every twinkle, the shooting star and the partners marquee go
through the motion gate (`motion-gate.ts`). Each runs only while the tab is visible, some of
it shows below the navbar and none of it shows under the navbar, and no surface with a
`backdrop-filter` covers its centre. Otherwise it pauses where it stands.

**Card rocket hover turn** (issue #385, `rocket-turn.tsx`, `rocket-card-3d.tsx`,
`lib/card-turn.ts`): a card
rocket has no idle motion. On the home Projects row and the /projects cards, hovering a card
with a mouse or pen turns its rocket about its own long axis (one turn in 20s, easing in) in
its tuned rest pose, with the camera fixed; leaving the card eases it back to rest. A touch
never turns it, nor does anything under reduced motion. While it moves its canvas draws about
30 frames a second; at rest it draws none, and in a hidden tab it pauses where it stands.
Hover is not idle motion, so it does not use the gate. The dashboard and the edit shell keep
a still card rocket.

The gate does not cover the hero canvas: parked, it draws by the Render budget above, also
while part of it sits under the navbar, where the bar drops its blur instead (Spacing,
layout, shape above). The gate does not watch the phone menu either, so motion behind an
open menu keeps the state it had. New continuous motion uses the gate.

**Latest** (track record, board 21, `latest.tsx`): featured card plus a three-row list, then
a centred "All news" link to /outreach. The cards are the newest published Outreach posts
(issue #293): the newest is the featured card, with its cover photo, and the next three are
the list; each card links to its post page. The cards are `.glass-card` with no texture of their own. From lg
the section fits one 1440 x 900 screen under the navbar: 40px from the header to the cards and
from the cards to "All news", and a cards row at least 560px tall that both columns stretch
to. The list cards are 12px apart there and centre their text. The featured card: the tag
line on the left and "Read the record" (accent, with a `RocketArrow` from md) at the top
right on the same row; then the title (34px), the excerpt, and the inset photo. From lg the
photo fills what the card has left under the text, so the card matches the list column;
from md to lg it keeps a 2.2:1 shape. Phones (board 24): one column, the featured card (20px
title, photo 150px tall, no arrow), then only the first news card, 20px below,
then "All news". The other two news cards are desktop-only (from md).

**Projects:** one card per published project, newest first: by the start or launch year its card
names, then by number, the higher first (issue #359, `newestFirst` in
`lib/project-content/record.ts`). Today the row reads VES, Efesto and Cavour, with the board 21
data from `design/specs-from-old-site.md`. Each card keeps its number, which is its place in the
site order (Cavour 01, VES 02, Efesto 03), not its place in the row. Each card sits on its texture, 618px tall, with a `.glass-info` box
inset 32px at the bottom (20px from lg to xl). The cards sit in one horizontal swipe row at
every width and never wrap to a new line (issue #359): from md 16px apart, two to a view below
lg and three from lg (427px wide at 1440), snapping to the 64px page edge, with the row bleeding
over the section padding so a fourth card peeks past the edge. Pager dots show from md only
while the cards overflow the row, so three cards at lg show none. Each card renders its record's model live in 3D (Cavour on the Cavour card, VES Mark I on the
VES card, and Efesto's outline engine on the Efesto card, issue #382; a project with no model
of its own draws the shared placeholder, `lib/rocket-model.ts`). The engine is drawn in the
placeholder's pen look, smaller than a rocket, in the card's upper part above the info box.
VES Mark I is built at Cavour's length and body proportions, not as a replica, so the cards read
as one set (`rocket-ves.tsx`). At rest it shows from the nose to
mid-body above the info box. There is no hover rise (Owner decision, 2026-10-06): on hover the
card's glass edge brightens and the rocket turns in place about its long axis (Owner decision,
2026-10-19, issue #385; Card rocket hover turn above), then eases back to rest. The canvas
wrapper hangs above and below the card and is clipped to the card's sides and bottom only. The
camera holds still, and the vehicle holds still whenever its card is not hovered.
At rest the nose sits about 30px below the card top and
the flags show just above the info box. The canvas takes no pointer events. No raycast hover
(`project-card.tsx`, `rocket-card-3d.tsx`). Change tuning constants at the top of
`rocket-card-3d.tsx`, not the JSX. Any new vehicle model follows
`.claude/skills/rocket-surface/`.
Phones (board 24): the cards sit side by side in a horizontal swipe row (`swipe-row.tsx`),
210 x 360 each, 10px apart, scroll-snap to the 20px page edge, the next card peeking, and
pager dots below (the current one an 18px pill). The row bleeds to the screen edges. The
card scales down: 14px insets, a 24px name, 11px description, 8px / 10px spec labels and
values. The rocket keeps the nose-to-mid-body framing, its nose about 20px below the card top.
The row clips its vertical overflow (the hanging canvases), so it ends below the cards' whole
shadow (56px), and the dots pull back up to sit 20px under the cards: the clip never cuts the
shadow into a line (issue #50, `swipe-row.tsx`).
Phone copy is shorter (the record's `phone` text, drawn by `project-card.tsx`): VES "130 mm, all-SRAD systems. Mark II
won Design & Build at IREC 2025.", years "24–25", Cavour motor "Solid L", VES "MARKS" "Mk I–II",
Efesto fuel "Ethanol".

**/projects** (boards 22 and 22m, `app/projects/page.tsx`, `components/projects/`): the header
figures, then one `.glass-info` card per project: texture panel, then facts. The card ends at
the specs on every width, with no launch log, work lines or phone accordion (issue #381, an
Owner decision that overrides boards 22 and 22m there). The cards are listed newest first by
the same rule as the home row (`listingsNewestFirst`, which sorts with `newestFirst`). A rocket
project's panel draws its rocket live on the panel's diagonal (`RocketCardStage` with the model
`panelRocketOf` gives): its own model, or the placeholder when it has none. An engine (Efesto)
never draws a rocket or the placeholder: its panel draws its own engine model the same way, on
its texture (issue #382), and an engine with no model of its own shows the texture only. Every fact comes from the projects' published records
(`lib/project-content/`, issue #295), and the header counts their launches. Every published
project has its own page (issue #301), so every card is clickable: the name is the link, and its
`::after` covers the card, so the whole card is the target. The card takes `.glass-linked`, and
keyboard focus shows an accent outline 4px outside it.

**Project pages** (`/projects/[slug]`, `app/projects/[slug]/page.tsx`; boards 23 to 25 and
23m to 25m): one route and one template, `components/project-page/`, draw every published
project's page from its record (`pageRecordOf` in `lib/project-content/record.ts`). There are no
per-project components and no per-project routes: a new project is a stored record, created with
New project on the dashboard Projects page (issue #301), and needs no new file. The built Cavour
page is the layout reference.
- Order: hero, 01 The name and 02 The design side by side, then versions, launch history, the
  plan, numbered reasons and gallery, then the footer. There is no next-project card (Owner
  decision 2026-10-18, issue #377).
- A section the record has no data for is an absent key, and the page leaves it out entirely,
  with no note about what is missing. Section numbers follow the sections that render, so they
  always run 01, 02, 03 ... (`sectionsOf` in `lib/project-pages/index.ts`).
- The hero shows the visual panel on the project's texture only when the record has a visual:
  Cavour's still of the parked rocket (Stack above, not 3D), VES's still of Mark I with its
  "VES MARK I" caption and Mark I's key facts, Efesto's still of its outline engine. An engine's
  still sits centred on the orange streak texture (`/textures/project-ves.webp`) in place of its
  own texture (`stageTextureOf`, Owner decision, issue #382); its cards keep the grey texture. Up to six key
  facts. A set with a value longer than ten characters is set at 17px on phones (else 20px),
  and on desktop sits 3 x 2 below xl (1280) so no value runs into the next (`factLayout` in
  `hero.tsx`); a shorter set is one row of six.
- Versions: one highlighted version, bold under an accent pill on desktop and the default tab
  on phones. A spec with no value shows the dimmed dash (`Value` in `parts.tsx`).
- The launch history and the /projects header counts read each campaign from the one launch
  list in the project's record (issues #72 and #295). A campaign that did not fly gives its
  own four numbers and reads "DID NOT FLY"; a setback takes the orange pill, never red.
- The plan (board 25): steps done, the one under way, next and later, in that order by the
  record's shape. Desktop: a row of steps under a top rule, the step under way in accent.
  Phones: a vertical timeline with dots. Numbered reasons (board 25 "Why liquid"): up to three,
  in columns on desktop, stacked on phones.
- Gallery (boards 23, 23m and 23L, `components/gallery/gallery.tsx`): a carousel with the
  current photo centred (760 x 480, phones 300 x 220) and its neighbours smaller at 35%
  opacity, clipped by the page edge. It wraps, never autoplays and does not move while idle.
  Arrows, swipe, the arrow keys or a tap on a neighbour step it; dots below, the current one
  an accent pill. The open button or a tap on the photo opens the lightbox: a full-screen
  `ground` dialog with the photo contained, "n / total" top left, close top right, prev and
  next beside the photo and a one-line caption. Both share one index. A slot with no photo
  is a glass placeholder. Cavour's and VES's galleries and launch cards show the Team's own
  photos from the current public site (issue #371): webp files in `public/project-photos/`,
  named in the project's stored record, never in a component.

**/apply** (boards 34, 34b, 34m and 34bm, issue #119, `app/apply/page.tsx`,
`components/apply/`): the About page header with four figures (2 x 2 on phones), the
positions, then the questions; the footer sits in the sky. Whether any position is public
picks one of two states (`applyListing` in `lib/apply/positions.ts`, issue #470): none public
shows "Roles we recruit for", an accent notice card with "Follow for updates" and every
placeholder role (34b); one or more show only the open positions (34). No state mixes the
two. A position is public when it is open, not deleted and the site-wide recruitment
switch is on (`isPublic`). Placeholder roles are a typed record in code
(`lib/apply/placeholder-roles.ts`), never read from the database, and carry a grey "CLOSED"
tag. Department pills filter the list when more than one department shows. Each department is
a `.glass-card` list whose rows are one Radix accordion: one row open at a time, opening and
closing at once, the open row on `white-5`. An open position ends with the voluntary note and
the paper "Apply for this role" pill to `/apply/<id>-<title>`; an open placeholder ends with a
lock and "This position is not accepting applications right now.", with no button. The
questions are the same accordion, a plus that turns to a minus.

**/partners** (boards 31, 31b and 31m, issue #107, `app/partners/page.tsx`,
`components/partners/`): the About page header with four figures (2 x 2 on phones), the main
partners, the media partners, then "Become a partner". Two figures count the main and media
partners; two show the budget split, read from Politecnico's share on the Our University page
(`partnerStats` in `lib/partners.ts`). There is no apply band: the footer sits in the sky. The partners are the published ones in the site order
the dashboard sets (issue #256), as the landing strip reads them. Each group is a centred
heading over glass partner cards (`.glass-card`, `partner-card.tsx`): one column on phones, two
from md and three from lg, a short row centred. A card holds the logo, the name, the one-liner
and "Visit website". Every desktop card has one fixed height at each width, sized for the
longest texts `lib/partners.ts` allows, so the cards of a row are equal and nothing moves on
hover. From md, hover or keyboard focus inside the card swaps the one-liner for the partner's
own text in the same grid cell, halves the logo and lights the edge in faint accent (board
31b), over 300ms ease-out, with no transition under reduced motion. On phones there is no
hover: "Read more" (`read-more.tsx`, the repo's Radix accordion, opening at once) shows the
same text in the card, which grows to hold it, beside the "Website" link. A partner with no website shows no link; one with no text of its
own has no swap and no "Read more". "Become a partner" (`become-partner.tsx`) is a
`.glass-card` box: eyebrow, title and body, then the paper "Write to us" pill, a mail link,
with the address under it; on phones the pill is full width under the body.

**Inside the team:** four figures, then four `.glass-card` link cards. Phones (board 24):
figures 2 x 2 with 52px numbers, each under its own hairline; link cards stacked
(`inside-team.tsx`).

**Partners:** no box and no fill; the page sky shows behind the logos. On phones (board 24):
26px heading, "Become a partner", then the logos at half size (25px, the Sophia mark 38px) in
a 56px marquee. Full-colour logos,
never greyscale. Right-to-left loop, 40s, paused on hover and off screen, still under reduced motion,
edges faded with a mask. A logo links to the partner's website when it has one; a partner with no website shows a plain logo (`partners.tsx`, HANDOFF).
Dark logos (issue #107): a logo whose alpha-weighted luminance gives under 3:1 contrast against
`ground` (`darkLogo`) is drawn all white with `brightness(0) invert(1)`, here and on /partners
(`components/partners/partner-logo.tsx`). There is no plate behind it and no recoloured file:
the partner's own file is served unchanged. This white drawing is not a recolour under the
brand-asset rule (Components above). The flag starts from the measurement (`measureLogo` in
`lib/logo-luminance.ts`): the dashboard sets it when a logo is uploaded, and the editor may
change it before saving (Owner decision, issue #394). `pnpm logos:check` (`scripts/logos-check.ts`) fails until each `darkLogo` flag in
`lib/partners.ts` equals the measurement.

**Apply band** (board 21): `bg-accent` (`#FF5E00`) with `public/textures/apply-band.webp` on
top in multiply at 60%. Eyebrow just "APPLY", with no year, at every width; headline "Build the / next one with us." at
80px, weight 800, vertically centred against the right block; body at 22px, then the inverted
"Apply to join" button. There is no open-positions count (`apply-band.tsx`). Phones (board
24): stacked, a 44px heading ("Build the next / one with us."), body 17px, and a full-width
button.

**Footer:** its own background: the page sky's streak tile and grain (`.page-sky-light`,
`.page-sky-grain`, no top fade), so it shows board 21's even dark streaks with no blotches,
plus a starfield and one shooting star about every 20s in the upper half. Brand block, then
four columns (About, Projects, Get involved, Contact); the email link is accent
(`footer.tsx`). From lg the brand block and the four columns are one row, each as wide as its
widest line, spread edge to edge, so every gap between columns is the same, brand to About
included. Phones (board 24): brand block, then the columns 2 x 2, then the address lines
stacked.

## Accessibility

- Reduced motion: the hero jumps to its settled state and mounts no rocket (`hero.tsx`).
  Every star twinkle and the partners marquee are off
  under reduced motion, and the footer shooting star is hidden (`hero-rocket-3d.tsx`,
  `projects.tsx`, `twinkle-star.tsx`, `marquee.tsx`, `shooting-star.tsx`). Nothing on the
  landing page animates continuously then (issue #59 replaced issue #33's kept twinkle). The
  card rocket has no idle motion at all, and its hover turn is off under reduced motion
  (`rocket-turn.tsx`). Any new motion must honour `prefers-reduced-motion`.
- Decorative layers (stars, fades, textures, `RocketArrow`) carry `aria-hidden` or `alt=""`.
  Meaningful images carry real alt text; logo links carry `aria-label` (`partners.tsx`).
- External links open with `target="_blank" rel="noopener noreferrer"`. Every landing link
  target lives in `lib/landing-links.ts` (`NEW_TAB`, `opensOf`); its unit test checks that each
  page link names a route and each external link opens in a new tab (issue #359).
- `lang="en"` on `<html>` (`app/layout.tsx`).

## What a reviewer checks

1. Colours come from the PRT tokens, or are a commented exception from the list above.
2. Fonts are Archivo or Geist Mono, in the type patterns above. The one exception is the
   Inter Tight "&" of ADR 0017, through its U+0026-only face.
3. Width, padding, radii and glass surfaces match the layout rules.
4. Hover uses the 300ms ease-out pattern, with no rise on a project card; links use
   `RocketArrow`.
5. The hero still follows ADR 0004: once, no pinning, no replay, no shake, no PNG.
6. Sections below the hero paint no background of their own; the page sky is the repeating
   streak tile plus the code-drawn grain, never one tall image; the shooting star appears only
   in the footer.
7. Any canvas uses `RevealOnFirstFrame`; there is no white flash on reload.
8. Reduced motion leaves no moving part in the change.
9. The change renders at 1440 x 900 and scales down without showing the next section.
   Hero shots: `node scripts/shoot-hero-settled.mjs <outdir>` against `pnpm preview`.
10. Copy has no em dashes.

## Open gaps

- **Footer projects.** The landing Projects section shows three projects (board 21), but the
  footer's Projects column still lists VES Mark II separately, as board 21's footer does.
- **Hover turn.** `handoff-hero-rocket.md` §8 describes a card hover where the rocket turns its
  nose toward the viewer, and board 21 a straight rise. Neither is built: the card rocket does
  not rise or move from its rest pose (Owner decision, 2026-10-06, issue #73); while its card is
  hovered it only turns about its own long axis in place (issue #385). The handoff and the board
  are stale there.
- **Focus styles.** Landing links and pills have no `focus-visible` style. Only
  `components/ui/` primitives do (`components/ui/button.tsx`).
- **Unused keyframes.** `rocket-hover`, `rocket-fly-in` and `shoot` in `tailwind.config.ts`
  are not used by the landing page.
- **Old font stack.** `app/globals.css` still sets Plus Jakarta Sans on `html`. The body class
  overrides it with Archivo.
- **Phone footer logo.** Board 24 draws the footer logo about 220px wide, narrower than the
  tagline's first line. The page keeps the board 21 rule (logo as wide as that line, about
  292px on phones) until the two boards agree.
- **Between phone and desktop.** Boards 21 and 24 cover 1440px and 390px. From 768px to
  1023px the page uses the desktop layout with the menu in place of the link row.
- **Subroutes.** Every page the site links to is built. `/projects`, the project pages,
  `/apply` and `/partners` have page rules above. The four `/about/*` pages and `/outreach`
  with its post pages (the news page) are built but have no page rules here yet.
