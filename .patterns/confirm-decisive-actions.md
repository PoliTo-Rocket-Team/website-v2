# Confirm before decisive actions

How the dashboard asks "are you sure" before an action that is hard to undo: accept, reject,
withdraw, delete, move to alumni, promote and leave. Each opens a confirm dialog first, and the
action runs only from that dialog's confirm button. Account deletion also asks the person to type
DELETE.

## The shape

1. **One dialog component for most actions.** `ConfirmDialog` in
   [components/dashboard/confirm-dialog.tsx](../components/dashboard/confirm-dialog.tsx) takes an
   icon, a `title` phrased as the question, a `description` saying what happens, optional
   `children` for anything the action needs (a reason, a checkbox, a typed word), a `cancelLabel`
   (the way out, named for what it keeps, for example "Keep account") and a `confirmLabel` (the
   action). `danger` paints the action red; `tone` sets the ring, green for Confirm join.
   `pending` and `confirmDisabled` keep the button off while the write runs or until the input is
   valid. The button calls `onConfirm`; the trigger on the page only opens the dialog.

2. **Applications use a sibling with the same frame.** `DecisionDialog` in
   [components/dashboard/decision-dialog.tsx](../components/dashboard/decision-dialog.tsx) is the
   step before Accept, Reject and Confirm join on the lead's Applications page. It reuses the popup
   frame (`SHEET_CONTENT`, `SHEET_CANCEL`) from `confirm-dialog.tsx`.

3. **Typing DELETE.** Delete account passes `confirmDisabled={!deleteConfirmed(typed)}`. The word
   and the check are domain code, not component code:

   ```ts
   export const DELETE_WORD = "DELETE";
   export function deleteConfirmed(typed: string): boolean {
     return typed.trim() === DELETE_WORD;
   }
   ```
   ([lib/dashboard/self.ts](../lib/dashboard/self.ts); used in
   [components/dashboard/account-parts.tsx](../components/dashboard/account-parts.tsx))

Call sites, by action:

| Action | Where |
|---|---|
| Accept, Reject, Confirm join (lead) | `DecisionDialog` in [applications.tsx](../components/dashboard/applications.tsx) |
| Confirm join (Members banner) | `ConfirmDialog` in [members.tsx](../components/dashboard/members.tsx) |
| Withdraw application, confirm interview time (applicant) | `ConfirmDialog` in [my-applications.tsx](../components/dashboard/my-applications.tsx) |
| Promote, Move to alumni | `ConfirmDialog` in [member-drawer.tsx](../components/dashboard/member-drawer.tsx) |
| Leave the team | `ConfirmDialog` in [my-profile.tsx](../components/dashboard/my-profile.tsx) |
| Delete account (type DELETE) | `ConfirmDialog` in [account-parts.tsx](../components/dashboard/account-parts.tsx) |
| Cancel order request | `ConfirmDialog` in [division-orders.tsx](../components/dashboard/division-orders.tsx) |
| Remove access | `ConfirmDialog` in [division-access.tsx](../components/dashboard/division-access.tsx) |

## When this applies

Any dashboard action that ends, removes or decides something for a person: the ones in the table,
and any new one of the same kind. It does not apply to settings that flip back with one more click,
such as opening or closing a position.

## Why it is not obvious

- A button that runs the write at once is the shorter build, and one slip then rejects an applicant
  or removes a member.
- A second hand-made popup drifts from the frame: it misses the phone bottom sheet
  ([phone-layouts.md](./phone-layouts.md)) or the disabled state while the write runs.
- The confirm word belongs in domain code, so the label the page shows and the check it runs read
  one constant.

## Known inconsistencies (not the pattern)

- **Two dialog components.** `DecisionDialog` repeats most of `ConfirmDialog` with its own ring
  and button colours, instead of passing `tone`.
- **Some writes run with no confirm.** The site-wide recruitment switch and the position open/close
  toggle ([positions.tsx](../components/dashboard/positions.tsx)), the "signed NDA arrived" tick
  ([applications.tsx](../components/dashboard/applications.tsx)), Give access, the Alumni "shown on
  site" toggle ([alumni.tsx](../components/dashboard/alumni.tsx)), and the member panel's Save,
  which can change a lead's role ([member-drawer.tsx](../components/dashboard/member-drawer.tsx)).
  None of them is in the list at the top of this doc.
- **The DELETE check has no test.** `deleteConfirmed` is not exercised in
  [lib/dashboard/self.test.ts](../lib/dashboard/self.test.ts).
