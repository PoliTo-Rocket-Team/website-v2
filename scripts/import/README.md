# Team data import

Loads the real team into a database that has the schema but no people (issue #677). It reads the
roster workbook, the old Supabase CSV exports and the old photos. It reports every conflict. It
inserts members, their roles by academic year, alumni, advisors, open positions, FAQs, orders and
member and advisor photos. The only departments and divisions it creates are past ones the database
lacks, created closed (issue #816). It never updates or deletes a row.

Running it on a real database (preview or production) is an owner step. The tests run it only on
the fake files in `fixtures/files/`, an in-memory database and a fake photo store.

## Usage

```sh
pnpm db:import <source-dir> [--mode dry-run|import] [--year YYYY-YYYY] [--report <file>] [--database-url <url>] [--blob-token <token>]
```

- `<source-dir>`: the directory with the roster workbook (one `.xlsx`), the CSV exports, a
  `photos/` folder if there are photos, and a `handovers.csv` if a seat changed holder this year.
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
present and refused, with the `departments` and `divisions` rows counting the closed past units to
create; the number of alumni, of people in more than one year sheet, of unclear quitters, of seat
handovers applied and of distinct unresolved unit names; the photo counts; then each conflict with
its file, sheet, row and field. It prints no name, email, phone, ID or photo file name. A photo is named by
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

From `handovers.csv` (it may be missing): the seat handovers of the current year, an input the
person running the import writes. See **Seat handovers** below.

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
  ("Vice Team Leader") is refused, not guessed. These readings were added by issue #816:
  - A leading "AMV " is removed before the table runs, and from the stored title: "AMV Chief
    Engineer" is the Chief Engineer seat, titled "Chief Engineer".
  - "Safety Officer" is a core member's seat titled "Safety Officer". Any other title with
    "officer" and no rule is still refused.
  - "<Dept> Head of Department" is the head seat of the row's department. So "Electronics Head of
    Department - Hardware Lead Engineer" gives the Electronics head seat and the Hardware lead seat,
    placed by the row's units (see the Division cell form under **Units**).
  - " & " parts seats too, but only when the table reads every part by a rule: "President & Chief
    Engineer" gives the president seat and the Chief Engineer seat. "Design & Manufacturing Lead"
    stays one seat, since "Design" is no seat. A note at the end goes with the last part.
  - "President-Advisor" gives two seats: the president seat, and an advisor seat placed in the
    department its note names, with "Project " removed. "President-Advisor (Project Cavour)" gives
    "President" and "Advisor (Project Cavour)", the advisor placed in the Cavour department. The
    note is read as a Subteam value of that row (see **Units**): on a sheet from 2024-2025 on,
    Cavour is a project, so the advisor has no unit.
- **Units** (`units.ts`, `unit-book.ts`): a subteam or division cell is split on " - ", ",", ";",
  "/" and line breaks; the slash of "N/A" does not split. Each value resolves by name, else by the
  code in its parentheses ("Propulsion (PRO)", "Electronics (ELT) Department"), against the
  `departments` and `divisions` the database holds, closed ones included. "N/A", "AMV" and
  "Amerigo Vespucci (AMV)" are no unit. An "ADVISOR" or "SENIOR ADVISOR" marker, with or without a
  project in parentheses, makes the row's plain member seat an `advisor` role. A project's name
  (any version of a `projects` row on the database) is not a unit: the schema has no project on
  `roles`, so it is set aside. A cell that names only a project gives no unit, and a seat that needs
  one is refused and reported. Every value that resolves to nothing is reported, and the report
  counts the distinct names.
  - **Past subteams are departments.** Before 2024-2025 the subteams bore the projects' names
    (Cavour, Efesto, Vittorio Emanuele II (VES), and also Liquid Propulsion, Operations,
    Management). So on the year sheets before 2024-2025, and on a Subteam cell a `Roles YY-YY`
    sheet gives, every Subteam value is a department, even one that names a project. The `Quitters`
    sheet is read the same way (`subteamReadingOf`), though a Quitters row gives no role.
  - **Several units in one row.** A member's seat gives one role in each division the row names,
    and one in each department that no division of the row belongs to. A head seat gives one role
    in each department, a lead seat one in each division. A unit named twice gives one role.
  - **"<Dept> Department - <Division>".** A Division cell value that names a department
    ("Electronics (ELT) Department", "Electronics Dept.") is that department, not a division. The
    divisions after it in the cell are its divisions. So "Electronics (ELT) Department - Hardware
    (HDW)" is the Electronics department plus the Hardware division.
  - **Past units are created closed.** A department or division that a past year's row names (any
    year sheet before the current one, or its Roles sheet), that no unit in the database has, and
    that the current year's sheet does not name, is created once. It is created with
    `started_at` the first day of the first academic year a row names it (`YYYY-10-01`) and
    `closed_at` the last day of the last one (`(YYYY+1)-09-30`). Its code is the first one a row
    gives in parentheses. Its name drops a trailing "Department" or "Division". A created
    department has the default kind, `technical`. A created division goes under the department
    its row pairs it with: the department its Division cell names before it, else the row's one
    department. With no pairing (several departments, or none) it has no department. A name two
    units share, or a unit the current sheet names but the database lacks, is never created: it is
    reported as unresolved.
- **Dates**: current-year roles are active. Earlier years' roles run `YYYY-10-01` to
  `(YYYY+1)-09-30`.
- **Seats**: a second active holder of the team leader seat, a department head seat or a
  full-access seat this year is refused and reported. Rows already in the database count. A seat
  handed over this year (below) is the exception.
- **Seat handovers** (`handovers.csv`, issue #816): marks a seat that changed holder within the
  current year. The roster gives no handover day, so the import's own day is used. The file names
  rows, never people:

  ```csv
  sheet,from_row,to_row
  2026-2027,113,50
  ```

  - `sheet`: the current year's sheet name, exactly as in the workbook.
  - `from_row`: the row number (as the report prints it) of the holder who handed the seat over.
  - `to_row`: the row number of the holder who took it.

  The seats handed over are those both rows' titles give (team leader, a department head seat, or
  a full-access seat). The `to_row` holder gets the active seat. The `from_row` holder keeps an
  active membership and their other roles, plus the handed-over seat as a role that ended on the
  day of the import. No `seat-taken` conflict is raised for that pair. A line naming another
  sheet, a row that is no person's row on the current sheet, or two rows with no seat in common is
  not applied and is reported as `handover-unmatched`. Keep the file beside the workbook for every
  run, dry or not. A later run finds the ended role present whatever day it runs.
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
- **Present rows**: a unit the roster names that the database holds (a closed unit a run created
  included), a person whose email an account already holds, a role with the same member, unit,
  title and dates (a handed-over role: with any end day), an advisor or FAQ with the same name or
  question, a position with the same title and division, an order with the same requester, name
  and time. A second run creates no unit, inserts nothing and uploads nothing.

## Fixtures

`fixtures/make-fixtures.ts` writes `fixtures/files/` and `fixtures/rules/`. Every name in them is
invented, every email is on `example.com`, and the photos are tiny generated JPEGs.
`import.test.ts` runs the tool over `files/`; `rules.test.ts` runs it over `rules/`, a roster that
plants each reading rule of issue #816, with a `handovers.csv`.
