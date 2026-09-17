---
name: rocket-surface
description: Build a vehicle in Three.js code for the site's stages and make it read as a photo, not a render. Use when adding a new vehicle model (VES, VES Mark II, Efesto) to the hero or a project page, when a rocket looks cartoony, plastic or shiny, or when fins are paper-thin or shift color as the rocket moves.
---

# Rocket surface

Cavour in `components/landing/rocket-cavour.tsx` is the reference implementation and the single source of truth for every number: it is built in code (lathe body, fin plates, nozzle, livery wrap, decal patches), no mesh file is served. Reference meshes stay in `design/` (not `public/`, so they never ship). This skill is the process and the gotchas that code cannot tell you. Read the file first; copy from it, do not re-derive.

The look the founder signed off on (2026-09-16), in their words: matte, worn, "unfinished" paint; fins a shade lighter than the body black, dull, no lines; sun on the camera side; no top-edge highlight. The old Blender render in `public/design/cavour-hero.png` is not the target.

## Steps

1. **Measure before modeling.** With a reference GLB: put it in `design/` (never `public/`) and run `python3 .claude/skills/rocket-surface/inspect-glb.py design/<model>.glb` for meshes, materials and UVs; then dump vertices (see how Cavour's `NOSE_R`, `FIN_OUTLINE`, seams and decal angles were read off `design/cavour.glb`). With only a side-on photo: measure body radius, nose length, fin root/tip chords and sweep as fractions of the body length. Done when every constant at the top of a new `rocket-<name>.tsx` has a measured source.

2. **Build from Cavour's parts.** Copy `rocket-cavour.tsx`: `lathe` for body, nose, seams and nozzle; `finGeometry` (ExtrudeGeometry, square-cut, thickness `0.026 × span`); `hullPatch` for decals and lettering; the same UV rule so a wrap texture maps the same way. Done when the new file exports a component taking `{ weather, length }` like `CavourBuilt`.

3. **Reuse the materials verbatim.** `makeMaterials` in `rocket-cavour.tsx` holds the signed-off numbers: paint (roughness, faint clearcoat, env intensity, `PROFILES.paint`), fins and bare metal (`aluminium`, dark base 0.065, `PROFILES.metal`), seams (`PROFILES.trim`). Livery: the vehicle's own wrap PNG in `public/design/<name>/`, or a canvas of color bands plus logo PNGs. Done when no mesh uses a material outside that set.

4. **Verify against the bob.** Run `node scripts/shoot-hero-settled.mjs <outdir>` with the site served (`pnpm preview`). It writes the settled hero and two fin crops three seconds apart. Done when the two crops match in brightness and no streak lines are visible on flat surfaces.

## Gotchas

- **Flat surfaces are mirrors.** A fin facing the camera reflects whatever sits behind the camera. Any hard lamp there, or any curved rim (fillet, chamfer, round-over) on the fin, sweeps across the HDRI as the rocket bobs and the fin visibly shifts color. Keep fins dull (the `aluminium` numbers) and square-cut. The founder rejected fillets twice for this reason.
- **Fins are darker than their material says.** The approved tone came from the GLB era, where the extruded fin sheets shadowed themselves and never saw the sun. Correct geometry gets full sun, so built fins carry a darker base (0.065 vs the body-metal 0.14) to land on the same tone.
- **Belly light is driven, not fixed.** `hero-rocket-3d.tsx` gates the environment light on down-facing surfaces (`uBelly`, `uDown` in the weathering shader) and adds a lamp from below, both following the rocket's height on screen. Do not add a fixed fill from below; the founder called it "still fixed".
- **Brushed streaks flash on flat plates.** Low-roughness grooves under a frontal sun read as anime speed lines that move. `PROFILES.metal` keeps `streak` near zero on purpose.
- **The HDRI rotation is load-bearing.** `environmentRotation` puts the studio's softboxes behind the camera so the mid-body sheen (kept by the founder) comes from there and the top-edge highlight (rejected) does not. Rotating it the other way put a warm lamp on the nose and turned the orange yellow.
- **The sun is at the camera.** One shadow-casting directional light on the camera side, slightly above eye level, so there are no angles to manage. Top-down keys were rejected.
- **No post-processing on the hero canvas.** Bloom through an EffectComposer turns the transparent canvas into an opaque gray box. Glow comes from additive sprites in `hero-plume.tsx`.
- **Color values are linear.** `color.setRGB(0.14, ...)` is linear; the hex you see in the console is sRGB and looks three times lighter. Compare by screenshot, not by hex.
- **Plume is separate.** Engine work lives in `hero-plume.tsx` and is the founder's "engine" topic, not "rocket". Keep the two conversations apart.
