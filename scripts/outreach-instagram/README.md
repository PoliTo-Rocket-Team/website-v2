# Outreach Instagram import (one-time)

A one-time import that brings the site's outreach posts in line with the team's Instagram account
(issue #886). Every Instagram post becomes a news post, except reels and duplicates: each existing
post gets a draft with a longer text and a gallery of its carousel photos, and every other post is
added as a new draft post. The owner runs it: on the preview database first, then on production.
After the production run, a follow-up PR removes this directory, as was done with the team data
import (`scripts/import`, removed by PR #847).

## What it writes

It never touches a published version, and never a draft it did not write.

- **An existing post** is found by its published title. Its **draft** is its published version
  with the source's longer body, and with the source's carousel photos added to its gallery after
  any photos the gallery already has. The title, date, place, tags, summary, lead, cover photos and
  channel links stay as they are.
- The schema holds one published and one draft row per post. A post with no draft gets a new one.
  A post whose draft an earlier run of this import wrote, unchanged since, has that draft updated.
  A post holding **any other draft is skipped** and listed in the report: writing would overwrite
  it.
- **A post Instagram has and the site does not** is added as a new post that holds a **draft
  only**, after every stored post in the site order. Its first gallery photo is also its cover. It
  links no channel: the export gives no post URLs, so none is made up. A later run updates the
  draft of the post it added, so no post is added twice; once the owner has published that post or
  changed its draft, the import leaves it alone.
- **A tag** the source's new posts need and the tag list lacks is added at the end of the list.
- Nothing goes live. The owner reads each draft in the dashboard (Outreach) and publishes it there.

### The ledger

The database holds no mark of which drafts the import wrote, so a JSON file outside the repo does:
for each source key, the post a run wrote a draft on and that draft's fingerprint. A run reads it,
and a real run updates it after its transaction commits. Each database keeps its own ledger: the
preview's and production's are two files. A run without its ledger takes the import's own drafts
for someone else's and skips them, and finds each added post's title already taken, so it adds no
second post.

### Seeding the ledger from the first round

The first round of this import (on the preview database only) kept no ledger. Its real-run report
is the record of what it wrote, so `--mode seed-ledger` builds that database's ledger from it. It
reads the report, the current source and the database (selects only), and writes a new ledger
file; it refuses a ledger file that already exists. Each first-round post is matched to a source
key by its title, or, for an added post the source has retitled, by its date when exactly one source
post not matched by title has it. A post is seeded only while its draft is as the first round left
it: the title, body and added gallery photos the report printed, and for a stored post every other
field as its published version has it; for an added post, the date, place, tags, summary and lead
the report printed. Any other draft is not seeded, so the run leaves it alone. The seeding prints
each first-round post, seeded with its key or not with why.

## How to run it

Agents never run it against production.

```sh
# 0. Only on a database the first round wrote to, and only once: seed its ledger from that round's report.
IMPORT_DATABASE_URL='<database url>' pnpm db:outreach-instagram <source-file> --mode seed-ledger --first-round-report <outside-the-repo>/<first-round report> --ledger <outside-the-repo>/outreach-instagram-ledger-<database>.json

# 1. Dry run: prints the full list, writes and uploads nothing.
IMPORT_DATABASE_URL='<database url>' pnpm db:outreach-instagram <source-file> --photos <export-dir> --ledger <outside-the-repo>/outreach-instagram-ledger-<database>.json --report <outside-the-repo>/outreach-instagram-dry-run.txt

# 2. Real run: uploads the photos, then writes in one transaction, then updates the ledger.
IMPORT_DATABASE_URL='<database url>' IMPORT_BLOB_TOKEN='<public store token>' pnpm db:outreach-instagram <source-file> --photos <export-dir> --ledger <outside-the-repo>/outreach-instagram-ledger-<database>.json --mode import --report <outside-the-repo>/outreach-instagram-run.txt
```

- `<source-file>`: the import source (below), kept outside the repo.
- `--photos <export-dir>`: the Instagram export's directory (the one holding `media/` and
  `your_instagram_activity/`). The source names each photo by its path inside it. The tool reads
  those files as data and refuses a path that leaves the directory. Nothing in the export is run.
  The dry run and the import need it.
- `--ledger <file>`: this database's ledger. A first run names a file that does not exist yet.
- `--mode dry-run` (the default) reads the source, the ledger, the photos and the database, and
  prints the report. `--mode import` uploads the photos and writes. `--mode seed-ledger` writes a
  new ledger from `--first-round-report <file>`, the first round's real-run report (above).
- `--database-url <url>`, or `IMPORT_DATABASE_URL` set for this one command: every mode needs it.
  The tool loads no `.env` file and never reads `DATABASE_URL`.
- `--blob-token <token>`, or `IMPORT_BLOB_TOKEN` set for this one command: the read-write token of
  the public Vercel Blob store the site's photos are served from. An import needs it. It reads
  `vercel_blob_rw_<store id>_<secret>`, as the store's page on Vercel shows it (Storage, the store,
  its `.env.local` tab); space at either end is dropped. Any other value is refused before anything
  is read, with what was expected, and the value is never printed. The value the dashboard lists
  for an encrypted environment variable, and an OIDC token, both start `eyJ` and are refused. The
  store's answer must be a URL on that store's public host, so a private store's token fails at the
  first upload. The tool never reads `BLOB_READ_WRITE_TOKEN`.
