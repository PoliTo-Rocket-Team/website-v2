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

Owner decision, 2026-10-17, on the Team page layout (issue #325, https://github.com/PoliTo-Rocket-Team/website-v2/issues/325): the rendered page matches the approved boards 26, 26b, 26d, 26e, 26f and 26m. Each department carries a kind, Technical or Operations, and the departments carousel groups heads by kind into the "Technical Departments" and "Operations" slides of those boards, not one "All departments" slide. Item 2 below is amended to say so.

## Decision

**Route A: the page reads roles. Presentation is a visual layer on top of the role build, never a write to roles.**

1. **Who leads.** The team leader (the `president` role), then the board seats (Project Manager, Chief Engineer) on the arc, in the Team tree's seat order. The arc keeps the `OrgChart.leaders` reading order and its cap of eight.
2. **Departments.** Every open department's head and the leads of that department's divisions, grouped by the department's kind (amended 2026-10-17, issue #325). Each department has a kind, `technical` or `operations` (the `departments.kind` column; the team leader sets it on New department and Edit department, boards 77d and 77e). Technical departments come first, on slides headed "Technical Departments": each head with their division leads under them. Operations departments follow, on slides headed "Operations": each head with no leads under them, then each division lead drawn at a head's level, as board 26 draws Operations. Within a kind, departments and divisions keep their order. A kind fills slides of up to ten places, so a kind with more than ten takes more slides under the same heading; the carousel keeps at most five slides. The first version of this item filled slides of ten heads in department order regardless of kind, headed "All departments" when one slide held every head.
3. **Core members.** Everyone else with an active role, by name, with the title their role carries in the dashboard.
4. **Contacts.** Photo from `members.picture`, LinkedIn from `users.linkedin`, team email from `members.prt_email`. A missing value is an absent key, so the page draws the PRT mark or initials and no empty link.
5. **Read path.** The page reads the cached team snapshot (tag `team-roster`); every role write refreshes it. Previews and dummy mode read the dummy team (ADR 0009), never a database.
6. **The rest of the page.** The advisors are a hand-added list stored apart from roles (the `team_page_advisors` store, `lib/about/advisors.ts`), seeded from the hand-typed record; the page shows the published list. The intro text and the group photo come from the visual layer; while the layer leaves one empty, the page keeps the hand-typed one. Only the header figures and "In numbers" stay hand-typed in `lib/about/team.ts`.

**Binding constraints.**
- Never write roles, divisions, departments, access or member records to change what the Team page shows; that is the visual layer's job. One exception (amended 2026-10-17, Owner decision on issue #325): a department's kind is an attribute of the department, set on New department and Edit department, and it is the one departments field that places a head on the Team page, by choosing the slide (item 2). Every other presentation change stays in the visual layer.
- Never add hand-typed people to the role build; a person the page shows beyond the roles comes from the visual layer.
- When the roles cannot fill a section the page always draws (no team leader, no board seat, no department head, no core member), the page reads the hand-typed record whole, never a mix of the two.

## Consequences

- The page shows the current team once the roles are complete; the hand-typed record is only a fallback and the source of the sections that are not built from roles.
- Placing someone other than the board seats on the arc (for example a department head) is a visual-layer edit, not a role change.
- The "Gap" line for #189 in `docs/dashboard-rules.md` is removed.

Followed today: the builder is [lib/about/team-roles.ts](../lib/about/team-roles.ts); the page's read is [lib/about/team-data.ts](../lib/about/team-data.ts); the snapshot is [lib/dashboard/team-database.ts](../lib/dashboard/team-database.ts); the visual layer is [lib/about/team-layer.ts](../lib/about/team-layer.ts), saved and published through [lib/about/team-page-editor.ts](../lib/about/team-page-editor.ts) (#283), and it holds the intro text and the group photo; the advisors are [lib/about/advisors.ts](../lib/about/advisors.ts), stored in `team_page_advisors` through [lib/dashboard/database-team-advisors.ts](../lib/dashboard/database-team-advisors.ts) (#286).
