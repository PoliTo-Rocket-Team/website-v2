# Hero rocket session — handoff (2026-09-17)

What was decided and why, in the order we talked about it. Branch `huey/landing-page`,
commits a558fdd, a36197a, fa2fccc, all pushed. Numbers live in the code; this file
holds the reasons and the open items. Wider project context: `design/HANDOFF.md`.

## 1. Viewing the site without the dev server
- `next dev` eats too much memory on the user's Mac (16 GB).
- Use `pnpm preview` (= `pnpm build` then `pnpm start`, port 3000). Build takes ~25 s.
- After every change: rebuild, restart, then look. Stop it with `lsof -ti:3000 | xargs kill`.
- A killed `pnpm start` reports exit 143. That is normal.
- There is no `pnpm lint` script. Type check with `pnpm exec tsc --noEmit`.

## 2. Cavour is now built in code
- File: `components/landing/rocket-cavour.tsx`. It is the hero default. No mesh is served.
- Why: no CAD access, faster hero load, and the next three vehicles can reuse the parts.
- Every number (nose curve, fin outline, ring heights, decal and lettering placement,
  nozzle) was measured off the Blender GLB, not eyeballed.
- The paint wrap and decal strip were pulled out of the GLB into `public/design/cavour/`.
- Texture mapping copies the GLB's layout, so those two PNGs drop straight on.

## 3. Matching fins and nose to the GLB
- Nose: my first radius table was made up and looked wrong. Replaced with 58 radii
  measured from the GLB's points. Lesson: measure, never invent.
- Fins: the built fins came out lighter than the GLB's. The GLB fins had flipped
  normals, so they shadowed themselves and never saw the sun. That dark tone is the
  look the user approved, so the built fins use a darker base metal (0.065 vs 0.14).
- "CAVOUR" lettering: weight 300 read too thin, 400 is approved.

## 4. Belly light (light on the rocket's underside)
- User wanted: no fixed glow under the hull; a white glow that appears as the rocket
  comes onto the screen and fades once it parks. White, not soft blue.
- First try (a lamp from below only) still looked fixed. Cause: the studio HDRI's
  floor was lighting the underside all the time.
- Fix: the wear shader (`hero-weathering.ts`) dims environment light on down-facing
  parts by `uBelly`, and a white lamp from below adds the punch. Both are driven each
  frame in `hero-rocket-3d.tsx` from how low the rocket sits on screen, read from the
  `[data-rocket-stage]` element in `hero.tsx`. "Down" follows the element's CSS tilt.
- The old fixed fill lamp from below was removed. Do not add one back.
- Approved by the user ("yes good").

## 5. Hero title and slogan shading
- They read as flat pure white next to the lit rocket.
- Now: a top-to-bottom white-to-grey gradient clipped to the text, plus a soft shadow.
  Class `.hero-type` in `app/globals.css`.
- The gradient sits on each animated word, not the parent, because moving children
  break text clipping. The shadow is `filter: drop-shadow`, because `text-shadow`
  shows through see-through text.
- The sun is at the camera ("screen is the sun"), so the shadow sits almost straight
  behind the text, nudged a little down-left. A straight-down shadow was rejected.

## 6. The GLB file
- `design/cavour.glb` stays in the repo as the measurement reference only.
- It is not under `public/`, so it is never served. Its loader code was removed.
- Do not move it back under `public/`.

## 7. Why the Mac felt slow
- 16 GB RAM, ~1.5 GB swap in use, ~40 days since last reboot.
- The browser (Arc) and WindowServer were the top CPU users while the hero tab was open.
  The hero redraws every frame at up to 2x pixel ratio with a 2048 shadow map.
- The Next server itself was small (~155 MB).
- APPLIED and approved 2026-09-18: pixel ratio cap 1.5 and shadow map 1024 in
  `hero-rocket-3d.tsx`. No visible difference on screen or in the fin crops.
  Note `shoot-hero-settled.mjs` shoots at deviceScaleFactor 1, so it cannot judge
  the pixel ratio cap at all — only a real Retina screen can.

