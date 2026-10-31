# Alumni repair (one-time)

A one-time data repair after the team import (issue #913). The owner runs it against production:
a dry run first, then the real run. After the real run, a follow-up PR removes this directory,
as was done with the import tool (`scripts/import`, removed by PR #847).

It fixes two things the public Alumni page shows:

1. **The missing last-year role.** The import gave a role only to quitters on no year sheet. A
   person on an earlier year sheet who left in a year no year sheet lists them in got a leave
   record but no role for that year. The repair adds that role.
2. **The propulsion lineage** (owner decision, 2026-10-31). "Liquid Propulsion", "Efesto" and
   "Propulsion" are one team. Its roles up to and including 2023-2024 go under "Efesto"; its
   roles from 2024-2025 on go under "Propulsion".

## How to run it

Agents never run it against a real database (production or preview). The owner runs it.

```sh
# 1. Dry run: prints the plan, writes nothing.
REPAIR_DATABASE_URL='<production database url>' pnpm db:alumni-repair <source-dir> --report <outside-the-repo>/alumni-repair-dry-run.txt

# 2. Real run: the same plan, written in one transaction.
REPAIR_DATABASE_URL='<production database url>' pnpm db:alumni-repair <source-dir> --mode repair --report <outside-the-repo>/alumni-repair-run.txt
```

- `<source-dir>`: the directory with the roster workbook, outside the repo. It must hold exactly
  one `.xlsx` file. Nothing else in it is read.
- `--mode dry-run` (the default) reads the workbook and the database and prints the report. It
  writes nothing. `--mode repair` reads, plans and writes in one transaction. A failure before the
  transaction commits writes nothing and prints "Alumni repair failed; nothing was written." A
  failure after the commit (printing the report, writing the `--report` file, closing the
  connection) prints "Alumni repair was written: its transaction committed. Then <step> failed."
  The repair is then in the database: do not run it again to recover the report, since a second
  run plans nothing. Both print the error's cause chain (never a query's values).
- `--database-url <url>`, or `REPAIR_DATABASE_URL` set for this one command: both modes need it.
  The tool loads no `.env` file and never reads `DATABASE_URL`.
- `--report <file>`: also writes the report to this file. Keep it outside the repo.

Check the dry run's lists before the real run. Then post the counts from both runs (no names) as a
comment on issue #913. A second real run changes nothing.

## What the report prints

Sheet names, row numbers, academic years, unit names and counts. Never a name, email, phone or
ID, and no database id.

- **Part 1**: every role to add, by Quitters row, with its academic year and its department and
  division; every Quitters row skipped, by row, with why; the dates read with day and month
  swapped.
- **Part 2**: every role to move, grouped by academic year, from-unit and to-unit, with a count;
  every closed division to create; the lineage roles left where they are, by reason and year.

## Rules

**Part 1, the missing last-year role.**

- A Quitters row is matched to a person on the year sheets by the import's rule: one of its emails
  (lower case), else its full name (accents, case, punctuation and spacing do not count).
- The row's academic year is the one its "Left the Team on" day falls in. Dates read day first;
  a date cell stored month/day is read swapped when the join day would otherwise fall after the
  leave day (issue #818).
- A row gets a role only when its person is on a year sheet before that year and on no year sheet
  of that year. A row on no year sheet was placed by the import. A row whose leave day is after
  the current year (the newest year sheet) is skipped.
- The member is found in the database by the person's emails: an account's email, or a member's
  PRT address. No member, or two, skips the row.
- A member who already has a role in that year is skipped. So a second run adds nothing.
- The role: the Quitters row's title as the workbook writes it, from the start of that year (or
  the row's "Joined the Team on" day, when later) to the leave day. Its type comes from the
  import's title table (the title's highest seat); no added role holds full access. It sits in
  each division the row names, and in each department no division of the row covers. A title of
  a board seat with no unit sits in no unit.
- The units are looked up in the database by name or code, as the import did. A unit cell that
  finds no unit, or two, skips the row. Part 1 creates no unit.
- A role of the lineage is placed by Part 2's rule directly.

**Part 2, the propulsion lineage.**

- A role is of the lineage when its department is "Liquid Propulsion", "Efesto" or "Propulsion"
  (by name), or it has no department and its division sits under one.
- A role's year is the academic year its start day falls in. Up to 2023-2024 its department is
  "Efesto"; from 2024-2025 on it is "Propulsion". The run stops, writing nothing, when the
  database does not hold exactly one "Efesto" and one "Propulsion".
- Its division moves to the division of the target department with the same name or code. When
  the target has none, one closed division is created there with the source division's name and
  code. Source divisions that share a name or a code share that one created division, even when
  they sit under different lineage departments. It starts on the first day of the first academic
  year it takes a role in, and closes on the last day of the last one. When the target has, or
  would get, two divisions that match, or the role's division sits under a department outside
  the lineage, the role stays where it is and the report counts it.
- A move updates `dept_id` and `division_id` only, and only while the role still sits where the
  plan read it.

**Never.** No role, department or division is deleted. No migration: this is data only.

## Tests

`repair.test.ts` runs the repair on a fake roster built in memory (every name invented, every
email on `example.com`) and the in-memory Postgres the other tests use. It covers the missing-year
role, the skip when a role exists, the later join day, a person on the sheet of their leave year,
a person with no member, idempotency (a second real run changes nothing), the lineage moves (to
an existing division by name, to a created closed division, and two source divisions with one
code sharing one created division), the date reading, and what a failed run prints before and
after its commit.
