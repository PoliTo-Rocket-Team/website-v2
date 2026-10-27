# Team data import

Loads the real team into a database that has the schema but no people (issue #677). It reads the
roster workbook, the old Supabase CSV exports and the old photos. It reports every conflict. It
inserts members, their roles by academic year, alumni, advisors, open positions, FAQs, orders and
member and advisor photos. It also creates the departments and divisions the roster names and the
database lacks: closed ones for past units, open ones for units on the current sheet (issue #816).
It never updates or deletes a row.

Running it on a real database (preview or production) is an owner step. The tests run it only on
the fake files in `fixtures/files/` and `fixtures/rules/`, an in-memory database and a fake photo
store.

## Usage

```sh
pnpm db:import <source-dir> [--mode dry-run|import] [--year YYYY-YYYY] [--report <file>] [--database-url <url>] [--blob-token <token>]
```

- `<source-dir>`: the directory with the roster workbook (one `.xlsx`), the CSV exports, a
  `photos/` folder if there are photos, and an `overrides.csv` if the owner made a decision the
  workbook cannot carry (see **The override input** below).
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

The report prints counts and places only, plus the names of the units it creates. Per table it
prints the rows to insert (or inserted), already present and refused. Under the table it lists
each department and division to create by name and code, marked `open, from <day>` or
`closed, <day> to <day>`, a division with the department it goes under. Under each unit a
`spellings:` line lists the distinct roster values folded into it (see **Units**). Then it prints
the number of alumni, of people in more than one year sheet, of unclear quitters, of Quitters dates
read with day and month swapped, of sheet rows skipped for having no name, of override lines
applied (handovers and quitter years) and of distinct unresolved unit names; the photo counts; then
each conflict with its file, sheet, row and field. Unclear quitters are listed by their Quitters
row, and so are the swapped Quitters dates, each with the cell swapped (`leftOn` or `joinedOn`). It prints no person's name, email, phone, ID or photo
file name. A photo is named by its row: its place in the sorted file list of `photos/`.

## What it reads

From the workbook:

- every `YYYY-YYYY` sheet up to the current year. The current one gives active members and active
  roles. Each earlier one gives ended roles for that academic year.
- `2022-2023` reads two columns of its own (owner decision, issue #816). The column headed "A"
  (next to Subteam) is its Division column. Its "Date of joining" column, where a row fills it, is
  the day that row's roles start that year (see **Dates**).
- `Quitters`: who left, the day they left (`Left the Team on:`) and the day they joined
  (`Joined the Team on:`).
- `Roles YY-YY` (for example `Roles 23-24`): that year's seats with the division the year's own
  sheet lacks. A row joins that year's sheet by the person-match rule below. Its subteam, division
  and title fill only the cells the year sheet left empty. A row that matches nobody on that
  year's sheet is reported as `roles-sheet-unmatched`.
- `Roles 22-23` is not read at all (owner decision, issue #816): 2022-2023 data comes only from
  the `2022-2023` sheet. The report lists it under the sheets left out, and none of its rows
  raises a conflict.
- `Stats` and any other sheet are not read.

Columns are found by header text through the alias table in `columns.ts`, never by position. The
header row is the first of the top 15 rows that holds the required fields. A row with every field
empty is left out. A row of a year, `Quitters` or `Roles` sheet with neither a first nor a last
name is left out too (issue #816): it is a template row, often holding only placeholder emails. It
raises no conflict, it is never matched to a person by its emails, and the report counts it.

From the CSVs (any may be missing): `people_rows.csv`, `team_members_rows.csv`,
`subteams_rows.csv`, `divisions_rows.csv`, `advisors_rows.csv`, `positions_rows.csv`,
`orders_rows.csv`, `faqs_rows.csv`. The workbook wins on any field both carry. A CSV fills only a
field the workbook left empty, and reports a field where it disagrees.

From `photos/` (it may be missing): JPEG files named `<id>-<surname>.jpeg` (a member's) or
`<surname>.jpeg` (an advisor's or a professor's). See **Photos** below.

From `overrides.csv` (it may be missing): the owner decisions the workbook cannot carry, an input
the person running the import writes. See **The override input** below.

## Rules

- **Person match** (`people.ts`): a row is the person who already has one of its emails (every
  email column, compared in lower case). Failing that, it is the person with the same full name,
  where accents, case, punctuation and spacing do not count. Year sheets are read newest first, so
  the newest sheet wins a personal field. A year sheet row starts a new person, and so does a
  `Quitters` row that matches nobody on a year sheet (see **Quitters**). A row with no name never
  takes part (see **What it reads**).
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
  one is refused and reported. A name two units share, or a name that is only a level word
  ("Department"), resolves to nothing: it is reported, and the report counts the distinct names.
  - **Past subteams are departments.** Before 2024-2025 the subteams bore the projects' names
    (Cavour, Efesto, Vittorio Emanuele II (VES), and also Liquid Propulsion, Operations,
    Management). So on the year sheets before 2024-2025, on a Subteam cell a `Roles YY-YY` sheet
    gives, and on the `Quitters` sheet, every Subteam value is a department, even one that names a
    project (`subteamReadingOf`).
  - **Several units in one row.** A member's seat gives one role in each division the row names,
    and one in each department that no division of the row belongs to. A head seat gives one role
    in each department, a lead seat one in each division. A unit named twice gives one role.
  - **"<Dept> Department - <Division>".** A Division cell value that names a department
    ("Electronics (ELT) Department", "Electronics Dept.") is that department, not a division. The
    divisions after it in the cell are its divisions. So "Electronics (ELT) Department - Hardware
    (HDW)" is the Electronics department plus the Hardware division.
  - **Units the database lacks are created.** A department or division a row names that no unit
    in the database has is created once, whichever row names it first. Its `started_at` is the
    first day of the first academic year a row names it (`YYYY-10-01`). Its name and code come
    from the values that spell it (see **One unit, several spellings** below). Its name drops a
    trailing "Department" or "Division". A created
    department has the default kind, `technical`. A created division goes under the department
    its row pairs it with: the department its Division cell names before it, else the row's one
    department. With no pairing (several departments, or none) it has no department.
    - **Past units are created closed.** A unit the current year's sheet does not name is one the
      team no longer has. Its `closed_at` is the last day of the last academic year a row names it
      (`(YYYY+1)-09-30`). A quitter-only alumnus's row counts as a row of the year they left in.
    - **Current units are created open** (owner decision). A unit the current year's sheet names
      is one the team has now: it is created with no `closed_at`. A past row naming it is placed
      in that same unit.
  - **One unit, several spellings** (`UnitFold` in `unit-book.ts`, issue #818). Before any row is
    placed, the run reads every unit value its rows give, by level (departments, divisions), and
    groups them. Values with the same name (as **Units** compares names) or the same code in
    parentheses are one unit: "Optimization and Analysis (AOA)", "Optimization & Analysis (AOA)"
    and "Aerodynamic Optimization and Analysis (AOA)" are one, and so are "Logistics (LGS)" and
    "Logistcs (LGS)". A bare value equal to a code is that code's unit: "VES" is "Vittorio
    Emanuele II (VES)". The order the rows come in does not matter.
    - A group the run creates is created once. Its name is the name its code appears with most
      often on the newest sheet that gives the code (the first one read on a tie); a group with
      no code is named the same way from all its values. A `Quitters` row counts as older than
      every year sheet.
    - A group that any value on the current year's sheet gives is created open, even when past
      sheets also name it. It is never also created closed.
    - A value that finds no unit in the database is the unit another value of its group finds,
      when they find exactly one: with "Logistics" in the database, "Logistcs (LGS)" is placed
      there too. When they find two or more, the value is not resolved and nothing is created:
      with "Alpha" and "Beta" in the database, "Gamma (X)" beside "Alpha (X)" and "Beta (X)" is
      reported as `unknown-unit` and counted as an unresolved unit.
    - The group's name, its open state and its `spellings:` line all come from every value the
      rows give, rows the plan refuses included. So a unit named after a spelling always lists
      that spelling. Its `started_at` and `closed_at` years come from the rows placed in it.
- **Dates**: current-year roles are active. Earlier years' roles run `YYYY-10-01` to
  `(YYYY+1)-09-30`. On the `2022-2023` sheet, a row whose "Date of joining" cell is filled starts
  its roles that year on that day instead of `2022-10-01` (the date forms of **Quitters** all
  read). A joining day that does not read, or falls after `2023-09-30`, is reported as
  `joined-date-unreadable` and the row's roles start on `2022-10-01`. A quitter-only alumnus's
  roles run as **Quitters** says.
- **Seats**: a second active holder of the team leader seat, a department head seat or a
  full-access seat this year is refused and reported. Rows already in the database count. A seat
  handed over this year (see **The override input**) is the exception.
- **Alumni**: anyone not on the current sheet. They get `team_from` / `team_to` (the academic
  years of their first and last role), one `team_leaves` row and ended roles only. They get no
  active role and no access. A year-sheet alumnus left on their Quitters day, if they have one,
  else on the last day of their last year.
- **Quitters** (`quitters.ts`, issue #816):
  - A quitter also on the current sheet imports as active and is reported as an unclear quitter.
  - A quitter on an earlier year sheet is an alumnus of those years; their Quitters day is the day
    they left.
  - A quitter on no year sheet (owner decision) is imported as an alumnus of the academic year
    their "Left the Team on" day falls in. They get one role per seat of their Quitters row's
    title, placed in the units of that row by the rules above. Each role starts on the row's
    "Joined the Team on" day when the cell has one, else on the first day of that academic year,
    and ends on the leave day. Their `team_leaves` day is the leave day.
  - A date cell is read in any of these forms: an Excel date cell (a day serial), `dd/mm/yyyy`,
    `d/m/yyyy`, `dd.mm.yyyy`, or `yyyy-mm-dd`. The day comes first. A cell that is none of these,
    or no real day between 1990 and 2100 ("31/02/2024", a bare "2024", a serial too large for any
    day), does not read.
  - **Swapped day and month** (owner decision, issue #818). Quitters dates are day/month, but the
    spreadsheet stored some date cells as month/day. So when a quitter-only row's join day falls
    after its leave day, the run tries to swap one date cell's day and month: first the leave day,
    then the join day. A cell is swapped only when it is a date cell (a day serial; typed text is
    already day/month), its day is 12 or less, and the swap puts the join on or before the leave.
    The row then imports normally, from the swapped day; a swapped leave day also gives the
    academic year. When neither swap does it, the row stays `quitter-date-unreadable`. The report
    counts the swapped dates and lists each by row and cell.
  - A `quitter-year` line of the override input gives a Quitters row an academic year. That row
    then imports as an alumnus of that year, its roles running from the year's first day to its
    last, and its leave day the year's last day, whatever its date cells hold.
  - A quitter on no year sheet with no leave day and no `quitter-year` line is not imported: it is
    reported as `quitter-no-date`. One whose leave day or join day does not read, or whose join day
    is after its leave day, is not imported either: it is reported as `quitter-date-unreadable`.
    Both are listed by their Quitters row under "Unclear quitters".
- **Imported Alumni entries** (migration 0021): a person whose name matches one is reported. No
  role is inserted for a year that entry lists. The entry is left as it is.
- **Photos** (`photos.ts`, owner decision in issue #816):
  - A file named `<id>-<surname>` is a member's. The id is always a row's `id` in
    `people_rows.csv`, matched exactly, and never an advisor's id: an id a person and an advisor
    share is the person's. The surname only cross-checks it: a different surname holds the file,
    and an id on no `people_rows.csv` row is not imported.
  - A `people_rows.csv` row reaches its person by the **Person match** rule. When its full name
    matches nobody, it is the one imported person with the same surname (accents, case and
    spacing do not count) whose given names, on a workbook row of theirs, contain each word of the
    CSV row's first name (owner decision, issue #818): "Maria Rossi" is "Anna Maria Rossi". Only
    people the plan imports count, so a refused person (no sign-in email, an account with no
    member, or an unclear quitter) never makes the row ambiguous. When no imported person fits, or more than one does, the row
    matches nobody, and a photo with its id is reported as `photo-not-imported`, as before.
  - A file named `<surname>` (no id) is an advisor's or a professor's. It matches the one advisor
    with that surname: a row of `advisors_rows.csv`, or a person whose workbook row is an advisor's
    (an "ADVISOR" or "SENIOR ADVISOR" marker in a unit cell, or an advisor seat in the title). One
    name listed in both places, or on several rows, is one advisor; the CSV row is used. No advisor
    with that surname, or more than one, is reported and the file is not imported.
  - A member's photo is cut to the centred square, at most 800 px, as a JPEG at quality 0.9, as the
    dashboard's crop dialog does. It must pass `checkMemberPhoto`. It is stored at
    `photos/<memberId>-<uuid>.jpg` and its URL goes into the new `members.picture`. An advisor's
    photo (an `advisors_rows.csv` match) passes `checkPhotoUpload` and is stored as a Team page
    upload; its URL goes into the new advisor version's `photo`. A workbook advisor's photo is a
    member's photo of that person. Photos are linked only to members and advisors the same run
    inserts. A file uploaded by a run that then fails stays in the store unlinked.
  - A `has_pp` row with no file is reported: a `people_rows.csv` row when no file carries its id,
    an `advisors_rows.csv` row when no surname file matched it.
- **Present rows**: a unit the roster names that the database holds (a unit a run created
  included), a person whose email an account already holds, a role with the same member, unit,
  title and dates (a handed-over role: with any end day), an advisor or FAQ with the same name or
  question, a position with the same title and division, an order with the same requester, name
  and time. A second run creates no unit, inserts nothing and uploads nothing.

## The override input

`overrides.csv` holds the owner decisions the workbook cannot carry (issue #816). The person
running the import writes it and keeps it beside the source files, outside the repo, for every
run, dry or not. Each line names rows, never people. Row numbers are the ones the report prints.

```csv
kind,sheet,row,value
handover,2026-2027,113,50
quitter-year,Quitters,7,2022-2023
```

- `kind`: `handover` or `quitter-year`.
- `sheet`: the workbook sheet the row is on, exactly as the workbook names it.
- `row`: the row number on that sheet.
- `value`: for `handover`, the row number of the new holder; for `quitter-year`, the academic
  year as `YYYY-YYYY`.

**`handover`**: a seat that changed holder within the current year. `sheet` is the current year's
sheet, `row` the holder who handed the seat over, `value` the holder who took it. The seats handed
over are those both rows' titles give (team leader, a department head seat, or a full-access seat).
A head seat's department may be one the run creates. The new holder gets the active seat. The
earlier holder gets the handed-over seat as a role that ended on the day of the import (the roster
gives no handover day), and keeps the other roles their row gives. They stay an active member: the
app counts a member with no active role as off the team, so when the handed-over seats were their
row's only roles, they also get an active plain member's role titled "Member" (type `core`),
placed in their row's units by the member rule of **Units** (no unit when the row names none),
from the start of the current year. No `seat-taken` conflict is raised for that pair. A later run
finds the ended role and the member's role present whatever day it runs.

**`quitter-year`**: a Quitters row of a person on no year sheet, placed in the academic year
`value` (see **Quitters**).

A line is not applied, and is reported as `override-unmatched` on the field at fault, when its
kind is neither of these, its row is no number, its value is no row number or academic year, a
`handover` names a sheet other than the current year's, a row that is no person's row there, or
two rows with no seat in common, or a `quitter-year` names a row that is not the Quitters row of a
person on no year sheet.

## Fixtures

`fixtures/make-fixtures.ts` writes `fixtures/files/` and `fixtures/rules/`. Every name in them is
invented, every email is on `example.com`, and the photos are tiny generated JPEGs.
`import.test.ts` runs the tool over `files/`; `rules.test.ts` runs it over `rules/`, a roster that
plants each reading rule of issue #816, with an `overrides.csv`. `parsing.test.ts` covers the
readers: the date forms, the override lines, a quitter's stint (a swapped date cell included) and
the photo matching. `roster-shapes.test.ts` plans the shapes of issue #818 over a fake roster built
in memory: swapped Quitters dates, a shorter first name in `people_rows.csv`, and one unit spelt
several ways.