## How the user wants visual work done
- One change per pass, then one yes/no question. NO screenshots after each step
  (2026-09-19: "who told you to screenshot on every step"). He looks at localhost
  himself. Screenshot only for things he cannot see (flash frames, pixel checks) or
  when asked.
- Never bundle extra tweaks. "Revert" means back to the exact named state.
- Screenshots: `node scripts/shoot-hero-settled.mjs <outdir>` against `pnpm preview`
  (set `HERO_URL` for another address). Pixel sampling is unreliable because of the bob.

## 8. Project cards now render Cavour live in 3D (2026-09-18/19)
Board 06 Projects. What was built, and why, so nobody re-derives it.

- `components/landing/rocket-card-3d.tsx` = a second Three.js canvas per card. It
  reuses `CavourBuilt` (the code-built Cavour) with the same HDRI, materials and
  camera-side sun as the hero. All four cards use Cavour for now; VES / VES Mark II
  / Efesto reuse it as a stand-in until each is built (they set `model: true` in
  `projects.tsx`).
- Idle: nose-up, leaning right (`LEAN`), parked low (`PARKED_Y`), pushed back from
  the camera (`PARKED_Z`), shifted right (`PARKED_X`) so the near fins stay in frame.
- Hover: the vehicle itself pivots nose-toward-you (`TURN`) and climbs (`RISE`),
  eased over ~2s (`EASE`). The founder was firm: the ROCKET turns and rises, the
  camera never dollies in. "Coming toward the viewer" = the rocket pivots, not the
  camera moving. All the tuning constants live at the top of the file; change those,
  not the JSX.
- The canvas is taller than the card and hangs over the top (`-top-64`), so the nose
  can leave the card. Hover is read off the `<article>`, and the canvas takes no
  pointer events (`pointerEvents: none`). A raycast-the-rocket hover was tried and
  the founder rejected it — do not re-add it.
- Card text was squeezed to the bottom and the render zone grown (`h-[26rem]`) to
  give the rocket room.
- `?cam` on the URL swaps in OrbitControls + a live EYE readout for tuning the camera.

## 9. Canvases flashed white on reload — fixed (2026-09-19)
- Cause: between the WebGL context being made and the first draw, the buffer is
  uninitialised and macOS GPUs show it as solid white. Hit both the hero and the
  four cards.
- Fix, two parts: `<html style="background:#0B0B0C;color-scheme:dark">` in
  `app/layout.tsx` (root paints dark before CSS loads), and
  `components/landing/reveal-on-first-frame.tsx` — each canvas starts at
  `opacity-0` (class on the wrapper, so it is hidden from the very first paint) and
  `RevealOnFirstFrame` flips it to 1 after the second drawn frame.
- The white flash people still see WITH Dark Reader on is the extension inverting the
  dark page, not our bug. Confirmed clean in Chromium and WebKit with no extensions.
- WebKit/Safari is just SLOW to first paint: five canvases each build Cavour + load
  the 1.6 MB HDRI, so the rockets can take ~10s to appear. Not a bug.

## Open items
- **NEXT: shaders / surface on the card rockets.** The card canvas copied the hero's
  materials but its own lights (`directionalLight` positions, no shadow map). The
  founder wants the card rockets' texture and shading improved next. Start from
  `rocket-card-3d.tsx` lights + `makeMaterials`/weathering in `rocket-cavour.tsx`
  and `hero-weathering.ts`; keep the approved look from
  `.claude/skills/rocket-surface/SKILL.md`.
- VES, VES Mark II, Efesto: build in code the same way. Needs one side-on photo each
  plus logo PNGs from the user. Follow `.claude/skills/rocket-surface/SKILL.md`.
- ~~`.decisions/0004` describes the old lift-off and replay~~ Rewritten 2026-09-18 and
  renamed to `.decisions/0004-hero-entrance.md`.
