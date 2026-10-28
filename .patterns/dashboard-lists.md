# Dashboard lists

How a dashboard list opens a row, and how every dashboard search looks. Three rules, one per
section: a click on a record row opens its side view, a click on a content row or its Edit chip
opens its editor, and every search is the one `SearchField`. Issue #616 set the first and the
last, issue #617 the second.

## A row click opens the side view

1. **The whole row is the target.** A click anywhere on a row, or on a phone card, opens that
   row's side view. Each list builds its row one of three ways:
   - **The row is a button.** Orders (the desktop rows and the phone cards in
     [division-orders.tsx](../components/dashboard/division-orders.tsx)), Applications
     ([applications.tsx](../components/dashboard/applications.tsx)), Access (the grant rows in
     [division-access.tsx](../components/dashboard/division-access.tsx)) and the Members and
     Alumni phone cards ([team-members.tsx](../components/dashboard/team-members.tsx),
     [alumni.tsx](../components/dashboard/alumni.tsx)).
   - **The title covers the row.** Positions
     ([positions.tsx](../components/dashboard/positions.tsx), `ROW_TARGET`): the title is a
     button whose `::after` covers the whole row, and the open switch sits above the cover.
   - **The row takes the click and its name is a `RowOpen`.** A table row or a draggable item
     cannot be a button, so the `<tr>` or `<li>` has `onClick`, and the name inside it is
     `RowOpen` from [row-open.tsx](../components/dashboard/row-open.tsx). Members (the List and
     Table views) and Alumni (the desktop table). The content lists Partners and FAQ take the
     click on the row too, and their keyboard way in is the Edit chip (next section).

2. **The keyboard reaches every row.** Each of the three shapes above has a focusable button that
   opens the side view on Enter or Space: the row itself, the covering title, or `RowOpen`.
   `RowOpen` stops its own click, so the row's `onClick` does not run a second time.

3. **A control that does its own thing stops the click.** The Alumni "Shown / Hidden" switch, the
   Members actions cell (`onClick={(e) => e.stopPropagation()}` on its `<td>`), the row menus
   (`RowMenu` in [content-parts.tsx](../components/dashboard/content-parts.tsx) wraps its trigger
   in a span that stops the click) and the Members Table view's phone, birth date and gender
   cells. A click there never opens the side view.

4. **The three-dot menu holds only secondary actions, and it is never a way into the side view.**
   Remove from a division, Leaves the team, Move up, Move down, Remove. No menu item opens the
   side view: on Partners and FAQ the shared `RowMenu` gets no `onEdit`, so it shows no Edit item.
   A row with no secondary actions has no three-dot button at all (a Members row the viewer cannot
   change).

```tsx
<tr onClick={onOpen} className="cursor-pointer …">
  <td>
    <RowOpen label={`Fix how ${row.name} shows`} onOpen={onOpen} className="block truncate …">
      {row.name}
    </RowOpen>
  </td>
  <td onClick={(event) => event.stopPropagation()}>
    <SiteSwitch row={row} editable={editable} />
  </td>
</tr>
```
([components/dashboard/alumni.tsx](../components/dashboard/alumni.tsx))

## A row click or its Edit chip opens a content editor

The content lists hold what the public site shows: Projects
([projects.tsx](../components/dashboard/projects.tsx)), Outreach
([outreach.tsx](../components/dashboard/outreach.tsx)), Partners
([partners.tsx](../components/dashboard/partners.tsx)) and FAQ
([faq.tsx](../components/dashboard/faq.tsx)). Their rows open an editor, not a side view.

1. **A click anywhere on the row, or on a phone card, opens the editor.** That is the editor page
   for Projects (`/dashboard/projects/<slug>`) and Outreach (`/dashboard/outreach/<slug>`), and
   the edit side panel for Partners and FAQ. No row has a separate "Edit page" button.

