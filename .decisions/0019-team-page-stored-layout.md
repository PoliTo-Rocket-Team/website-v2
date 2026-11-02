---
id: 0019
title: "The public Team page renders its own stored layout of page seats bound to team seats, in place of the roles build"
status: accepted
date: 2026-10-30
tags: [team, about, dashboard, content, layout]
---

# 0019 — The public Team page renders its own stored layout of page seats bound to team seats, in place of the roles build

**What this decides:** The Team page keeps its own list of seats, which the Team page editor changes. Each seat on the page points at a seat of the team record, so it shows whoever holds that seat now, or at one team member, so it shows that person while they hold an active role. Adding, moving or reordering a seat in the dashboard Team tree no longer moves the page's seats. Of the Team tree's writes, only a hand-over of a seat known by its `roles` row and a deleted seat change the layout, as Decisions 3 and 4 say.

## Context

[ADR 0015](0015-team-page-reads-roles.md) builds `/about/the-team` from the team's roles: who leads, the department blocks and the core members come from the roles build (`lib/about/team-roles.ts`), and the editor's visual layer (`lib/about/team-layer.ts`) edits the page that build produces: it can hide a spot, show another person in it, and add leaders, division leads and departments by person. So a seat added, moved or removed in the dashboard Team tree changes the spots the page starts from, and what the editor adds is tied to a person, not to a seat, so it does not follow a hand-over. The departments carousel is grouped by each department's kind, which is set in the Team tree's New department and Edit department panels, so a page grouping is decided in the org chart.

