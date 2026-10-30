---
id: 0015
title: "The public Team page is built from the team's roles; presentation changes go in a separate visual layer"
status: amended-in-part by [0016](0016-previews-read-their-own-seeded-branch.md), [0019](0019-team-page-stored-layout.md)
date: 2026-10-16
tags: [team, about, dashboard, content]
---

# 0015 — The public Team page is built from the team's roles; presentation changes go in a separate visual layer

**What this decides:** `/about/the-team` builds who leads, the departments and the core members from the team's roles in the database, so a title saved on the member panel reaches the public page. How the page presents people beyond that is a separate visual layer (epic #259), which never writes roles.

**Status:** Decisions 1, 2 and 3, the first binding constraint's department-kind exception, and the second and third binding constraints are superseded by [ADR 0019](0019-team-page-stored-layout.md): the page renders its own stored layout of page seats bound to team seats. Under 0019 a seat with no holder is hidden and never swaps the page to the hand-typed record; that record is read whole only where no stored layout can be read (no database). Decisions 4, 5 and 6 (contacts, read path, and the advisors, intro text, figures and group photo stores) and the photo-backfill exception stay in force.

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
5. **Read path.** The page reads the cached team snapshot (tag `team-roster`); every role write refreshes it. A preview with a database reads the seeded `preview` branch, like every other page there ([ADR 0016](0016-previews-read-their-own-seeded-branch.md)); the dummy team serves the page only where no database is configured.
6. **The rest of the page.** The advisors are a hand-added list stored apart from roles (the `team_page_advisors` store, `lib/about/advisors.ts`), seeded from the hand-typed record; the page shows the published list. The intro text and the group photo come from the visual layer; while the layer leaves one empty, the page keeps the hand-typed one. Only the header figures and "In numbers" stay hand-typed in `lib/about/team.ts`.

**Binding constraints.**
- Never write roles, divisions, departments, access or member records to change what the Team page shows; that is the visual layer's job. One exception (amended 2026-10-17, Owner decision on issue #325): a department's kind is an attribute of the department, set on New department and Edit department, and it is the one departments field that places a head on the Team page, by choosing the slide (item 2). Every other presentation change stays in the visual layer. A second, bounded exception (amended 2026-10-18, Owner decision on issue #371, https://github.com/PoliTo-Rocket-Team/website-v2/issues/371#issuecomment-6253561210): the current-site photo backfill, migration `drizzle/0041_current_site_photos.sql`, may set `members.picture` to a photo the site already ships under `public/team/`. It writes only a member whose picture is empty, matched by a name exactly one live user carries, so a photo a member uploaded is never replaced. This allows no other write to member records.
- Never add hand-typed people to the role build; a person the page shows beyond the roles comes from the visual layer.
- When the roles cannot fill a section the page always draws (no team leader, no board seat, no department head, no core member), the page reads the hand-typed record whole, never a mix of the two.

## Consequences

- The page shows the current team once the roles are complete; the hand-typed record is only a fallback and the source of the sections that are not built from roles.
- Placing someone other than the board seats on the arc (for example a department head) is a visual-layer edit, not a role change.
- The "Gap" line for #189 in `docs/dashboard-rules.md` is removed.

Followed today: the builder is [lib/about/team-roles.ts](../lib/about/team-roles.ts); the page's read is [lib/about/team-data.ts](../lib/about/team-data.ts); the snapshot is [lib/dashboard/team-database.ts](../lib/dashboard/team-database.ts); the visual layer is [lib/about/team-layer.ts](../lib/about/team-layer.ts), saved and published through [lib/about/team-page-editor.ts](../lib/about/team-page-editor.ts) (#283), and it holds the intro text and the group photo; the advisors are [lib/about/advisors.ts](../lib/about/advisors.ts), stored in `team_page_advisors` through [lib/dashboard/database-team-advisors.ts](../lib/dashboard/database-team-advisors.ts) (#286).

## Amendment, 2026-10-17

Decision 5 first read "Previews and dummy mode read the dummy team (ADR 0009), never a database." [ADR 0016](0016-previews-read-their-own-seeded-branch.md) superseded 0009: previews read the seeded `preview` branch, and the dummy arrays serve a page only where no database is configured (its Decision 5). Decision 5 above now says the same for the Team page, so the page reads roles on a preview with a database, and the seed fills the roles it reads. The rest of this record is unchanged.

## Amendment, 2026-10-18

Owner decision, 2026-10-18, on issue #371 (https://github.com/PoliTo-Rocket-Team/website-v2/issues/371#issuecomment-6253561210): photos are stored in the database and the pages read them from there. Each photo file ships with the repo, and its URL goes into the matching database row, people included, through a data migration and the seed. The first binding constraint now carries a second exception for that backfill: migration 0041 fills `members.picture` for members with no picture, from the photos `lib/about/team.ts` already names under `public/team/` ([lib/about/member-photos.ts](../lib/about/member-photos.ts)). Decision 4 is unchanged: the page still draws the photo from `members.picture`. The rest of this record is unchanged.

## Amendment, 2026-10-24

[ADR 0016](0016-previews-read-their-own-seeded-branch.md)'s amendment of 2026-10-24 (Owner decision on epic [#597](https://github.com/PoliTo-Rocket-Team/website-v2/issues/597), built by issue [#609](https://github.com/PoliTo-Rocket-Team/website-v2/issues/609)) retires the dummy fallback: under `next dev` and on a preview every page reads a database, and a run there with no database stops with a message naming the one it needs. This amendment retires Decision 5's "the dummy team serves the page only where no database is configured", and the 2026-10-17 amendment's "the dummy arrays serve a page only where no database is configured (its Decision 5)"; those lines stay as written. The Team page reads roles from the database under `next dev`, on a preview and in production; only production may run with no database, and there it still shows the hand-typed team ([lib/about/team-data.ts](../lib/about/team-data.ts)). The rest of this record is unchanged.
