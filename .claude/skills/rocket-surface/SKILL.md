---
name: rocket-surface
description: Make a rocket GLB read as a photo, not a render, on the site's Three.js stages. Use when adding a new vehicle model (VES, VES Mark II, Efesto) to the hero or a project page, when a rocket looks cartoony, plastic or shiny, or when fins are paper-thin or shift color as the rocket moves.
---

# Rocket surface

Cavour in `components/landing/hero-rocket-3d.tsx` is the reference implementation and the single source of truth for every number. This skill is the process and the gotchas that code cannot tell you. Read the file first; copy from it, do not re-derive.

The look the founder signed off on (2026-09-16), in their words: matte, worn, "unfinished" paint; fins a shade lighter than the body black, dull, no lines; sun on the camera side; no top-edge highlight. The old Blender render in `public/design/cavour-hero.png` is not the target.

## Steps

1. **Inspect the GLB before touching materials.** Run `python3 .claude/skills/rocket-surface/inspect-glb.py public/design/<model>.glb`. It prints every mesh with its material and whether it has UVs, and every material's base color, metalness, roughness and extensions. Done when you can name: the fin meshes, any plume/effect meshes to drop, which meshes lack UVs, and which material is the paint.

2. **Map names.** Cavour's code matches material names (`Aluminium`, `Titanium`, `Livery`, `DecalStrip`, `Seam`, `Decal White`) and mesh names (`/^fin\d/i`, `/plume/i`). A new GLB will name things differently. Extend the matching rather than renaming the asset. Done when every material in the inspect output falls into one branch of the material switch.

3. **Fix zero-thickness sheets.** Fins often ship as single-sided sheets (inspect shows a bounding box with one axis at 0). Scaling zero gives zero; route them through `extrudeSheet` as Cavour does. Keep the edges square-cut, thickness at `FIN_THICKNESS_OF_SPAN`. Done when a side-on screenshot shows a visible edge on the up/down fins.

4. **Reuse the paint and metal recipes.** Body paint: the `Livery` branch (roughness, faint clearcoat, env intensity) plus `PROFILES.paint` weathering. Fins and bare metal: the `Aluminium` branch plus `PROFILES.metal`. Weathering in `hero-weathering.ts` is position-based, so it works on meshes without UVs. Done when no material in the model is left at its GLB defaults.

5. **Verify against the bob.** Run `node scripts/shoot-hero-settled.mjs <outdir>` with the dev server up. It writes the settled hero and two fin crops three seconds apart. Done when the two crops match in brightness and no streak lines are visible on flat surfaces.

## Gotchas

- **Flat surfaces are mirrors.** A fin facing the camera reflects whatever sits behind the camera. Any hard lamp there, or any curved rim (fillet, chamfer, round-over) on the fin, sweeps across the HDRI as the rocket bobs and the fin visibly shifts color. Keep fins dull (the `Aluminium` numbers) and square-cut. The founder rejected fillets twice for this reason.
- **Brushed streaks flash on flat plates.** Low-roughness grooves under a frontal sun read as anime speed lines that move. `PROFILES.metal` keeps `streak` near zero on purpose.
- **The HDRI rotation is load-bearing.** `environmentRotation` puts the studio's softboxes behind the camera so the mid-body sheen (kept by the founder) comes from there and the top-edge highlight (rejected) does not. Rotating it the other way put a warm lamp on the nose and turned the orange yellow.
- **The sun is at the camera.** One shadow-casting directional light on the camera side, slightly above eye level, so there are no angles to manage. Top-down keys were rejected.
- **No post-processing on the hero canvas.** Bloom through an EffectComposer turns the transparent canvas into an opaque gray box. Glow comes from additive sprites in `hero-plume.tsx`.
- **Color values are linear.** `color.setRGB(0.14, ...)` is linear; the hex you see in the console is sRGB and looks three times lighter. Compare by screenshot, not by hex.
- **Plume is separate.** Engine work lives in `hero-plume.tsx` and is the founder's "engine" topic, not "rocket". Keep the two conversations apart.
