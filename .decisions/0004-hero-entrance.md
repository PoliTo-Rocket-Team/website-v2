---
id: 0004
title: "Hero entrance choreography"
status: accepted
date: 2026-09-18
---

# 0004 — Hero entrance choreography

**What this decides:** How the landing hero animates on load — ruled by the founder
2026-08-24 in a grilling round, amended 2026-09-17 and 2026-10-19.

Two things it supersedes:

- The pinned-hero scroll states (Pencil boards 04b/04c dim-out). Owner decision
  (2026-08-24): the hero is not pinned; the pinned-hero scroll states are rejected.
- Its own first version, which had the rocket lift off on scroll and replay the whole
  entrance when the hero came back into view. Both were dropped on 2026-09-17
  (commit af9e7a4). See "Amendment" below.

## Decision

**Entrance, once per page load:**

1. Title "POLITO ROCKET TEAM" and slogan "BORN FOR SPACE" appear as one tight block,
   gathered where the rocket will park. Title words slide up staggered; the slogan
   slides down in after the title.
2. Hold 2s (`HOLD_MS`).
3. The rocket climbs in from off-screen lower-left, over the type, decelerating, nose
   easing 14° to 6° up, parking at 6°. Takes 7s (`DRIVE_MS`) — heavy machinery, Starship
   pace, never bullet-fast. It trails a shader plume.
4. On the same curve, the title rises and the slogan drops to make room.
5. Once the rocket has parked, the body copy, hairline and the EST./IREC/EUROC strip
   fade in.

**Scroll:** nothing. The page scrolls normally, there is no pinned section, and the
rocket stays parked.

**Motion of the parked rocket:** none. Once parked, the rocket holds still: no bob, no
vibration or shake. (It bobbed slowly until the amendment of 2026-10-19 below.)

**Reduced motion:** the hero jumps straight to its settled state — type, copy and strip
in final positions, no entrance.

**Fallback:** no static PNG render, ever. Without WebGL the hero is title + slogan + copy.

## Amendment, 2026-09-17

The scroll lift-off and the full replay were built, then cut.

Why: the lift-off meant the rocket was absent for most of the page, and the replay
re-ran a 9-second entrance every time you scrolled back up. Both fought the reader
instead of serving them. The hero is now a still, lit scene you return to, not a loop.

What replaced the lift-off's job of making the hero feel alive: the belly light. A white
glow builds on the rocket's underside as it climbs in and fades once it parks, driven
each frame by how low the rocket sits on screen. Details in
`design/handoff-hero-rocket.md`.

## Amendment, 2026-10-19

Owner decision (2026-10-19, issue #385): the parked rocket holds still. The slow bob is
gone, so once the plume has faded the hero canvas holds its finished frame and draws
again only when a resize clears it. The drive-in and everything before it are unchanged.

Why: idle CPU. The bob kept the canvas drawing while the page sat idle. With the card
rockets also still at rest, a landing page nobody touches now draws no 3D frames. The
ruling is recorded on the issue:
https://github.com/PoliTo-Rocket-Team/website-v2/issues/385#issuecomment-6255998651

## Context

Founder spec (2026-08-24): delayed title+slogan reveal as on the current site;
gathered-then-separated block; slow heavy rocket entrance with smoke; PNG backup
removed. Owner decision (2026-08-24): the recommendations for the one-shot entrance
trigger and its timing were accepted; the parts of that decision covering lift-off and
replay were later reversed by the 2026-09-17 amendment above.

Built in `components/landing/hero.tsx`, `hero-rocket-3d.tsx`, `rocket-cavour.tsx`,
`hero-plume.tsx`. The timing constants named here live in `hero.tsx` — trust the code
over this file if they ever disagree.

## Records

supersedes the pinned-hero behavior described in prt-design/HANDOFF.md (boards 04b/04c
scroll dimming)
