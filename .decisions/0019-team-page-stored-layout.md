---
id: 0019
title: "The public Team page renders its own stored layout of page seats bound to team seats, never a layout built from the roles"
status: accepted
date: 2026-10-30
tags: [team, about, dashboard, content, layout]
---

# 0019 — The public Team page renders its own stored layout of page seats bound to team seats, never a layout built from the roles

**What this decides:** The Team page keeps its own list of seats, changed only in the Team page editor. Each seat on the page points at a seat of the team record, so it shows whoever holds that seat now. Adding, moving or reordering a seat in the dashboard Team tree no longer moves the page's seats; only a hand-over and a deleted seat change the layout, as Decisions 3 and 4 say.

## Context

[ADR 0015](0015-team-page-reads-roles.md) builds `/about/the-team` from the team's roles: who leads, the department blocks and the core members come from the roles build (`lib/about/team-roles.ts`), and the editor's visual layer (`lib/about/team-layer.ts`) edits the page that build produces: it can hide a spot, show another person in it, and add leaders, division leads and departments by person. So every seat added, moved or removed in the dashboard Team tree changes the spots the page starts from, and what the editor adds is tied to a person, not to a seat, so it does not follow a hand-over. The departments carousel is grouped by each department's kind, which is set in the Team tree's New department and Edit department panels, so a page grouping is decided in the org chart.

