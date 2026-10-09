---
id: 0007
title: "The shipper merges pull requests through the merge queue, and only control-plane or ready-for:human ones wait for Huey"
status: accepted
date: 2026-10-09
tags: [process, agents, merge-queue]
---

# 0007 — The shipper merges pull requests through the merge queue, and only control-plane or ready-for:human ones wait for Huey

**What this decides:** When a pull request passes its required checks and reviews, the shipper agent merges it through GitHub's merge queue. Huey only has to act on pull requests that touch the control plane (workflows, agent settings, git hooks) or that carry the `ready-for:human` label.

## Context

PR #136 (https://github.com/PoliTo-Rocket-Team/website-v2/pull/136, "chore: let the shipper merge through a merge queue", merged 2026-10-09) set this route up, but no decision record said so. Huey approved the route in chat on 2026-10-09 ("okay so you can use all these"), quoted at https://github.com/PoliTo-Rocket-Team/website-v2/issues/137#issuecomment-6081238745.

The model is the sibling repo's ADR 0006, which made a passing review the merge gate and let the shipper merge, with its two amendments: one moved merging to the merge queue and took the rule files out of CODEOWNERS, and one made the queue also require `ci-required`.

## Decision

**Code pull requests merge through the "landing-page merge queue" once their required verdicts pass at head; only control-plane or `ready-for:human` pull requests wait for Huey.**

1. **The queue.** The "landing-page merge queue" ruleset (id 24788684, active) on `huey/landing-page` puts every merge through the merge queue. It requires two status checks: the secrets scan (`scan PR files for secrets and machine-local paths`) and `ci-required`. `ci-required` fails a queue entry while the pull request carries `ready-for:human`, so that label is a real hold.
2. **CODEOWNERS keeps only Fabrika's fixed control-plane paths.** `.github/CODEOWNERS` lists `/.claude/`, `/.github/` and the lefthook files, plus the control-plane rows Fabrika names that do not exist here yet. Fabrika's `codeowners-cp` guard requires those rows, so workflow, agent-setting and git-hook changes still need Huey's sign-off.
3. **Rule files are gated by the governance verdict, not by CODEOWNERS.** `.decisions/`, `AGENTS.md`, `CLAUDE.md`, `.fabrika.jsonc` and the design manifest are listed in `governedRoots` in `.fabrika.jsonc`. A change to them merges through the shipper once its required verdicts, governance included, pass at head.
4. **Who waits for Huey.** Code pull requests merge through the queue with no human step. Only a control-plane pull request (one that touches a CODEOWNERS path) or a `ready-for:human` one waits for him.

**Binding constraints.**
- The shipper merges only through the queue. No direct merge into `huey/landing-page`.
- Huey's hold is the `ready-for:human` label. An agent never removes it to get a pull request merged.
- Do not add rule files back to CODEOWNERS to get a stop; the governance verdict is their gate.
- Do not drop a required check from the ruleset without a new ruling.

## Consequences

- Most pull requests ship without Huey. He reviews what he chooses to hold.
- Rule files are guarded by reviews, not by a hard stop. A bad governance verdict could let one through; that is the accepted tradeoff.
- `ci-required` reads labels only on merge queue entries, so a hold works at the queue, not on the pull request page.

## Records

no vocabulary impact
