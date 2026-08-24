# 0004 — Hero entrance choreography and one-shot lift-off

**What this decides:** How the landing hero animates on load, on scroll, and on return — ruled by the founder 2026-08-24 in a grilling round. This supersedes the earlier pinned-hero scroll states (Pencil boards 04b/04c dim-out): the founder rejected pinning outright ("wtf pinned hero?").

## Decision

**Entrance (on load and on every replay):**
1. Title "POLITO ROCKET TEAM" and slogan "BORN FOR SPACE" appear as one tight block, vertically centered where the rocket will settle. Title words slide up staggered (~75ms apart, same effect as the current SvelteKit site); slogan slides down in after the title.
2. Hold ~2s. Then the block separates over ~1.2s — title rises to its final y120, slogan drops to its final y464.
3. Simultaneously the rocket drives in from the left over ~4-5s, slow ease-out — heavy machinery, SpaceX pace, never bullet-fast — trailing smoke, settling in the hero's center band.
4. Body copy, hairline, and the EST./IREC/EUROC strip fade in during separation.

**Scroll:** at ~15-20% scroll depth the rocket lifts off up-right and leaves the hero. **One-shot triggered animation** — it never scrubs or reverses with the scrollbar. The page scrolls normally; there is no pinned section.

**Replay:** when the hero is ~fully visible again (and the rocket already left), the whole entrance replays from the gathered block.

**Fallback:** no static PNG render, ever. If WebGL is unavailable (or reduced motion), the hero is just title + slogan (+ copy) in their final positions.

## Context

Founder spec (2026-08-24): delayed title+slogan reveal as on the current site; gathered→separated block; slow heavy rocket entrance with smoke; lift-off on scroll; full replay on return; PNG backup removed. Recommendations for one-shot trigger, full-visibility replay gate, and timing (~2s hold, ~1.2s separation, ~4.5s drive-in) accepted as answered ("2 one-shot…, 3 when hero is fully visible, 4 yes, 5 yes").

## Records

supersedes the pinned-hero behavior described in prt-design/HANDOFF.md (boards 04b/04c scroll dimming)
