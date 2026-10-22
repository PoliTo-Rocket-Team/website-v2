---
id: 0014
title: "A person may hold several divisions at once under one team NDA, so a member joins a new division with no second NDA"
status: accepted
date: 2026-10-11
tags: [team, divisions, recruitment, dashboard]
---

# 0014 — A person may hold several divisions at once under one team NDA, so a member joins a new division with no second NDA

**What this decides:** One person can be in several divisions at the same time, as a lead or a member, even across departments. The team has one NDA. Someone already on the team never signs a second one, so when they are accepted for a position in another division, Confirm join adds them to that division at once and they keep every division they were in.

## Context

Owner decision, 2026-10-11, recorded in the "Owner decisions" section of issue #229 (https://github.com/PoliTo-Rocket-Team/website-v2/issues/229). The team already works this way: one person can lead one division and be a member of another. The dashboard assumed one division per person, so such a person showed up in one place only, and Confirm join would have asked an existing member for a second NDA.

This record supersedes rule 7 ("One person, one division") of [0011](./0011-applicant-journey-received-to-joining.md) and amends its Confirm join rule (rule 5) for people already on the team. The rest of 0011 still holds: Accept is not join, and a new person joins only through Confirm join after the signed NDA is back.

## Decision

**A person may hold several divisions at once, as lead or member and across departments, and the team has one NDA, so Confirm join for someone already on the team waits for no NDA.**

1. **Several divisions per person.** A person's divisions are a list, each with its own role (lead or member). The list never names one division twice.
2. **Picking a lead keeps the rest.** Making someone the lead of one division never moves them out of their other divisions.
3. **One NDA for the whole team.** A person signs it once, when they first join. A member never signs a second one, and no second NDA date is recorded.
4. **Confirm join for an existing member.** When the accepted applicant is already on the team, there is no NDA wait. The lead adds them to the position's division, after an "are you sure" confirm, and they keep every other division. Someone new, or someone coming back after leaving, still waits for the signed NDA as 0011 rule 5 says.
5. **Team tree.** Each person is drawn once, under one division, with a dashed line to every other division they are in.

**Binding constraints.**
- Never move a person out of a division because they became the lead of another.
- Never ask a current member for a second NDA, and never record one for them.
- Never draw one person twice on the Team tree.

## Consequences

- Every page that reads "the" division of a person must read the list. Pages that still show one division name the follow-up issue (#230, #231, #232, #233).
- The `roles` table already holds several active rows per member, so no schema change is needed.

Followed today: the memberships model and the home-division rule are in [lib/dashboard/team.ts](../lib/dashboard/team.ts); a member's standing and the no-NDA Confirm join are in [lib/dashboard/application-flow.ts](../lib/dashboard/application-flow.ts); the dashboard rules are in [docs/dashboard-rules.md](../docs/dashboard-rules.md).

## Records

Terms: confirm join, joining (redefined for members). Rows in [.glossary/TERMS.md](../.glossary/TERMS.md).
