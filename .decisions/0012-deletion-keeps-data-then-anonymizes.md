---
id: 0012
title: "Account deletion keeps the person's data at least one year, then anonymizes it for statistics"
status: accepted
date: 2026-10-10
tags: [accounts, privacy, data-retention]
---

# 0012 — Account deletion keeps the person's data at least one year, then anonymizes it for statistics

**What this decides:** When someone deletes their account, the site keeps their data for at least one year, then anonymizes it and keeps it only for statistics. The delete dialog says this in those words and no others. The Privacy Policy must state how long data is kept and on what basis.

## Context

Decided 2026-10-10 by the project owner. Approval: https://github.com/PoliTo-Rocket-Team/website-v2/issues/181#issuecomment-6095711336. The rule texts are in the original report of issue #181. The Privacy Policy is issue #122.

## Decision

**Account deletion keeps the person's data at least one year, then anonymizes it for statistics.**

1. **Keep at least one year.** After an account is deleted, its data is kept for at least one year.
2. **Then anonymize.** After that, the data is anonymized and kept only for statistics.
3. **The delete dialog says so only in those words:** the data is kept at least one year, then anonymized for statistics. It adds no other promise about the data.
4. **The Privacy Policy (#122) must state** the retention period and its basis.

**Binding constraints.**
- Never promise in the dialog more, or less, than rule 3.
- Never anonymize before one year has passed.

## Consequences

- Statistics on applicants and members survive account deletion.
- The site needs a job that anonymizes data once the year has passed.

## Gaps

- There is no Privacy Policy page yet: #122.

Followed today: `deleteAccount` in [lib/dashboard/database-self.ts](../lib/dashboard/database-self.ts) closes the sign-in, keeps the `users` row and records `deleted_at`; a daily job ([lib/dashboard/anonymize.ts](../lib/dashboard/anonymize.ts)) anonymizes the account once a year has passed; the dialog asks the person to type DELETE ([.patterns/confirm-decisive-actions.md](../.patterns/confirm-decisive-actions.md)).

## Amendment, 2026-10-25

Owner decision, 2026-10-25, on issue #729 (https://github.com/PoliTo-Rocket-Team/website-v2/issues/729#issuecomment-6400948160): the free-text answers to a position's questions are not statistics data. Rule 2 is narrowed: the yearly anonymization of a deleted account also clears the person's free-text application answers (`applications.custom_answers`) and their copies in the audit log. The role, dates and outcome of each application stay for statistics. The Privacy Policy wording that anonymized data no longer identifies the person stays as it is. The rest of this record is unchanged.

## Records

no vocabulary impact