- `--report <file>`: also writes the report to this file. Keep it outside the repo.

A real run shapes every photo first; one photo the store would not take stops it before any
upload. It then uploads the photos, re-reads the database, and writes in one transaction only
while the plan still stands. A failure before the commit writes nothing and prints "Outreach
Instagram import failed; nothing was written." If photos were uploaded first, it says how many:
no row names them, and the daily sweep of editor uploads deletes them after a day
(`lib/storage/upload-sweep.ts`). A failure after the commit (writing the ledger, printing or
writing the report, closing the connection) prints "Outreach Instagram import was written: its
transaction committed. Then <step> failed." If the ledger is the step that failed, the next run
skips this run's drafts and posts rather than writing them twice.

## The source

One JSON file:

```json
{
  "newTags": ["Launch", "Competition"],
  "existing": [
    {
      "key": "pi-day",
      "title": "<the post's published title on the site>",
      "body": [{ "kind": "paragraph", "text": "…" }, { "kind": "highlight", "label": "AWARD", "text": "…" }],
      "gallery": [{ "file": "media/posts/<id>.jpg", "alt": "…", "caption": "optional" }]
    }
  ],
  "added": [
    {
      "key": "maker-faire-2026",
      "title": "…",
      "date": "YYYY-MM-DD",
      "place": "City, Country",
      "tags": ["<a tag on the tag list or in newTags>"],
      "summary": { "text": "…", "phone": "optional, shorter" },
      "lead": "…",
      "body": [{ "kind": "paragraph", "text": "…" }],
      "gallery": [{ "file": "media/posts/<id>.jpg", "alt": "…" }]
    }
  ]
}
```

- `key`: lowercase words joined by hyphens, one per post, the same on every run: the ledger finds
  a post's draft by it.
- A body block is a `paragraph`, a `heading` or a `highlight` (with a `label`), as the editor's.
- Every gallery photo needs alt text. A file is shaped as the Edit post panel shapes a picked
  photo: turned upright, at most 2400 px a side, a JPEG at quality 0.86, and it must pass the
  panel's upload check. One file named twice is uploaded once.
- Every text is site copy: a hashtag, an @handle, an emoji or the styled Unicode letters captions
  use is refused, with where it is, before the database is read.
- A new post's tags must be on the tag list or in `newTags`, and its title's address must be free.

## What the report prints

First one line per post: its date, its text's length in words and paragraphs, its photo count, and
what the run does to it (`new draft`, `draft replaced`, `new post`, `new post, draft replaced`),
with the post count and the shortest, longest and average length. Then the tags it adds, and every
draft and new post in full, so the texts can be approved as they will be stored: each body block,
and each gallery photo with its alt text and its file in the export. Then each post skipped, with
why (`has-draft`, `changed-since`, `no-post`, `several-posts`, `address-taken`, `unknown-tag`), and
the photo count, with any file the store would not take.

## Tests

`import.test.ts` runs the import on a fake source built in memory (every text invented), photos
made in the test, a fake public store, and the in-memory Postgres the other tests use. It covers
the text, key and path checks, the dry-run list, the skips, a photo the store would not take, the
drafts, new posts and tags a first run writes with every stored version unchanged, a second run
that replaces the import's own drafts and reuses its post while leaving others' drafts alone, a
draft edited since, a run without its ledger, and what a failed run prints before and after its
commit. It also builds a fake first-round report for what a first run wrote and checks the seeded
ledger is that run's own (a retitled added post matched by its date), that the next run then updates
the drafts and adds no post, that a draft changed since is not seeded, that a report of another
shape is refused, that a seeded ledger never replaces a file, and which store tokens are taken.
