# Dashboard lists

How a dashboard list opens a row's side view, and how every dashboard search looks. Two rules,
one per section: a click on the row opens its side view, and every search is the one
`SearchField`. Issue #616 set both.

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
     Table views), Alumni (the desktop table), Partners
     ([partners.tsx](../components/dashboard/partners.tsx)) and FAQ
     ([faq.tsx](../components/dashboard/faq.tsx)).

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

Every dashboard list whose row opens a side view, and every search input under
`components/dashboard/`. A list inside a drawer or panel that opens no side view (the leads and
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
