---
id: 0015
title: "The public Team page is built from the team's roles; presentation changes go in a separate visual layer"
status: accepted
date: 2026-10-16
tags: [team, about, dashboard, content]
---

# 0015 — The public Team page is built from the team's roles; presentation changes go in a separate visual layer

**What this decides:** `/about/the-team` builds who leads, the departments and the core members from the team's roles in the database, so a title saved on the member panel reaches the public page. How the page presents people beyond that is a separate visual layer (epic #259), which never writes roles.

## Context

Issue #189 asked which route makes the public Team page show the title saved on the member panel. The page read a hand-typed record (`lib/about/team.ts`), so a saved title went nowhere. It listed three routes: A, build the page's people from the database; B, overlay only the titles on the hand-typed record; C, keep the page static and relabel the panel field.

Owner decision, 2026-10-16, on the Team page design (epic #259, https://github.com/PoliTo-Rocket-Team/website-v2/issues/259): the page's people come from the team's roles by default, and an editor on the real page changes only what the page shows.

## Decision

**Route A: the page reads roles. Presentation is a visual layer on top of the role build, never a write to roles.**

1. **Who leads.** The team leader (the `president` role), then the board seats (Project Manager, Chief Engineer) on the arc, in the Team tree's seat order. The arc keeps the `OrgChart.leaders` reading order and its cap of eight.
2. **Departments.** Every open department's head, with the leads of that department's divisions under them, in department and division order. Heads fill carousel slides of up to ten, at most five slides.
3. **Core members.** Everyone else with an active role, by name, with the title their role carries in the dashboard.
4. **Contacts.** Photo from `members.picture`, LinkedIn from `users.linkedin`, team email from `members.prt_email`. A missing value is an absent key, so the page draws the PRT mark or initials and no empty link.
5. **Read path.** The page reads the cached team snapshot (tag `team-roster`); every role write refreshes it. Previews and dummy mode read the dummy team (ADR 0009), never a database.
6. **Still hand-typed.** The header figures, "In numbers", the advisors, the intro text and the group photo stay in `lib/about/team.ts` until later slices of #259 make them editable.

**Binding constraints.**
- Never write roles, divisions, departments, access or member records to change what the Team page shows; that is the visual layer's job.
- Never add hand-typed people to the role build; a person the page shows beyond the roles comes from the visual layer.
- When the roles cannot fill a section the page always draws (no team leader, no board seat, no department head, no core member), the page reads the hand-typed record whole, never a mix of the two.

## Consequences

- The page shows the current team once the roles are complete; the hand-typed record is only a fallback and the source of the sections that are not built from roles.
- Placing someone other than the board seats on the arc (for example a department head) is a visual-layer edit, not a role change.
- The "Gap" line for #189 in `docs/dashboard-rules.md` is removed.

Followed today: the builder is [lib/about/team-roles.ts](../lib/about/team-roles.ts); the page's read is [lib/about/team-data.ts](../lib/about/team-data.ts); the snapshot is [lib/dashboard/team-database.ts](../lib/dashboard/team-database.ts); the visual layer is [lib/about/team-layer.ts](../lib/about/team-layer.ts), saved and published through [lib/about/team-page-editor.ts](../lib/about/team-page-editor.ts) (#283).