Owner decision, 2026-10-28, on epic [#835](https://github.com/PoliTo-Rocket-Team/website-v2/issues/835): the page gets its own stored layout of seats, changed only in the Team page editor; only who holds each seat follows the team record.

Owner decisions, 2026-10-29, in grilling session [#846](https://github.com/PoliTo-Rocket-Team/website-v2/issues/846): the core members list (R1.1), no vacant or unbound seat states (R2.1), what follows the team record (R2.2), where a department's kind is set (R2.3), department groups (R3.1) and the Edit department panel (R3.2). The same session established where the first layout is built and how a layer version with no layout is read meanwhile (R1.2), and why the cleanup ships later (R1.4). The storage child [#850](https://github.com/PoliTo-Rocket-Team/website-v2/issues/850) plans the interim save that keeps today's editor working until it moves to the layout.

This record amends ADR 0015 in part. It replaces Decisions 1, 2 and 3 of 0015 and three of its binding constraints, listed under "What this replaces in ADR 0015" below. Every other part of 0015 stays in force.

## Decision

**The public Team page renders only its own stored layout of page seats, each bound to a seat of the team record and never to a person, and only the Team page editor changes that layout.**

1. **The stored layout.** The page draws an ordered set of page seats: the team leader, the seats on the arc, the department blocks (head and leads) and any other place the page shows. Each page seat holds a seat binding to one seat of the team record, never to a person. Only the Team page editor adds, removes or moves page seats, and it can bind a page seat to any seat of the team record. Two Team tree writes are the only exceptions: a hand-over that moves page seats bound to the old `roles` row onto the new row (Decision 3), and deleting a team seat, which removes the page seats bound to it (Decision 4).
2. **Seat references.** A seat binding names one of these seats, built on the stable references team addresses already use (`MovesWith`, [lib/dashboard/team-address.ts](../lib/dashboard/team-address.ts)), plus a `roles` row for team-level seats with no flag and a place for co-leads:
   - the team leader;
   - a full-access seat, by its flag;
   - any other team-level seat, by its `roles` row;
   - a department head, by department;
   - a division lead, by division and place among its co-leads.
3. **People follow the team record; the layout does not (R2.2).** A page seat shows whoever holds its bound seat now. A leaver disappears from the page, and a new holder of the same seat shows in that place with no editor action. Seats added or reordered in the Team tree add or move no page seat until an editor does; meanwhile a new seat's holder shows in the core members list (Decision 5). A hand-over of a team-level seat with no full-access flag ends its `roles` row and starts a new one, so that same write moves page seats bound to the old row onto the new row.
4. **No vacant or unbound seat states (R2.1).** A page seat whose bound seat has no holder is not shown, on the public page or in the editor. It keeps its place in the layout and shows again there when the seat has a holder. A page seat whose team seat was deleted is removed from the layout. There is no Rebind or Remove action for such seats.
5. **Core members (R1.1).** The core members list holds everyone with an active role whose person no page seat shows, by name, with the title their role carries.
6. **Department groups (R2.3, R3.1, R3.2).** A department's kind is a Team page distinction only. Each department block sits under exactly one department group. The Team page editor creates, renames, orders and deletes department groups; it refuses to delete a group that still holds departments. The public page draws the groups in their stored order with their stored names. The Team tree's New department and Edit department panels no longer ask for or show a kind. No Team page code reads `departments.kind`, except the snapshot function of Decision 7, in its first fill, transitional read and interim save.
7. **The first layout and the snapshot path (R1.2).** The first stored layout is a snapshot of what the page shows today: today's roles build with today's layer applied, for the draft and the published version, with every per-spot edit carried over and today's two groups ("Technical Departments" and "Operations") with today's assignment. One snapshot function, written in TypeScript and never in SQL, derives a layout from a layer version, and only these three uses call it:
   - **First fill.** A post-migration step fills the layout of every stored layer version that has none, and changes nothing on a second run.
   - **Transitional read.** A layer version with no stored layout yet reads the layout the snapshot derives from its layer, so the order of deploy and migration does not matter.
   - **Interim save.** Until the Team page editor moves to the layout, a save still sends a layer, and the server stores that layer and its snapshot layout in one write.
8. **Additive release (R1.4).** The layout is stored beside today's layer, and every migration in this change is additive. The old layer data and the `departments.kind` column are dropped only in a later release, follow-up [#855](https://github.com/PoliTo-Rocket-Team/website-v2/issues/855).
9. **The hand-typed fallback.** A page seat whose bound seat has no holder is hidden, as Decision 4 says, and never makes the page read the hand-typed record (`lib/about/team.ts`) instead. A team with no team leader, no department head or no core member still draws its stored layout, without those seats. The page reads the hand-typed record whole only where it cannot read a stored layout at all: where no database is configured, which [ADR 0015](0015-team-page-reads-roles.md)'s amendment of 2026-10-24 already limits to production. It never mixes the two.

**What this replaces in ADR 0015.** These parts stay as written and no longer bind:
- Decision 1 (who leads, built from the roles: the team leader, then the board seats on the arc);
- Decision 2 (departments built from the roles and grouped by `departments.kind`, set on New department and Edit department);
- Decision 3 (core members as everyone else with an active role);
- in the first binding constraint, the first exception (a department's kind as the one departments field that places a head on the Team page);
- the second binding constraint ("a person the page shows beyond the roles comes from the visual layer");
- the third binding constraint (the hand-typed record read whole when the roles cannot fill a section), which Decision 9 replaces.

These parts of 0015 still stand: Decision 4 (contacts), Decision 5 (read path) and its amendments, Decision 6 (advisors, intro text, figures and group photo in their current stores), and the first binding constraint with its photo-backfill exception.

**Binding constraints.**
- Never build the Team page's seats, department blocks or core members from the roles build; the page resolves its stored layout against the team record. The snapshot function of Decision 7 is the one exception, and only for its first fill, transitional read and interim save.
- Never bind a page seat to a person; bind it to a seat of the team record.
- Never change the layout from a Team tree write; only the Team page editor changes it. The two exceptions are a hand-over, which moves page seats bound to the old `roles` row onto the new row (Decision 3), and deleting a team seat, which removes the page seats bound to it (Decision 4).
- No vacant or unbound seat state, and no Rebind or Remove action for one.
- Never swap the whole page to the hand-typed record because a seat has no holder; read it only where no stored layout can be read.
- No Team page code reads `departments.kind` outside the snapshot function of Decision 7.
- No SQL re-implements the roles build or the layer, and no destructive migration ships in the same release as the expand step.

## Consequences

- Adding, moving or reordering a seat in the Team tree leaves the stored layout of page seats unchanged, while a hand-over shows the new holder in the same page seat. Deleting a Team tree seat that a page seat is bound to removes that page seat (Decision 4).
- The core members list follows active roles (Decision 5): a person whose last active role ends leaves it, and the holder of a new seat no page seat shows joins it.
- Two small visible changes land on release, accepted by the owner (R1.1): a person today's layer adds to a seat leaves the core members list, and a person in a spot today's layer hides joins it.
- A seat that loses its holder drops off the page with no editor action, and comes back in place when it is filled again.
- Department grouping is set in one place, the Team page editor, and is no longer limited to Technical and Operations.
- Until follow-up #855 lands, the old layer data and `departments.kind` stay in the database, unread by the Team page except through the snapshot function of Decision 7.

## Records

New terms in `.glossary/TERMS.md`: page seat, seat binding, department group. No vacant or unbound seat term.
