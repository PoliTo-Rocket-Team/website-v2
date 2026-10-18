---
id: 0017
title: "The \"&\" glyph is drawn from Inter Tight, the one allowed exception to the two type families"
status: accepted
date: 2026-10-18
tags: [type, fonts, design-system]
---

# 0017 — The "&" glyph is drawn from Inter Tight, the one allowed exception to the two type families

**What this decides:** the site keeps two type families, Archivo and Geist Mono. One glyph is the
exception: the ampersand "&" (U+0026) comes from Inter Tight, at weights 400 to 900, from a font
face that claims U+0026 and nothing else. No other Inter Tight glyph and no other third family is
allowed without a new decision record.

## Context

Decided 2026-10-18 by the project owner (Owner decision), recorded on issue
[#363](https://github.com/PoliTo-Rocket-Team/website-v2/issues/363) under its Scope section.
Archivo's own "&" is a narrow, old-style shape. Beside Archivo's other letters it reads as a glyph
from another font, in "Mission & Vision", "R&D", "Design & Manufacturing" and other headings and
menu items. The latin subset of Archivo includes U+0026, so the shape is Archivo's design, not a
fallback. The design manifest says "Do not add a third family without a decision record". This is
that record.

## Decision

1. **One glyph, one face.** The face `--font-ampersand` carries Inter Tight's "&" only. It is a
   subset of the Inter Tight variable font with that single glyph, self-hosted at
   `app/fonts/inter-tight-ampersand.woff2`.
2. **It claims U+0026 only.** The face is loaded with `next/font/local` in `app/layout.tsx`, with
   `unicode-range: U+0026`. Every other character falls through to Archivo.
3. **First in the display stack.** `fontFamily.display` in `tailwind.config.ts` lists
   `var(--font-ampersand)` before `var(--font-display)` (Archivo), so every `font-display` text,
   which is the body default, draws "&" from Inter Tight.
4. **Same weights as Archivo.** The face is variable over 400 to 900, the range Archivo is loaded
   at, so a bold heading gets a bold "&".
5. **License.** Inter Tight is under the SIL Open Font License 1.1, which allows subsetting and
   self-hosting.
6. **No wider third family.** This exception covers U+0026 alone. Drawing any other glyph from
   Inter Tight, or adding any other family, needs its own decision record.

## Consequences

- The design manifest's Type section and its reviewer check on fonts name this exception, so a
  review does not read the face as an undocumented third family.
- Pages load one more small font file (about 1.4 KB).
- `font-mono` (Geist Mono) is unchanged: its "&" stays Geist Mono's own.

Followed today: the face is `ampersand` in [app/layout.tsx](../app/layout.tsx); the stack is
`fontFamily.display` in [tailwind.config.ts](../tailwind.config.ts).