Owner decision, 2026-10-28, on epic [#835](https://github.com/PoliTo-Rocket-Team/website-v2/issues/835): the page gets its own stored layout of seats, changed only in the Team page editor; only who holds each seat follows the team record.

Owner decisions, 2026-10-29, in grilling session [#846](https://github.com/PoliTo-Rocket-Team/website-v2/issues/846): the core members list (R1.1), no vacant or unbound seat states (R2.1), what follows the team record (R2.2), where a department's kind is set (R2.3), department groups (R3.1) and the Edit department panel (R3.2). The same session established where the first layout is built and how a layer version with no layout is read meanwhile (R1.2), and why the cleanup ships later (R1.4). Owner decision R4.1 of the same session ([ruling](https://github.com/PoliTo-Rocket-Team/website-v2/issues/846#issuecomment-6528314386)) allows a page seat bound to one person: the snapshot binds each place today's layer shows a person in by swap or by adding them, and the editor's Add leader, Add department and added lead rows bind the person picked.

This record amends ADR 0015 in part. It replaces Decisions 1, 2 and 3 of 0015, the department-kind exception of its first binding constraint, and its second and third binding constraints, listed under "What this replaces in ADR 0015" below. Every other decision and binding constraint of 0015 stays in force, as that list says.

## Decision

**The public Team page draws its seats only from its own stored layout of page seats, each bound to a seat of the team record or to one team member, and the Team page editor changes that layout, with the exceptions Decision 1 names.**

1. **The stored layout.** The page draws an ordered set of page seats: the team leader, the seats on the arc, the department blocks (head and leads) and any other place the page shows. Each page seat holds one binding: a seat binding to one seat of the team record (Decision 2), or a person binding to one team member (Decision 3). The first fill of Decision 7 writes a layer version's first layout. After that, the Team page editor adds, removes or moves page seats, and it can bind a page seat to any seat of the team record or to a team member. Two Team tree writes are the only exceptions: a hand-over that moves page seats bound to the old `roles` row onto the new row (Decision 3), and deleting a team seat, which removes the page seats bound to it (Decision 4).
2. **Seat references.** A seat binding names one of these seats, built on the stable references team addresses already use (`MovesWith`, [lib/dashboard/team-address.ts](../lib/dashboard/team-address.ts)), plus a `roles` row for team-level seats with no flag and a place for co-leads:
   - the team leader;
   - a full-access seat, by its flag;
   - any other team-level seat, by its `roles` row;
   - a department head, by department;
   - a division lead, by division and place among its co-leads.
3. **People follow the team record; the layout does not (R2.2).** A page seat shows whoever holds its bound seat now. A leaver disappears from the page, and a new holder of the same seat shows in that place with no editor action. Seats added or reordered in the Team tree add or move no page seat until an editor does; meanwhile a new seat's holder shows in the core members list (Decision 5), unless a page seat already shows them. A hand-over of a team-level seat with no full-access flag ends its `roles` row and starts a new one, so that same write moves page seats bound to the old row onto the new row.
   A page seat bound to a person (R4.1) shows that member, by member id, while they hold an active role, whatever seat that is, and shows nothing while they hold none. A hand-over never passes it on: it stays bound to the same person.
4. **No vacant or unbound seat states (R2.1).** A page seat whose bound seat has no holder, or whose bound person holds no active role, is not shown, on the public page or in the editor. It keeps its place in the layout and shows again there when the seat has a holder or the person an active role. A page seat whose team seat was deleted is removed from the layout. There is no Rebind or Remove action for such seats.
5. **Core members (R1.1).** The core members list holds everyone with an active role whose person no page seat shows, by name, with the title their role carries.
6. **Department groups (R2.3, R3.1, R3.2).** A department's kind is a Team page distinction only. Each department block sits under exactly one department group. The Team page editor creates, renames, orders and deletes department groups; it refuses to delete a group that still holds departments. The public page draws the groups in their stored order with their stored names. The Team tree's New department and Edit department panels no longer ask for or show a kind. No Team page code reads `departments.kind`, except the snapshot function of Decision 7, in the uses listed there.
7. **The first layout and the snapshot path (R1.2).** The first stored layout is a snapshot of the seats the page shows today: today's roles build with today's layer applied, for the draft and the published version, with the per-spot edits carried over and today's two groups ("Technical Departments" and "Operations") with today's assignment. A place where today's layer shows a person in another person's spot, or adds a person, is bound to that person (R4.1). One snapshot function, written in TypeScript and never in SQL, derives a layout from a layer version, and only these three uses call it:
   - **First fill.** A post-migration step fills the layout of every stored layer version that has none, and changes nothing on a second run.
   - **Transitional read.** A layer version with no stored layout yet reads the layout the snapshot derives from its layer, so the order of deploy and migration does not matter.
   - **Reset to team.** Reset to team writes a draft whose layout the snapshot rebuilds from the team's roles with no layer edit, keeping the stored group list and each department's group, and keeping the layer's text. The editor's edit count, which Reset to team's button and its confirmation show, compares the content against that same rebuilt layout.

   The Team page editor saves its layout and the layer's text as it sends them, so a save never calls the snapshot.
8. **Additive release (R1.4).** The layout is stored beside today's layer, and every migration in this change is additive. The layer's people and layout fields (the leader edit, spots, added leaders, department edits and added departments) and the `departments.kind` column stay in the database in this release; any drop of them comes only in a later release, follow-up [#855](https://github.com/PoliTo-Rocket-Team/website-v2/issues/855), built only once the owner confirms the production snapshot ran. The intro text, figures and group photo stay in the layer, where the page reads them under ADR 0015 Decision 6, and #855 keeps them.
9. **The hand-typed fallback.** A page seat whose bound seat has no holder is hidden, as Decision 4 says, and never makes the page read the hand-typed record (`lib/about/team.ts`) instead. A team with no team leader or no department head still draws its stored layout without those seats, and a team with no core member still draws its stored layout. The page reads the hand-typed record whole only where no database is configured, so no stored layout can be read; [ADR 0015](0015-team-page-reads-roles.md)'s amendment of 2026-10-24 already limits that case to production. The seats and the core members come either from the stored layout and the team record, or all from the hand-typed record, never a mix of the two.

**What this replaces in ADR 0015.** These parts stay as written and no longer bind:
- Decision 1 (who leads, built from the roles: the team leader, then the board seats on the arc);
- Decision 2 (departments built from the roles and grouped by `departments.kind`, set on New department and Edit department);
- Decision 3 (core members as everyone else with an active role);
- in the first binding constraint, the first exception (a department's kind as the one departments field that places a head on the Team page);
- the second binding constraint ("a person the page shows beyond the roles comes from the visual layer");
- the third binding constraint (the hand-typed record read whole when the roles cannot fill a section), which Decision 9 replaces.

These parts of 0015 still stand: Decision 4 (contacts), Decision 5 (read path) and its amendments, Decision 6 as far as it keeps the advisors, intro text, figures and group photo in their current stores, and the first binding constraint with its photo-backfill exception. Decision 6's line that the figures stay hand-typed predates issue #510, since which the layer has stored editable figures. The first binding constraint still bars writes to the team record made to change what the page shows; the presentation work it gives the visual layer now belongs to the stored layout and the layer, which the Team page editor writes.

**Binding constraints.**
- Never build the Team page's seats, department blocks or core members from the roles build; the page resolves its stored layout against the team record. The snapshot function of Decision 7 is the one exception, and only for its first fill, transitional read and Reset to team with its edit count.
- A page seat bound to a person shows that person only while they hold an active role, and no Team tree write, a hand-over included, moves that binding to someone else.
- Never change the layout from a Team tree write; after the first fill of Decision 7, the Team page editor changes it. The two exceptions are a hand-over, which moves page seats bound to the old `roles` row onto the new row (Decision 3), and deleting a team seat, which removes the page seats bound to it (Decision 4).
- No vacant or unbound seat state, and no Rebind or Remove action for one.
- Never swap the whole page to the hand-typed record because a seat has no holder; read it whole only where no database is configured, so no stored layout can be read (Decision 9).
- No Team page code reads `departments.kind` outside the snapshot function of Decision 7.
- No SQL re-implements the roles build or the layer, and no destructive migration ships in the same release as the expand step.

## Consequences

- Adding, moving or reordering a seat in the Team tree leaves the stored layout of page seats unchanged, while a hand-over shows the new holder in the same page seat. Deleting a Team tree seat that a page seat is bound to removes that page seat (Decision 4).
- The core members list follows active roles (Decision 5): a person whose last active role ends leaves it, and the holder of a new seat joins it unless a page seat shows them.
- Two small visible changes land on release, accepted by the owner (R1.1): a person today's layer adds to a seat leaves the core members list, and a person in a spot today's layer hides joins it unless a page seat shows them.
- A seat that loses its holder drops off the page with no editor action, and comes back in place when it is filled again.
- Department grouping is set in the Team page editor, not in the Team tree, and is no longer limited to Technical and Operations.
- Until follow-up #855 lands, the layer's people and layout fields and `departments.kind` stay in the database, and the Team page reads them only through the snapshot function of Decision 7. The page keeps reading the layer's intro text, figures and group photo under ADR 0015 Decision 6.

## Amendment — 2026-10-31: a seat with several holders

Owner decision, 2026-10-31, on issue [#880](https://github.com/PoliTo-Rocket-Team/website-v2/issues/880): since epic [#861](https://github.com/PoliTo-Rocket-Team/website-v2/issues/861) a seat can have several holders, and a page seat bound to such a seat shows every holder, side by side in that seat's place, each with their own photo, name and contacts and the seat's title under the name. A seat with one holder looks as before.

This amends Decision 3 ("A page seat shows whoever holds its bound seat now"): a seat binding now resolves to every active holder of the seat, those the Team tree draws in it first, then by name.

- **Who a seat binding shows.** The team leader binding shows every team leader. A full-access seat shows every holder of its flag. A team-level seat with no flag is still named by one `roles` row (Decision 2), and shows every holder of the seat that row is, as the Team tree reads co-holders (the row's type and stored title, or its flag), so a co-holder on another row shows there too. A department head binding shows every head of the department, and the block draws its division leads once, under or beside that one place. These three places (the team leader's, an arc place and a head place) draw every holder.
- **A division lead row draws one person.** A lead row and a person binding still show one person each. A lead row bound to a seat with several holders shows the first holder only, and only that person counts as shown, so each further holder stays in the core members unless another place draws them. When the editor picks a person for a lead row, the row is bound to the seat they hold only while they are its one holder; a co-holder picked for a lead row (for example the second of two department heads) is bound to themselves, so the row shows the person picked.
- **Overrides.** A page seat's role override reads under every holder's name. Its name, photo and LinkedIn overrides were written for one person, so they apply only while the place has one holder; on a place with several, each holder shows their own.
- **One place per co-held seat.** On a place that draws every holder, a further holder of a seat the place shows is bound to that seat (the editor's person pick and the snapshot of Decision 7 alike), not to themselves. Where two places of a stored layout that draw every holder name one co-held seat (for example by two of its rows), the first draws the holders and the second is not drawn; it keeps its place in the layout, as Decision 4 keeps a place with no holder. This is the only case a place is left undrawn as a repeat: the repeat is the seat, never the people, so two seats with the same holders (for example two departments headed by the same two people) each draw their own place. The arc keeps at most eight places, whatever their holders.
- **The snapshot.** The snapshot of Decision 7 gives a co-held seat one page seat, whichever `roles` rows its holders sit on, and that page seat draws every holder. A role, name, photo or LinkedIn edit on a further holder's own spot has no place on that page seat, so the snapshot names it among the parts of the layer it does not carry.
- **The stored form does not change.** A page seat still holds one binding, so no stored layout is rewritten, and every layout stored before this amendment parses as before. A place whose seat has one holder draws as before; a place whose seat now has several draws every holder as above. Core members (Decision 5) leave out every holder a drawn place shows.

## Records

New terms in `.glossary/TERMS.md`: page seat, seat binding, department group. No vacant or unbound seat term.
