# Team join date backfill (one-time)

A one-time data fill after the team import (issue #948). The owner runs it against production: a
dry run first, then the real run. After the real run, a follow-up PR removes this directory, as was
done with the import tool (`scripts/import`, removed by PR #847).

The Overview's "In the team since" line shows the day a member joined the team, stored in
`members.joined_team_on` (migration `0086_members_joined_team_on`). It never shows a role's start:
the roster's role starts are academic-year placeholders (owner decision, 2026-11-01). The Members
page's "joined" year reads the same stored day. The import read the roster's "Joined the Team on"
and "Date of joining" columns only to date roles and stored them nowhere, so this fills the new
column from those columns. A member with no stored day shows no line.

## How to run it

Agents never run it against a real database (production or preview). The owner runs it.

```sh
# 1. Dry run: prints the plan, writes nothing.
BACKFILL_DATABASE_URL='<production database url>' pnpm db:team-join-date <source-dir> --report <outside-the-repo>/team-join-date-dry-run.txt

# 2. Real run: the same plan, written in one transaction.
BACKFILL_DATABASE_URL='<production database url>' pnpm db:team-join-date <source-dir> --mode backfill --report <outside-the-repo>/team-join-date-run.txt
```

- `<source-dir>`: the directory with the roster workbook, outside the repo. It must hold exactly
  one `.xlsx` file. Nothing else in it is read.
- `--mode dry-run` (the default) reads the workbook and the database and prints the report. It
  writes nothing. `--mode backfill` reads, plans and writes in one transaction. A failure before
  the transaction commits writes nothing and prints "Team join date backfill failed; nothing was
  written." A failure after the commit (rendering or printing the report, writing the `--report`
  file, closing the connection) prints "Team join date backfill was written: its transaction
  committed. Then <step> failed." Do not run it again to recover the report: a second run plans
  nothing. Both print the error's cause chain (never a query's values).
- `--database-url <url>`, or `BACKFILL_DATABASE_URL` set for this one command: both modes need it.
  The tool loads no `.env` file and never reads `DATABASE_URL`.
- `--report <file>`: also writes the report to this file. Keep it outside the repo.

The migration must have run on the database first (every production build runs it). Check the dry
run's lists before the real run. Then post the counts from both runs (no names) as a comment on
issue #948. A second real run changes nothing.

## What the report prints

Sheet names, row numbers, and the month and year of each join day. Never a name, email, phone or
ID, and no database id.

- The sheets read and the sheets left out.
- Every member to date, by the rows that gave the day.
- Every row skipped, by row, with why.
- The join days read with day and month swapped.

## Rules

- Every sheet whose header names "Joined the Team on" or "Date of joining" is read (the `Quitters`
  sheet, the `2022-2023` sheet, and any other sheet that has one of them). A row with both reads
  "Joined the Team on". Columns are found by header text; case, spacing and a trailing colon do not
  count.
- A date reads day first: an Excel date cell, `dd/mm/yyyy`, `d/m/yyyy`, `dd.mm.yyyy` or
  `yyyy-mm-dd`. When the row also has a "Left the Team on" day and the join day falls after it,
  one date cell (never typed text) whose day is 12 or less is read with day and month swapped, as
  the import did (issue #818): the leave day first, then the join day. A row whose dates no swap
  puts in order is skipped.
- A row's member is found by its emails (lower case): an account's email, or a member's PRT
  address. No member, or two, skips the row. A row with no email is skipped.
- A member several rows find (someone who left and came back, or who is on the `2022-2023` sheet
  and on `Quitters`) gets the earliest join day that reads. A row whose day does not read is
  skipped and reported; the member's other rows still count.
- A member who already has a join day keeps it. The same day counts as done; a different one is
  reported and left as it is.
- The write sets `members.joined_team_on` only, and only while it is still empty.

**Never.** No row is inserted or deleted, and no other column changes.

## Tests

`backfill.test.ts` runs the backfill on a fake roster built in memory (every name invented, every
email on `example.com`) and the in-memory Postgres the other tests use. It covers which sheets are
read (the 2022-2023 sheet's "Date of joining" included), a member found by account email or PRT
address, a member who left and came back, a member on the 2022-2023 sheet and on `Quitters`, a stored day
kept (the same and a different one), no member, two members, an unreadable date, dates out of
order, a swapped date cell, a row with no email, idempotency, and what a failed run prints before
and after its commit.
