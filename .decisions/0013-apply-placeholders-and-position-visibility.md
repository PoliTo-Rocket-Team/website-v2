---
id: 0013
title: "/apply shows code-written placeholder roles by open count, and a position is public only when its lead opened it and recruitment is on"
status: accepted
date: 2026-10-10
tags: [apply, recruitment, positions]
---

# 0013 — /apply shows code-written placeholder roles by open count, and a position is public only when its lead opened it and recruitment is on

**What this decides:** The /apply page never looks empty. When few or no positions are open, it also shows the roles the team usually recruits for, marked closed. Those roles are written in code. A real position shows on the site only when its lead opened it and the operations lead's site-wide recruitment switch is on.

## Context

Decided 2026-10-10 by the project owner. Approval: https://github.com/PoliTo-Rocket-Team/website-v2/issues/181#issuecomment-6095711336. The rule texts are in the original report of issue #181. The page was built in issue #119 (boards 34, 34b, 34c); the recruitment switch in issue #121.

Who may open a position and who may flip the switch is a dashboard access rule. Those tables are in the dashboard rules doc, [docs/dashboard-rules.md](../docs/dashboard-rules.md) (issue #180), and are not copied here.

## Decision

**/apply shows placeholder roles written in code, by how many positions are open, and a position is public only when its lead opened it and the site-wide recruitment switch is on.**

1. **Placeholder roles live in code, never in the database.** They are the roles the team usually recruits for, shown marked closed.
2. **How many show depends on the number of public positions:**
   - 0 open: placeholders only.
   - 1 to 4 open: the open positions, then placeholders for the departments with nothing open.
   - 5 or more open: no placeholders.
3. **A position is public only when both hold:** its lead opened it, and the operations lead's site-wide recruitment switch is on. With the switch off, no position is public.

**Binding constraints.**
- Never read placeholder roles from the database.
- Never show a position on the public site that its lead did not open, or while the recruitment switch is off.
- The thresholds are 0, 1 to 4, and 5 or more. Change them only with a new ruling.

## Consequences

- The page has content in every season, even with recruitment closed.
- Placeholder text changes need a code change, not a dashboard edit.

## Gaps

None found. `placeholderRoles` in [lib/apply/placeholder-roles.ts](../lib/apply/placeholder-roles.ts) is written in code; `applyListing` and `FEW_OPEN_MAX = 4` in [lib/apply/positions.ts](../lib/apply/positions.ts) apply the three counts; `isPublic` there requires `recruitment.isOpen && position.status && !position.is_deleted`.

## Records

Terms: placeholder role, recruitment switch, public position. Rows in [.glossary/TERMS.md](../.glossary/TERMS.md).
