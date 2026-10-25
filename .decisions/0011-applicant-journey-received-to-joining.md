---
id: 0011
title: "An application goes Received, In review, Interview, Decision, and Accept never makes the person a member until Confirm join after the signed NDA"
status: amended-in-part by [0014](0014-several-divisions-one-nda.md)
date: 2026-10-10
tags: [recruitment, applications, dashboard]
---

# 0011 — An application goes Received, In review, Interview, Decision, and Accept never makes the person a member until Confirm join after the signed NDA

**What this decides:** An application moves through four steps: Received, In review, Interview, Decision. Accepting someone does not put them on the team. The team leader emails them the NDA, and only after the signed NDA is back does a lead or the recruitment manager confirm that they join. A person is in one division only. A withdrawn application disappears for the lead at once, and its files are deleted 30 days later.

## Context

Decided 2026-10-10 by the project owner. Approval: https://github.com/PoliTo-Rocket-Team/website-v2/issues/181#issuecomment-6095711336. The rule texts are in the original report of issue #181. The applicant's side was built in issue #169 and the lead's side in issue #171.

Who may take each step, and what each viewer sees, is in the dashboard rules doc, [docs/dashboard-rules.md](../docs/dashboard-rules.md) (issue #180), and is not copied here. The site never sends the emails named below; the person acting sends them ([0008](./0008-google-only-sign-in-no-email.md)).

## Decision

**An application goes Received, In review, Interview, Decision; Accept is not join, and only Confirm join after the signed NDA makes the person a member.**

1. **Received.** The application is sent.
2. **In review.** It moves here on its own the first time the lead opens it.
3. **Interview.** The lead offers time slots and emails the applicant; the applicant picks one.
4. **Decision.** The lead accepts or rejects.
5. **Accept is not join.**
   - The team leader emails the accepted person the NDA.
   - The applicant sees only: "The team will contact you about joining. Watch your inbox."
   - The lead or the recruitment manager confirms join once the signed NDA is back. Only that makes the person a member.
6. **Accept does not touch the person's other applications.**
7. **One person, one division.** Superseded by [0014](./0014-several-divisions-one-nda.md): a person may hold several divisions at once. 0014 also amends rule 5 for someone already on the team, who joins a new division with no NDA wait; rule 5 still holds for everyone else.
8. **Withdraw.** When the applicant withdraws, the lead stops seeing the application at once. Its files are deleted 30 days later.

**Binding constraints.**
- Never make a person a member on Accept; only Confirm join does that.
- Never change a person's other applications when one is accepted.
- Never show the applicant more than the one joining sentence above between Accept and joining.

## Consequences

- The NDA step stays with people, by email, outside the site.
- The lead's list stays clean of withdrawn applications.

## Gaps

- The application flow lets Accept run from In review, skipping the interview: #198.
- On real data, My applications shows a member's accepted application as joined before Confirm join: #187.

Followed today: a daily scheduled job deletes the files of applications withdrawn 30 or more days ago (rule 8, #178): the rule is in [lib/dashboard/withdrawn-files.ts](../lib/dashboard/withdrawn-files.ts), the database and file-store side in [lib/dashboard/database-withdrawn-files.ts](../lib/dashboard/database-withdrawn-files.ts), and [app/api/cron/delete-withdrawn-files/route.ts](../app/api/cron/delete-withdrawn-files/route.ts) runs it; the stages and legal moves are in [lib/dashboard/application-flow.ts](../lib/dashboard/application-flow.ts) (first open moves New to In review; Confirm join needs the NDA); the joining sentence is `NEXT_STEPS_TEXT` in [lib/dashboard/my-applications.ts](../lib/dashboard/my-applications.ts); lead reads filter out withdrawn applications in [lib/dashboard/database-recruitment.ts](../lib/dashboard/database-recruitment.ts).

## Amendment, 2026-10-25

Who the recruitment manager of rule 5 is. Owner decision, 2026-10-22, on issue #194 (https://github.com/PoliTo-Rocket-Team/website-v2/issues/194#issuecomment-6341780484): the recruitment manager is the lead of the Logistics division, in the Operations department. Owner decision, 2026-10-25, on the same issue (https://github.com/PoliTo-Rocket-Team/website-v2/issues/194#issuecomment-6396490285): they see every division's applications and have full recruitment rights on all of them, team-wide, so they may make every move a lead may make on an application in any division, the NDA tick and Confirm join included. While the Logistics division is closed, nobody is the recruitment manager. The rule is `managesRecruitment` in [lib/dashboard/application-documents.ts](../lib/dashboard/application-documents.ts), which finds the division through `recruitmentManagerDivision` in [lib/dashboard/notices.ts](../lib/dashboard/notices.ts); every move on an application asks it through `mayChangePositionIn` in [lib/dashboard/position-access.ts](../lib/dashboard/position-access.ts). The Gap line for #194 is removed. The rest of this record is unchanged.

## Amendment, 2026-10-25: one application status list

Owner decisions of 2026-10-25 on epic #588 and the owner's rulings on its grilling session #745. They replace the four steps of rules 1 to 4, rule 2 and rule 6; the lines above stay as written. Rules 5 and 8 still hold, and rule 7 stays superseded by [0014](./0014-several-divisions-one-nda.md).

1. **One status list.** Every application has one status from one list. There are no separate stages and statuses ([Owner decision](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399491157), which replaces point 1 of the [earlier decision that day](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399407814)). The ten built-in statuses, in order:
   1. New
   2. Interview (booked or being arranged)
   3. Accepted · email to be sent
   4. Accepted · email sent (the NDA email went out)
   5. NDA received
   6. Joined (Confirm join)
   7. Rejected · email to be sent
   8. Rejected · email sent
   9. Accepted for another position
   10. Withdrawn (the applicant backed out)

   The team's older words map onto this list: "Not selected" is Rejected, "TbA" is New, and "Resigned" is Withdrawn.
2. **Added statuses.** Approvers can add their own statuses. Each added status sits under one built-in status, its parent, chosen when it is created (for example "Second interview" under Interview). It behaves like its parent: the applicant sees the parent's public step, and the parent's action buttons apply. Built-in statuses can be renamed and recoloured but never deleted. An added status can be deleted only while no application uses it ([Owner decision](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399501184)).
3. **No In review (replaces rule 2).** "In review" is dropped. Opening an application no longer changes its status, and existing In review applications read as New ([ruling R1.2](https://github.com/PoliTo-Rocket-Team/website-v2/issues/745#issuecomment-6399753082)).
4. **Action buttons.** The drawer's bottom bar shows only the buttons for the current status. Each asks for a confirm and sets the next built-in status ([Owner decision](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399628523)):

   | Status | Buttons |
   |---|---|
   | New | Move to interview → Interview; Reject → Rejected · email to be sent |
   | Interview | Change times; Accept → Accepted · email to be sent; Reject → Rejected · email to be sent |
   | Accepted · email to be sent | Mark email sent (team leader only) → Accepted · email sent; Withdraw acceptance → New |
   | Accepted · email sent | NDA received → NDA received |
   | NDA received | Confirm join → Joined, and the person's other open applications → Accepted for another position |
   | Rejected · email to be sent | Mark email sent → Rejected · email sent |
   | Joined, Withdrawn, Rejected · email sent, Accepted for another position | No buttons |

   An added status uses its parent's buttons. The buttons only ever set built-in statuses.
5. **Hand pick.** Every status, built-in or added, can also be picked by hand in the Status picker. The buttons are shortcuts for the next step. A hand pick of a built-in status has exactly the same effect as the button that sets it, with the same confirm: picking Joined runs Confirm join, and picking Interview starts the interview step. Both paths go through one server move ([ruling R1.1](https://github.com/PoliTo-Rocket-Team/website-v2/issues/745#issuecomment-6399752172)). A hand pick is a draft until it is saved: the picker has Save and Cancel, and the action buttons are locked while the change is unsaved, so a hand pick and a button move never apply together (points 2 and 3 of the [earlier decision](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399407814), kept by the [one-list decision](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399491157)).
6. **Who sets what.** Anyone who can move an application can set its status and can manage the status list: add, rename, recolour, and delete unused added statuses. Only the team leader sets "Accepted · email sent", because the team leader sends the acceptance email with the NDA. Anyone who can move the application sets "Rejected · email sent". Everyone else sees a note on an accepted application not to email the applicant, and "Accepted · email sent" shows as team leader only in their picker ([Owner decision](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399538440); boards 97 to 97e, [approved](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399568953)).
7. **Confirm join and other applications (replaces rule 6).** Accept still does not touch the person's other applications. Confirm join sets the person's other open applications to "Accepted for another position" ([Owner decision](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399628523)). The binding constraint "Never change a person's other applications when one is accepted" is replaced by: never change a person's other applications on Accept; only Confirm join changes them, and only to "Accepted for another position".
8. **Public steps.** The applicant never sees the team's statuses, only these public steps ([Owner decision](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399713897)):
   1. Received: just applied.
   2. In review: every internal status in between.
   3. Interview: only while they need to pick or see an interview time.
   4. Outcome: Accepted (then the NDA step), shown only from "Accepted · email sent"; Not selected, shown only from "Rejected · email sent", and for "Accepted for another position". Until the email status is "sent", the applicant still sees In review.
   5. Withdrawn: the applicant backed out.

   The joining sentence of rule 5 is what the Accepted outcome shows, so the binding constraint on it still holds.
9. **A person already on the team** follows the same statuses as any applicant ([ruling R1.3](https://github.com/PoliTo-Rocket-Team/website-v2/issues/745#issuecomment-6399754015)); see the 2026-10-25 amendment of [0014](./0014-several-divisions-one-nda.md).

Existing applications are test data, so no stored row is mapped to the new list; the seed uses it, and schema changes stay additive ([ruling R1.4](https://github.com/PoliTo-Rocket-Team/website-v2/issues/745#issuecomment-6399754905)). The children of epic #588 built the code that follows these rules, in `lib/dashboard/application-flow.ts`. The rest of this record is unchanged.

## Records

Terms: joining, confirm join. Rows in [.glossary/TERMS.md](../.glossary/TERMS.md). The 2026-10-25 status-list amendment adds application status (redefined), built-in status, added status and public step, and retires "stage" and "In review" as approver-facing words for applications.
