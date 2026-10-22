# Phone layouts

How the redesigned dashboard changes shape on a phone: a popup becomes a bottom sheet, a right-side
panel becomes a full page with a back arrow and pinned actions, and a table becomes a list of
stacked cards. Each is one component or one class pair that does both forms, switched by a
Tailwind breakpoint, not a second component per screen size.

## The shape

1. **Popups are bottom sheets.** `SHEET_CONTENT` in
   [components/dashboard/confirm-dialog.tsx](../components/dashboard/confirm-dialog.tsx) is a
   bottom sheet below `sm` (pinned to the bottom, rounded top, `SheetGrabber` bar on top, slides up
   under `motion-safe`) and a centred card from `sm`. `SHEET_BUTTONS` stacks the action over the way
   out on phones and puts them side by side from `sm`. Callers that reuse the frame:
   [confirm-dialog.tsx](../components/dashboard/confirm-dialog.tsx),
   [decision-dialog.tsx](../components/dashboard/decision-dialog.tsx),
   [interview-dialog.tsx](../components/dashboard/interview-dialog.tsx) and
   [photo-crop-dialog.tsx](../components/dashboard/photo-crop-dialog.tsx). The user menu does the
   same as `UserSheet` in [user-card.tsx](../components/dashboard/user-card.tsx).

2. **Right-side panels are full pages on phones.** `SidePanel` in
   [components/dashboard/drawer.tsx](../components/dashboard/drawer.tsx) is `fixed inset-0` below
   `md`, with an `ArrowLeft` "Back" button (`md:hidden`) where the desktop panel has a close `X`
   (`hidden md:flex`). From `md` it is a 440px panel on the right. The footer with the actions is
   pinned at the foot in both forms. Callers:
   [member-drawer.tsx](../components/dashboard/member-drawer.tsx) and
   [division-orders.tsx](../components/dashboard/division-orders.tsx). The application panel in
   [applications.tsx](../components/dashboard/applications.tsx) builds its phone page with
   `PhoneTopBar` from [shell.tsx](../components/dashboard/shell.tsx), the same bar the shell uses,
   with a back arrow in place of the menu.

3. **Tables are stacked cards.** A page renders both forms and hides one per breakpoint:

   ```tsx
   {/* From lg a table (board 57); below it stacked cards (board 57m). */}
   <div className={`${PANEL} mt-4 hidden overflow-hidden lg:block`}>…</div>
   <ul className="mt-3 flex flex-col gap-2.5 lg:hidden">…</ul>
   ```
   ([components/dashboard/positions.tsx](../components/dashboard/positions.tsx))

   The same pair, at `md`, is in [members.tsx](../components/dashboard/members.tsx) and
   [division-orders.tsx](../components/dashboard/division-orders.tsx).

4. **Panels start closed.** A page keeps its open panel in state that starts empty:
   `useState<number | null>(null)` for `openId` in
   [members.tsx](../components/dashboard/members.tsx), `useState<Open>(CLOSED)` in
   [division-orders.tsx](../components/dashboard/division-orders.tsx). The page loads with no panel
   or sheet open, on any screen.

## When this applies

Every page and popup under [components/dashboard/](../components/dashboard/). The phone boards are
the "m" boards (50b-m, 57m, 58m, 59m and so on), named in the comments beside each form. The
landing pages under `components/landing/` follow their own boards and are out of scope.

## Why it is not obvious

- A centred dialog or a 440px side panel on a phone covers the page with a box that does not fit.
  The boards ask for a sheet or a full page instead.
- A second component per screen size drifts: one form gets a fix the other misses. Keeping both
  forms in one component, switched by breakpoint classes, keeps one source for the content and the
  actions.
- Tables with many columns do not fit a phone. Cards carry the same row data in a column.

## Known inconsistencies (not the pattern)

- **Two breakpoints for tables.** Positions switches at `lg`; Members and Orders switch at `md`.
- **Two ways to build the phone full page.** `SidePanel` carries its own back arrow; the
  application panel uses `PhoneTopBar` from the shell.
- **"Panels closed" is a board rule, not code.** The main board for a page shows every panel
  closed. The code mirrors it by starting panel state empty; nothing checks it.
