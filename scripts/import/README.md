# Team data import

Loads the real team into a database that has the schema but no people (issue #677). It reads the
roster workbook, the old Supabase CSV exports and the old photos. It reports every conflict. It
inserts members, their roles by academic year, alumni, advisors, open positions, FAQs, orders and
member and advisor photos. It never updates or deletes a row, and it never creates a department or
division.

Running it on a real database (preview or production) is an owner step. The tests run it only on
the fake files in `fixtures/files/`, an in-memory database and a fake photo store.

## Usage

```sh
pnpm db:import <source-dir> [--mode dry-run|import] [--year YYYY-YYYY] [--report <file>] [--database-url <url>] [--blob-token <token>]
```

- `<source-dir>`: the directory with the roster workbook (one `.xlsx`), the CSV exports and,
  if there are photos, a `photos/` folder.
- `--mode dry-run` (the default): prints the report. It writes nothing and uploads nothing. With a
  database it reads the units, the projects, the rows already there and the seat holders from it.
  Without one it checks the files only.
- `--mode import`: reads, plans and writes in one transaction. A failure writes nothing.
- `--year 2026-2027`: the current academic year's sheet. By default it is the newest `YYYY-YYYY`
  sheet. Newer sheets are skipped.
- `--report <file>`: also writes the report to this file.
- `--database-url <url>`, or `IMPORT_DATABASE_URL` set for this one command: the database to read
  or write. An import needs one. The tool loads no `.env` file and never reads `DATABASE_URL`.
- `--blob-token <token>`, or `IMPORT_BLOB_TOKEN` set for this one command: the read-write token
  of the public Vercel Blob store, the store the site's photos are served from. An import uploads
  photos only with it. Without it, an import uploads no photo, reports the photos as skipped and
  imports everything else. The tool never reads `BLOB_READ_WRITE_TOKEN`.

The report prints counts and places only: per table the rows to insert (or inserted), already
present and refused; the number of alumni, of people in more than one year sheet, of unclear
quitters and of distinct unresolved unit names; the photo counts; then each conflict with its file,
sheet, row and field. It prints no name, email, phone, ID or photo file name. A photo is named by
its row: its place in the sorted file list of `photos/`.

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

From `photos/` (it may be missing): JPEG files named `<id>-<surname>.jpeg` or `<surname>.jpeg`.
The id is a row's `id` in `people_rows.csv` or `advisors_rows.csv`.

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
- **Titles** (`titles.ts`): a title cell is split on " - " into seats, and each seat gives its
  own role. The title table gives each seat's `type`, `full_access` and unit. A seat may end in
  parenthesized notes: "(acting)" marks an acting holder, any other note names a project. Neither
  changes the seat, and both stay in the stored title. A seat with a seat word that no rule reads
  ("Vice Team Leader") is refused, not guessed.
- **Units** (`units.ts`): a subteam or division cell is split on " - ", ",", ";" and line breaks.
  Each value resolves by name, else by the code in its parentheses ("Propulsion (PRO)"), against
  the existing `departments` and `divisions`. "N/A" is no unit. An "ADVISOR" or "SENIOR ADVISOR"
  marker, with or without a project in parentheses, makes the row's plain member seat an `advisor`
  role. A project's name (any version of a `projects` row on the database) is not a unit: the
  schema has no project on `roles`, so it is set aside. A cell that names only a project gives no
  unit, and a seat that needs one is refused and reported. Every value that resolves to nothing is
  reported, and the report counts the distinct names.
- **Dates**: current-year roles are active. Earlier years' roles run `YYYY-10-01` to
  `(YYYY+1)-09-30`.
- **Seats**: a second active holder of the team leader seat, a department head seat or a
  full-access seat this year is refused and reported. Rows already in the database count.
- **Alumni**: anyone not on the current sheet. They get `team_from` / `team_to`, one `team_leaves`
  row and ended roles only. They get no active role and no access.
- **Quitters**: a quitter also on the current sheet imports as active and is reported. A quitter
  on no year sheet is reported and not imported.
- **Imported Alumni entries** (migration 0021): a person whose name matches one is reported. No
  role is inserted for a year that entry lists. The entry is left as it is.
- **Photos** (`photos.ts`): a file matches on its id first, exactly. The surname in its name is
  only a cross-check, never a match by itself. An id found with another surname is held. A file
  with no id, or an id on no row, is not imported. An id a person and an advisor share is settled
  by the surname; if neither or both match, the file is not imported. A member's photo is cut to
  the centred square, at most 800 px, as a JPEG at quality 0.9, as the dashboard's crop dialog
  does. It must pass `checkMemberPhoto`. It is stored at `photos/<memberId>-<uuid>.jpg` and its URL
  goes into the new `members.picture`. An advisor's photo passes `checkPhotoUpload` and is stored
  as a Team page upload; its URL goes into the new advisor version's `photo`. Photos are linked
  only to members and advisors the same run inserts. A file uploaded by a run that then fails stays
  in the store unlinked.
- **Present rows**: a person whose email an account already holds, a role with the same member,
  unit, title and dates, an advisor or FAQ with the same name or question, a position with the same
  title and division, an order with the same requester, name and time. A second run inserts
  nothing and uploads nothing.

## Fixtures

`fixtures/make-fixtures.ts` writes `fixtures/files/`. Every name in them is invented, every email
is on `example.com`, and the photos are tiny generated JPEGs. `import.test.ts` runs the tool over
them.
