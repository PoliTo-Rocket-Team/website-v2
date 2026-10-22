---
id: 0013
title: "/apply shows code-written placeholder roles only when no position is public, and a position is public only when its lead opened it and recruitment is on"
status: accepted
date: 2026-10-10
tags: [apply, recruitment, positions]
---

# 0013 — /apply shows code-written placeholder roles only when no position is public, and a position is public only when its lead opened it and recruitment is on

**What this decides:** The /apply page never looks empty. When no position is open, it shows the roles the team usually recruits for, marked closed. When one or more positions are open, it shows only those. Placeholder roles are written in code. A real position shows on the site only when its lead opened it and the operations lead's site-wide recruitment switch is on.

## Context

Decided 2026-10-10 by the project owner. Approval: https://github.com/PoliTo-Rocket-Team/website-v2/issues/181#issuecomment-6095711336. The rule texts are in the original report of issue #181. The page was built in issue #119 (boards 34, 34b, 34c); the recruitment switch in issue #121.

Amended 2026-10-21 by Owner decision, recorded in issue #470 (https://github.com/PoliTo-Rocket-Team/website-v2/issues/470): /apply has two states, not three. The middle state (one to four open positions, then the closed placeholders of departments with nothing open, board 34c) is removed, because applicants read those closed roles under the open ones as roles they cannot apply to.

Who may open a position and who may flip the switch is a dashboard access rule. Those tables are in the dashboard rules doc, [docs/dashboard-rules.md](../docs/dashboard-rules.md) (issue #180), and are not copied here.

## Decision

**/apply shows placeholder roles written in code only when no position is public, and a position is public only when its lead opened it and the site-wide recruitment switch is on.**

1. **Placeholder roles live in code, never in the database.** They are the roles the team usually recruits for, shown marked closed.
2. **The page has two states, by whether any position is public** (amended 2026-10-21, issue #470):
   - 0 public, recruitment switch off included: placeholders only.
   - 1 or more public: the open positions only, no placeholders.
3. **A position is public only when both hold:** its lead opened it, and the operations lead's site-wide recruitment switch is on. With the switch off, no position is public.

**Binding constraints.**
- Never read placeholder roles from the database.
- Never show a position on the public site that its lead did not open, or while the recruitment switch is off.
- Two states only: 0 public shows placeholders only; 1 or more public shows open positions only. No state mixes open positions and placeholders. Change this only with a new ruling (current ruling: Owner decision of 2026-10-21, issue #470).

## Consequences

- The page has content in every season, even with recruitment closed.
- Placeholder text changes need a code change, not a dashboard edit.

## Gaps

None found. `placeholderRoles` in [lib/apply/placeholder-roles.ts](../lib/apply/placeholder-roles.ts) is written in code; `applyListing` in [lib/apply/positions.ts](../lib/apply/positions.ts) applies the two states; `isPublic` there requires `recruitment.isOpen && position.status && !position.is_deleted`.

## Records

Terms: placeholder role, recruitment switch, public position. Rows in [.glossary/TERMS.md](../.glossary/TERMS.md).
