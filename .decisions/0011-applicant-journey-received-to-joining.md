---
id: 0011
title: "An application goes Received, In review, Interview, Decision, and Accept never makes the person a member until Confirm join after the signed NDA"
status: accepted
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
7. **One person, one division.**
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
- The dashboard has no recruitment manager, so only leads can confirm join: #194.

Followed today: a daily scheduled job deletes the files of applications withdrawn 30 or more days ago (rule 8, #178): the rule is in [lib/dashboard/withdrawn-files.ts](../lib/dashboard/withdrawn-files.ts), the database and file-store side in [lib/dashboard/database-withdrawn-files.ts](../lib/dashboard/database-withdrawn-files.ts), and [app/api/cron/delete-withdrawn-files/route.ts](../app/api/cron/delete-withdrawn-files/route.ts) runs it; the stages and legal moves are in [lib/dashboard/application-flow.ts](../lib/dashboard/application-flow.ts) (first open moves New to In review; Confirm join needs the NDA); the joining sentence is `NEXT_STEPS_TEXT` in [lib/dashboard/my-applications.ts](../lib/dashboard/my-applications.ts); lead reads filter out withdrawn applications in [lib/dashboard/database-recruitment.ts](../lib/dashboard/database-recruitment.ts).

## Records

Terms: joining, confirm join. Rows in [.glossary/TERMS.md](../.glossary/TERMS.md).
