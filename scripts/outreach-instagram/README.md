# Outreach Instagram import (one-time)

A one-time, insert-only import that brings the site's outreach posts in line with the team's
Instagram account (issue #886). It gives each existing post a new draft with a longer text and a
gallery of its carousel photos, and adds the posts the site never had. The owner runs it: on the
preview database first, then on production. After the production run, a follow-up PR removes this
directory, as was done with the team data import (`scripts/import`, removed by PR #847).

## What it writes

- **An existing post** is found by its published title. It gets a new **draft**: its published
  version with the source's longer body, and with the source's carousel photos added to its
  gallery after any photos the gallery already has. The title, date, place, tags, summary, lead,
  cover photos and channel links stay as they are.
- The schema holds one published and one draft row per post. So a post that **already has a
  draft is skipped** and listed in the report: a new draft would overwrite it. The published row
  is never replaced.
- **A post Instagram has and the site does not** is added as a new post that holds a **draft
  only**, after every stored post in the site order. Its first gallery photo is also its cover. It
  links no channel: the export gives no post URLs, so none is made up.
- Nothing goes live. The owner reads each draft in the dashboard (Outreach) and publishes it there.

It never updates or deletes a row. A second run plans nothing: every post it drafted now has a
draft, and every post it added holds its title's address.

## How to run it

Agents never run it against production.

```sh
# 1. Dry run: prints the full list, writes and uploads nothing.
IMPORT_DATABASE_URL='<database url>' pnpm db:outreach-instagram <source-file> --photos <export-dir> --report <outside-the-repo>/outreach-instagram-dry-run.txt

# 2. Real run: uploads the photos, then writes in one transaction.
IMPORT_DATABASE_URL='<database url>' IMPORT_BLOB_TOKEN='<public store token>' pnpm db:outreach-instagram <source-file> --photos <export-dir> --mode import --report <outside-the-repo>/outreach-instagram-run.txt
```

- `<source-file>`: the import source (below), kept outside the repo.
- `--photos <export-dir>`: the Instagram export's directory (the one holding `media/` and
  `your_instagram_activity/`). The source names each photo by its path inside it. The tool reads
  those files as data and refuses a path that leaves the directory. Nothing in the export is run.
- `--mode dry-run` (the default) reads the source, the photos and the database, and prints the
  report. `--mode import` uploads the photos and writes.
- `--database-url <url>`, or `IMPORT_DATABASE_URL` set for this one command: both modes need it.
  The tool loads no `.env` file and never reads `DATABASE_URL`.
- `--blob-token <token>`, or `IMPORT_BLOB_TOKEN` set for this one command: the read-write token of
  the public Vercel Blob store the site's photos are served from (`PUBLIC_BLOB_READ_WRITE_TOKEN`).
  An import needs it. The tool never reads `BLOB_READ_WRITE_TOKEN`.
- `--report <file>`: also writes the report to this file. Keep it outside the repo.

A real run shapes every photo first; one photo the store would not take stops it before any
upload. It then uploads the photos, re-reads the database, and writes in one transaction only
while the plan still stands. A failure before the commit writes nothing and prints "Outreach
Instagram import failed; nothing was written." If photos were uploaded first, it says how many:
no row names them, and the daily sweep of editor uploads deletes them after a day
(`lib/storage/upload-sweep.ts`). A failure after the commit (printing or writing the report,
closing the connection) prints "Outreach Instagram import was written: its transaction committed.
Then <step> failed." Do not run it again to recover the report: a second run plans nothing.

## The source

One JSON file:

```json
{
  "existing": [
    {
      "title": "<the post's published title on the site>",
      "body": [{ "kind": "paragraph", "text": "…" }, { "kind": "highlight", "label": "AWARD", "text": "…" }],
      "gallery": [{ "file": "media/posts/<id>.jpg", "alt": "…", "caption": "optional" }]
    }
  ],
  "added": [
    {
      "title": "…",
      "date": "YYYY-MM-DD",
      "place": "City, Country",
      "tags": ["<a tag on the tag list>"],
      "summary": { "text": "…", "phone": "optional, shorter" },
      "lead": "…",
      "body": [{ "kind": "paragraph", "text": "…" }],
      "gallery": [{ "file": "media/posts/<id>.jpg", "alt": "…" }]
    }
  ]
}
```

- A body block is a `paragraph`, a `heading` or a `highlight` (with a `label`), as the editor's.
- Every gallery photo needs alt text. A file is shaped as the Edit post panel shapes a picked
  photo: turned upright, at most 2400 px a side, a JPEG at quality 0.86, and it must pass the
  panel's upload check. One file named twice is uploaded once.
- Every text is site copy: a hashtag, an @handle, an emoji or the styled Unicode letters captions
  use is refused, with where it is, before the database is read.
- A new post's tags must be on the tag list, and its title's address must be free.

## What the report prints

Every draft and every new post in full, so the texts can be approved as they will be stored: each
body block, and each gallery photo with its alt text and its file in the export. Then each post
skipped, with why (`has-draft`, `no-post`, `several-posts`, `address-taken`, `unknown-tag`), and
the photo count, with any file the store would not take.

## Tests

`import.test.ts` runs the import on a fake source built in memory (every text invented), photos
made in the test, a fake public store, and the in-memory Postgres the other tests use. It covers
the text and path checks, the dry-run list, the skips, a photo the store would not take, the
inserted drafts and new posts with every stored version unchanged, idempotency, and what a failed
run prints before and after its commit.
