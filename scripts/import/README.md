# Team data import

Loads the real team into a database that has the schema but no people (issue #677). It reads the
roster workbook and the old Supabase CSV exports. It reports every conflict. It inserts members,
their roles by academic year, alumni, advisors, open positions, FAQs and orders. It never updates or
deletes a row, and it never creates a department or division.

Running it on a real database (preview or production) is an owner step. The tests run it only on
the fake files in `fixtures/files/` and an in-memory database.

## Usage

```sh
pnpm db:import <source-dir> [--mode dry-run|import] [--year YYYY-YYYY] [--report <file>] [--database-url <url>]
```

- `<source-dir>`: the directory with the roster workbook (one `.xlsx`) and the CSV exports.
- `--mode dry-run` (the default): prints the report and writes nothing. With a database it reads
  the units, the rows already there and the seat holders from it. Without one it checks the files
  only.
- `--mode import`: reads, plans and writes in one transaction. A failure writes nothing.
- `--year 2026-2027`: the current academic year's sheet. By default it is the newest `YYYY-YYYY`
  sheet. Newer sheets are skipped.
- `--report <file>`: also writes the report to this file.
- `--database-url <url>`, or `IMPORT_DATABASE_URL` set for this one command: the database to read
  or write. An import needs one. The tool loads no `.env` file and never reads `DATABASE_URL`.

The report prints counts and places only: per table the rows to insert (or inserted), already
present and refused; the number of alumni, of people in more than one year sheet and of unclear
quitters; then each conflict with its file, sheet, row and field. It prints no name, email, phone
or ID.

## What it reads

From the workbook:

- every `YYYY-YYYY` sheet up to the current year. The current one gives active members and active
  roles. Each earlier one gives ended roles for that academic year.
- `Quitters`: who left, and the day they left (`Left the Team on:`).
- `Roles YY-YY` (for example `Roles 22-23`): that year's seats with the division the year's own
  sheet lacks. A row joins that year's sheet by the person-match rule below. Its subteam, division
  and title fill only the cells the year sheet left empty.
- `Stats` and any other sheet are not read.

Columns are found by header text through the alias table in `columns.ts`, never by position. The
header row is the first of the top 15 rows that holds the required fields.

From the CSVs (any may be missing): `people_rows.csv`, `team_members_rows.csv`,
`subteams_rows.csv`, `divisions_rows.csv`, `advisors_rows.csv`, `positions_rows.csv`,
`orders_rows.csv`, `faqs_rows.csv`. The workbook wins on any field both carry. A CSV fills only a
field the workbook left empty, and reports a field where it disagrees.

## Rules

- **Person match** (`people.ts`): a row is the person who already has one of its emails (every
  email column, compared in lower case). Failing that, it is the person with the same full name,
  where accents, case, punctuation and spacing do not count. Year sheets are read newest first, so
  the newest sheet wins a personal field. Only a year sheet starts a new person.
- **Sign-in**: each new person is one `members` row and one `users` row with id
  `imported:<uuid>` and their sign-in email: the personal mail, else the first other email the
  workbook gives. On the first Google sign-in, the `sync_auth_users` trigger (`drizzle/0001`) finds
  the users row by that email. It gives the row the account's id, so the person lands on their
  imported row and member, and an alumnus opens My alumni. If they sign in with another address,
  full access can correct the sign-in email first (Edit details, issue #741).
- **Roles** (`titles.ts`, `units.ts`): the title table gives `type` and `full_access`. A title with
  a seat word that no rule reads ("Vice Team Leader") is refused, not guessed. Units resolve by
  name or code against the existing `departments` and `divisions`. Current-year roles are active.
  Earlier years' roles run `YYYY-10-01` to `(YYYY+1)-09-30`.
- **Seats**: a second active holder of the team leader seat, a department head seat or a
  full-access seat this year is refused and reported. Rows already in the database count.
- **Alumni**: anyone not on the current sheet. They get `team_from` / `team_to`, one `team_leaves`
  row and ended roles only. They get no active role and no access.
- **Quitters**: a quitter also on the current sheet imports as active and is reported. A quitter
  on no year sheet is reported and not imported.
- **Imported Alumni entries** (migration 0021): a person whose name matches one is reported. No
  role is inserted for a year that entry lists. The entry is left as it is.
- **Present rows**: a person whose email an account already holds, a role with the same member,
  unit, title and dates, an advisor or FAQ with the same name or question, a position with the same
  title and division, an order with the same requester, name and time. A second run inserts
  nothing.

## Fixtures

`fixtures/make-fixtures.ts` writes `fixtures/files/`. Every name in them is invented and every
email is on `example.com`. `import.test.ts` runs the tool over them.
