# Design system manifest

The design law for the PoliTo Rocket Team website as it renders on `main`. Build and review of any
rendered change reads this page. It records what the code already does; it invents nothing.

> **Pending replacement.** The approved redesign lives on the `huey/landing-page` branch
> (`design/HANDOFF.md`, `design/prt-website.pen`, and a new token set in `tailwind.config.ts`).
> When that branch lands, rewrite this page from those sources. Until then, this page describes
> `main`.

## Stack

- Next.js App Router pages under `app/`, shared components under `components/`.
- Tailwind CSS 3 (`tailwind.config.ts`) with shadcn/ui primitives in `components/ui/`
  (`components.json`: style `default`, base colour `neutral`, CSS variables on).
- Theme switching through `next-themes` with the `class` strategy; the default theme is `system`.

## Colour

- Components paint with the shadcn role tokens (`background`, `foreground`, `card`, `primary`,
  `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`), defined as HSL
  variables in `app/globals.css` for `:root` (light) and `.dark`.
- The brand palette sits beside them in `tailwind.config.ts`:
  - `rocket` orange `#FF4B00` (hover `#E04400`, light `#FF8350`) is the one brand accent.
  - `space` (`#121212` background, `#1A1A1A` surface), `mission` greys and `cosmos` text greys
    serve the dark look. The dark `--background` matches `space.black`.
- Do not hard-code a hex value in a component. Use a role token, or a named brand token when the
  role tokens have no match.

## Type

- One family: Plus Jakarta Sans, loaded once through `next/font/google` in `app/layout.tsx`.
- Do not add a second family without a decision record.

## Shape and layout

- Corner radius comes from `--radius` (`0.5rem`) through the `lg` / `md` / `sm` radius tokens.
- Page width is bounded by `components/max-width-wrapper.tsx` and the Tailwind container
  (centred, `2rem` padding, `1400px` at `2xl`).

## Components

- Reach for an existing `components/ui/` primitive before writing a new control.
- Toasts go through `sonner` (`components/ui/sonner.tsx`).

## Prohibitions

- No colour outside the role and brand tokens above.
- No font family other than Plus Jakarta Sans.
- Every page renders in both light and dark themes; a change that breaks one is a failure.