2. **Each row ends in an Edit chip, `EditChip` from
   [row-open.tsx](../components/dashboard/row-open.tsx).** It is the edit shell's accent Edit
   chip with a pencil; on phones it is the pencil alone. It is the row's keyboard way in: Tab
   reaches it, and Enter or Space opens the editor. Where a row has a three-dot menu, the chip
   sits just before it. `EditChip` takes one of two targets:
   - **`{ href }`, an editor page.** The chip is a link whose `::after` covers the row, so the
     `<li>` is `relative`, and each control in it that does its own thing (the Projects
     "View on site" link, the Outreach row menu) is `relative z-10` to sit above the cover.
   - **`{ onOpen }`, a side panel.** A draggable row cannot be a link, so the `<li>` has
     `onClick` and `group/row`, and the chip is a button that stops its own click, so the panel
     opens once.

3. **A control that does its own thing stops the click.** The row menus, the Projects
   "View on site" link (above the cover) and the drag grip (`DragGrip` in
   [content-parts.tsx](../components/dashboard/content-parts.tsx)) never open the editor. The
   whole Partners or FAQ row still drags to a new order; the grip only shows where.

4. **The three-dot menu holds only secondary actions.** Outreach: View on site, Feature or
   Unfeature, Unpublish, Delete. Partners and FAQ: Move up, Move down, Remove. No menu offers
   Edit. Projects has no menu (Owner decision on #506).

```tsx
<li className="relative … hover:bg-white-5">
  <span>{title}</span>
  <StatusPill status={status} short />
  <EditChip label={`Edit ${title}`} target={{ href: `/dashboard/outreach/${row.slug}` }} />
  <span className="relative z-10 shrink-0">
    <RowMenu label={`More for ${title}`}>…</RowMenu>
  </span>
</li>
```
([components/dashboard/outreach.tsx](../components/dashboard/outreach.tsx))

## One search bar

Every search under [components/dashboard/](../components/dashboard/) is `SearchField` from
[search-field.tsx](../components/dashboard/search-field.tsx): 40px tall (`h-10`), `rounded-xl`,
14px text and a 16px search icon. Its `placeholder` is also what a screen reader hears. Only the
width changes per place, through `className`: `md:w-[260px]` or `md:w-[240px]` beside a list's
filters, the full width of a popover or drawer (`className="mb-1"` or `"mt-2.5"`, no width).

Callers: Alumni, Members, Team tree and its edit view
([team-tree.tsx](../components/dashboard/team-tree.tsx),
[team-tree-edit.tsx](../components/dashboard/team-tree-edit.tsx)), Applications, Access,
Positions, the Edit division drawer's Members section
([division-drawer.tsx](../components/dashboard/division-drawer.tsx)), the column filter popover
([column-filter.tsx](../components/dashboard/column-filter.tsx)) and the Orders Department filter
([division-orders.tsx](../components/dashboard/division-orders.tsx)).

## When this applies

Every dashboard list whose row opens a side view, every content list whose row opens an editor,
and every search input under `components/dashboard/`. A list inside a drawer or panel that opens no side view (the leads and
members in the Edit division drawer) is not covered by the first rule.

Not covered: person pickers (`PersonCombobox` in
[person-combobox.tsx](../components/dashboard/person-combobox.tsx)) are form fields that choose a
person, not list searches. The public site's search
([components/about/core-members.tsx](../components/about/core-members.tsx)) follows the public
design.

## Why it is not obvious

- A `<tr onClick>` alone works with a mouse and is out of reach from the keyboard. The row needs a
  button inside it, and that button must stop its click or the row opens twice.
- A three-dot button that only opens the side view reads as "menu" on one row and "open" on the
  next.
- A whole row cannot be a link while it holds another link and a menu (nested interactive
  elements). The Edit chip's `::after` covers the row instead, and the row's own controls sit
  above it.
- Search inside a popover looks like a different control, so a smaller hand-made input is easy to
  add there. It is the same `SearchField`, at full width.

## Known inconsistencies

- The Members waiting rows (people waiting for Confirm NDA) open no side view; "Fill details" in
  their menu opens the Edit details panel.
- `RowMenu` in [content-parts.tsx](../components/dashboard/content-parts.tsx) still takes an
  optional `onEdit`. The text blocks in the Edit post panel
  ([outreach-post-panel.tsx](../components/dashboard/outreach-post-panel.tsx)) pass it to open a
  block in place; that panel is not a list with a side view.
- The Applications side view is its own non-modal dialog, not `SidePanel`; it still opens on a
  row click.
- On Applications, Access and Positions the filters beside the search are 32px tall (`h-8`),
  under the 40px search.
