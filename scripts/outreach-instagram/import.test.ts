import assert from "node:assert/strict";
import { before, test } from "node:test";
import sharp from "sharp";
import { outreachPosts, outreachPostTags, outreachPostVersions, outreachTags } from "@/db/schema";
import { addRows, changeRows, databaseWrites, restore, tableRows, testDb } from "@/lib/dashboard/access-matrix/test-database";
import { publicPathnameOfUrl, publicStoreHost } from "@/lib/storage/pathname";
import { FailedAfterUpload, failureReport } from "./failure";
import { emptyLedger, ledgerText, type Ledger } from "./ledger";
import type { PhotoReader, PhotoStore } from "./photos";
import { runImport, type RunOptions } from "./run";
import type { ImportDb } from "./snapshot";
import { captionMarkIn, sourceOf, SourceError, type Source } from "./source";

// The outreach Instagram import (issue #886) over a fake source built in
// memory, fake photos made here, a fake public store, and the in-memory
// Postgres every migration in drizzle/ built: its posts are the site's record
// (migration 0032) and the summit story (0044). Every drafted text, alt text,
// photo and new post below is invented.

const db = testDb as unknown as ImportDb;

type VersionRow = typeof outreachPostVersions.$inferSelect;

const versions = async () => (await tableRows(outreachPostVersions)) as VersionRow[];

async function postIdOf(title: string): Promise<number> {
  const row = (await versions()).find((v) => v.version === "published" && v.title === title);
  assert.ok(row, `the migrated database has a post titled ${title}`);
  return row.postId;
}

/** A tiny real photo, so the shaping runs as it does on the export's files. */
const photoBytes = async (colour: string) => new Uint8Array(await sharp({ create: { width: 12, height: 8, channels: 3, background: colour } }).jpeg().toBuffer());

const FILES = new Map<string, Uint8Array>();
before(async () => {
  FILES.set("media/posts/a.jpg", await photoBytes("#c60"));
  FILES.set("media/posts/b.jpg", await photoBytes("#06c"));
  FILES.set("media/posts/c.jpg", await photoBytes("#6c0"));
});
const UNFIT = "media/posts/not-a-photo.jpg";
const reader = (extra: Record<string, Uint8Array> = {}): PhotoReader => (file) => {
  const bytes = extra[file] ?? FILES.get(file);
  if (bytes === undefined) throw new Error(`no fake file ${file}`);
  return bytes;
};

const HOST = publicStoreHost("store_fakeStore123");

/** A public store kept in memory: each upload is recorded, and `failAt` makes the nth one fail. */
function fakeStore(failAt?: number): PhotoStore & { readonly uploads: string[] } {
  const uploads: string[] = [];
  return {
    host: HOST,
    uploads,
    writes: {
      async upload(pathname) {
        if (uploads.length + 1 === failAt) throw new Error("the store is down");
        uploads.push(pathname);
        return { url: `https://${HOST}/${pathname}` };
      },
    },
  };
}

const SOURCE: Source = sourceOf({
  newTags: ["Launch", "Fair"],
  existing: [
    {
      key: "pi-day",
      title: "Pi Day Fair",
      body: [
        { kind: "paragraph", text: "An invented longer first paragraph about the fair." },
        { kind: "paragraph", text: "An invented second paragraph, about €800 and nothing else." },
      ],
      gallery: [
        { file: "media/posts/a.jpg", alt: "An invented first alt text." },
        { file: "media/posts/b.jpg", alt: "An invented second alt text.", caption: "An invented caption." },
      ],
    },
    { key: "luna", title: "Luna e Italia", body: [{ kind: "paragraph", text: "Invented." }], gallery: [{ file: "media/posts/c.jpg", alt: "Invented." }] },
    { key: "nowhere", title: "No such post", body: [{ kind: "paragraph", text: "Invented." }], gallery: [{ file: "media/posts/c.jpg", alt: "Invented." }] },
  ],
  added: [
    {
      key: "example-launch",
      title: "Example launch",
      date: "2024-02-15",
      place: "Torino, Italy",
      tags: ["Launch", "School"],
      summary: { text: "An invented summary.", phone: "Invented." },
      lead: "An invented lead.",
      body: [{ kind: "paragraph", text: "An invented body." }, { kind: "highlight", label: "FACT", text: "An invented fact." }],
      gallery: [
        { file: "media/posts/c.jpg", alt: "An invented cover alt text." },
        { file: "media/posts/a.jpg", alt: "The same file as a stored post's photo." },
      ],
    },
    {
      key: "pi-day-again",
      title: "Pi Day Fair!",
      date: "2024-03-14",
      place: "Torino, Italy",
      tags: ["Fair"],
      summary: { text: "Invented." },
      lead: "Invented.",
      body: [{ kind: "paragraph", text: "Invented." }],
      gallery: [{ file: "media/posts/c.jpg", alt: "Invented." }],
    },
    {
      key: "rodeo",
      title: "Example rodeo",
      date: "2024-03-14",
      place: "Torino, Italy",
      tags: ["Rodeo"],
      summary: { text: "Invented." },
      lead: "Invented.",
      body: [{ kind: "paragraph", text: "Invented." }],
      gallery: [{ file: "media/posts/c.jpg", alt: "Invented." }],
    },
  ],
});

/** The migrated posts, with a draft already on Luna e Italia and a gallery photo already on Pi Day Fair. */
async function world(): Promise<void> {
  await restore("outreach-instagram-world", async () => {
    const luna = await postIdOf("Luna e Italia");
    const published = (await versions()).find((v) => v.postId === luna && v.version === "published")!;
    const { id: _id, updatedAt: _updatedAt, ...columns } = published;
    await addRows(outreachPostVersions, [{ ...columns, version: "draft", lead: "A draft the owner is writing." }]);
    await addRows(outreachPostTags, [{ postId: luna, version: "draft", tagName: "Talk", position: 1 }]);
    const piDay = await postIdOf("Pi Day Fair");
    await changeRows(outreachPostVersions, { postId: piDay, version: "published" }, { gallery: { items: [{ src: "/outreach/pi-day-fair.webp", alt: "A gallery photo already there." }] } });
  });
}

const options = (over: Partial<RunOptions> = {}): RunOptions => ({ mode: "dry-run", sourceFile: "source.json", source: SOURCE, ledger: emptyLedger, photos: reader(), db, ...over });

/** A first real run on the world: its ledger, and the photo names it used. */
async function firstRun(): Promise<Ledger> {
  await world();
  let n = 0;
  const { ledger } = await runImport(options({ mode: "import", store: fakeStore(), newName: () => `first-${++n}` }));
  return ledger;
}

test("a source keeps no hashtag, handle, emoji or styled letters, names photos inside the export only, and gives each post its own key", () => {
  assert.equal(captionMarkIn("Raised about €800, see info@example.com."), null);
  assert.equal(captionMarkIn("Thanks to #PRTOutreach"), "a hashtag");
  assert.equal(captionMarkIn("Thanks to @politorocketteam"), "an @handle");
  assert.equal(captionMarkIn("Liftoff 🚀"), "an emoji");
  assert.equal(captionMarkIn("𝑻𝒉𝒆 summit"), "styled Unicode letters");
  const bad = {
    existing: [
      {
        key: "Pi Day",
        title: "Pi Day Fair",
        body: [{ kind: "paragraph", text: "Great day 🚀" }],
        gallery: [{ file: "../outside.jpg", alt: "Thanks @someone" }],
      },
    ],
    added: [{ ...SOURCE.added[0], key: "Pi Day" }],
  };
  assert.throws(
    () => sourceOf(bad),
    (error: unknown) =>
      error instanceof SourceError &&
      /existing\.0\.key: must be lowercase words joined by hyphens/.test(error.message) &&
      /existing\.0\.body\.0\.text: holds an emoji/.test(error.message) &&
      /existing\.0\.gallery\.0\.file: must be a plain path inside the export/.test(error.message) &&
      /existing\.0\.gallery\.0\.alt: holds an @handle/.test(error.message),
  );
  assert.throws(() => sourceOf({ existing: [SOURCE.existing[0]], added: [{ ...SOURCE.added[0], key: "pi-day" }] }), /added\.0\.key: pi-day is an earlier post's key/);
  assert.throws(() => sourceOf({ newTags: ["A tag far longer than the tag list takes"], existing: [], added: [] }), /newTags\.0: must be at most 32 characters/);
  assert.throws(() => sourceOf({ existing: [], added: [{ ...SOURCE.added[0], date: "2024-02-30" }] }), /added\.0\.date: must be a day written YYYY-MM-DD/);
});

test("a dry run lists each post with its length, shows every text in full, skips what it may not write, and writes and uploads nothing", async () => {
  await world();
  const { plan, report } = await runImport(options({ photos: reader({ [UNFIT]: new TextEncoder().encode("not a photo") }), source: { ...SOURCE, added: [{ ...SOURCE.added[0], gallery: [...SOURCE.added[0].gallery, { file: UNFIT, alt: "Invented." }] }, ...SOURCE.added.slice(1)] } }));
  assert.deepEqual(await databaseWrites(), []);
  assert.deepEqual(plan.drafts.map((d) => [d.entry.title, d.replaces]), [["Pi Day Fair", false]]);
  assert.deepEqual(plan.newTags, ["Launch"]);
  const [lastOrder] = (await tableRows(outreachPosts)).map((p) => Number(p.siteOrder)).sort((a, b) => b - a);
  assert.deepEqual(plan.posts.map((p) => [p.entry.title, p.target]), [["Example launch", { kind: "add", siteOrder: lastOrder + 1 }]]);
  assert.deepEqual(
    plan.skipped.map((s) => [s.kind, s.title]),
    [
      ["has-draft", "Luna e Italia"],
      ["no-post", "No such post"],
      ["address-taken", "Pi Day Fair!"],
      ["unknown-tag", "Example rodeo"],
    ],
  );
  assert.match(report, /^Outreach Instagram import \(issue #886\): dry run, nothing written or uploaded$/m);
  assert.match(report, /^Posts: 2; words per post 6 to 17, 12 on average$/m);
  assert.match(report, /^ {2}2023-03-14 {4}17 words {2}2 paragraphs {3}2 photos {2}\[new draft\] Pi Day Fair$/m);
  assert.match(report, /^ {2}2024-02-15 {5}6 words {2}1 paragraphs {3}3 photos {2}\[new post\] Example launch$/m);
  assert.match(report, /^New tags: Launch$/m);
  assert.match(report, /^ {2}"Pi Day Fair" \(post \d+\), dated 2023-03-14: 1 gallery photos kept, 2 added$/m);
  assert.match(report, /^ {6}\[paragraph\] An invented second paragraph, about €800 and nothing else\.$/m);
  assert.match(report, /^ {6}media\/posts\/b\.jpg: An invented second alt text\. \(caption: An invented caption\.\)$/m);
  assert.match(report, /^ {2}"Example launch", 2024-02-15, Torino, Italy; tags: Launch, School; site order \d+$/m);
  assert.match(report, /^ {6}\[highlight FACT\] An invented fact\.$/m);
  assert.match(report, /^ {2}\[has-draft\] "Luna e Italia" \(post \d+\): the post holds a draft this import did not write; writing would overwrite it$/m);
  assert.match(report, /^ {2}\[address-taken\] "Pi Day Fair!" \(\/outreach\/pi-day-fair, held by "Pi Day Fair"\): /m);
  assert.match(report, /^Photo files: 4; would be uploaded: 3$/m);
  assert.match(report, /^ {2}media\/posts\/not-a-photo\.jpg$/m);
});

test("a real run with a photo the store would not take uploads and writes nothing", async () => {
  await world();
  const store = fakeStore();
  const source = { ...SOURCE, existing: [{ ...SOURCE.existing[0], gallery: [{ file: UNFIT, alt: "Invented." }] }] } as Source;
  await assert.rejects(runImport(options({ mode: "import", store, source, photos: reader({ [UNFIT]: new Uint8Array([1, 2, 3]) }) })), /make no photo the store takes, so nothing was uploaded: media\/posts\/not-a-photo\.jpg/);
  assert.deepEqual(store.uploads, []);
  assert.deepEqual(await databaseWrites(), []);
});

test("a first real run adds the tags, drafts and new posts, keeps every stored version as it was, and names each in its ledger", async () => {
  await world();
  const before = await versions();
  const store = fakeStore();
  let n = 0;
  const { written, report, ledger } = await runImport(options({ mode: "import", store, newName: () => `photo-${++n}` }));
  assert.deepEqual(written, { drafts: 1, redrafts: 0, added: 1, tags: 1, uploaded: 3 });
  assert.deepEqual(store.uploads, ["post-photos/photo-1.jpg", "post-photos/photo-2.jpg", "post-photos/photo-3.jpg"]);
  assert.match(report, /^Outreach Instagram import \(issue #886\): real run$/m);

  const after = await versions();
  for (const row of before) assert.deepEqual(after.find((v) => v.id === row.id), row, `version ${row.id} is unchanged`);
  const url = (name: string) => `https://${HOST}/post-photos/${name}.jpg`;

  const piDay = await postIdOf("Pi Day Fair");
  const published = before.find((v) => v.postId === piDay && v.version === "published")!;
  const draft = after.find((v) => v.postId === piDay && v.version === "draft")!;
  assert.deepEqual(
    { ...draft, id: published.id, version: "published", updatedAt: published.updatedAt },
    {
      ...published,
      body: SOURCE.existing[0].body,
      gallery: {
        items: [
          { src: "/outreach/pi-day-fair.webp", alt: "A gallery photo already there." },
          { src: url("photo-1"), alt: "An invented first alt text." },
          { src: url("photo-2"), alt: "An invented second alt text.", caption: "An invented caption." },
        ],
      },
    },
  );
  const tags = (await tableRows(outreachPostTags)).filter((t) => t.postId === piDay);
  assert.deepEqual(tags.filter((t) => t.version === "draft").map((t) => t.tagName), tags.filter((t) => t.version === "published").map((t) => t.tagName));

  const tagList = (await tableRows(outreachTags)).map((t) => [t.name, t.listOrder] as const).sort((a, b) => Number(a[1]) - Number(b[1]));
  assert.deepEqual(tagList.at(-1), ["Launch", tagList.length]);

  const newRows = after.filter((v) => !before.some((b) => b.postId === v.postId));
  assert.equal(newRows.length, 1);
  const [added] = newRows;
  assert.equal(added.version, "draft");
  assert.deepEqual(
    { title: added.title, date: added.date, place: added.place, photos: added.photos, channels: added.channels, gallery: added.gallery },
    {
      title: "Example launch",
      date: "2024-02-15",
      place: "Torino, Italy",
      photos: [{ src: url("photo-3"), alt: "An invented cover alt text." }],
      channels: {},
      gallery: {
        items: [
          { src: url("photo-3"), alt: "An invented cover alt text." },
          { src: url("photo-1"), alt: "The same file as a stored post's photo." },
        ],
      },
    },
  );
  for (const src of [url("photo-1"), url("photo-3")]) assert.ok(publicPathnameOfUrl(src, HOST));
  assert.deepEqual(new Set((await databaseWrites()).map((w) => w.kind)), new Set(["insert"]));

  assert.deepEqual([...ledger.keys()], ["pi-day", "example-launch"]);
  assert.equal(ledger.get("pi-day")?.postId, piDay);
  assert.equal(ledger.get("example-launch")?.postId, added.postId);
  assert.match(ledgerText(ledger), /"key": "example-launch",\n\s+"postId": \d+,\n\s+"fingerprint": "[0-9a-f]{64}"/);
});

test("a run with the ledger replaces the drafts the import wrote and reuses the post it added; any other draft is left alone", async () => {
  const ledger = await firstRun();
  const before = await versions();
  const postsBefore = await tableRows(outreachPosts);
  const changed: Source = {
    ...SOURCE,
    existing: [{ ...SOURCE.existing[0], body: [{ kind: "paragraph", text: "A rewritten invented paragraph." }] }, ...SOURCE.existing.slice(1)],
    added: [{ ...SOURCE.added[0], title: "Example launch, revised" }, ...SOURCE.added.slice(1)],
  };
  const { plan, written, ledger: next } = await runImport(options({ mode: "import", store: fakeStore(), source: changed, ledger, newName: () => crypto.randomUUID() }));
  assert.deepEqual(written, { drafts: 0, redrafts: 2, added: 0, tags: 0, uploaded: 3 });
  assert.deepEqual(plan.newTags, []);
  assert.deepEqual(await tableRows(outreachPosts), postsBefore, "no post is added");

  const after = await versions();
  const piDay = await postIdOf("Pi Day Fair");
  const rewritten = new Set([piDay, ledger.get("example-launch")?.postId]);
  for (const row of before.filter((v) => v.version === "published" || !rewritten.has(v.postId))) {
    assert.deepEqual(after.find((v) => v.id === row.id), row, `version ${row.id} is unchanged`);
  }
  assert.deepEqual(after.find((v) => v.postId === piDay && v.version === "draft")?.body, [{ kind: "paragraph", text: "A rewritten invented paragraph." }]);
  const reused = after.find((v) => v.postId === ledger.get("example-launch")?.postId);
  assert.equal(reused?.title, "Example launch, revised");
  assert.equal(reused?.version, "draft");
  assert.deepEqual(
    (await tableRows(outreachPostTags)).filter((t) => t.postId === reused?.postId).map((t) => [t.version, t.tagName, t.position]),
    [
      ["draft", "Launch", 1],
      ["draft", "School", 2],
    ],
  );
  assert.notEqual(next.get("pi-day")?.fingerprint, ledger.get("pi-day")?.fingerprint);
  assert.deepEqual(after.map((v) => v.id), before.map((v) => v.id), "the drafts are replaced in place: no version row is added");
});

test("a draft edited since the import wrote it is skipped; without its ledger a run adds no second post", async () => {
  const ledger = await firstRun();
  const piDay = await postIdOf("Pi Day Fair");
  const addedId = ledger.get("example-launch")!.postId;
  await changeRows(outreachPostVersions, { postId: piDay, version: "draft" }, { lead: "The owner changed the draft." });
  await changeRows(outreachPostVersions, { postId: addedId, version: "draft" }, { lead: "The owner changed this one too." });
  const edited = await runImport(options({ ledger }));
  assert.deepEqual(edited.plan.drafts, []);
  assert.deepEqual(edited.plan.posts, []);
  assert.deepEqual(
    edited.plan.skipped.map((s) => [s.kind, s.title]).filter(([kind]) => kind === "has-draft" || kind === "changed-since"),
    [
      ["has-draft", "Pi Day Fair"],
      ["has-draft", "Luna e Italia"],
      ["changed-since", "Example launch"],
    ],
  );

  await firstRun();
  const lost = await runImport(options({ ledger: emptyLedger }));
  assert.deepEqual(lost.plan.drafts, []);
  assert.deepEqual(lost.plan.posts, []);
  assert.ok(lost.plan.skipped.some((s) => s.kind === "has-draft" && s.title === "Pi Day Fair"));
  assert.ok(lost.plan.skipped.some((s) => s.kind === "address-taken" && s.title === "Example launch"));
});

test("a run that fails after uploading says nothing was written and how many files it left; one that fails after its commit says it was written", async () => {
  await world();
  const failing = await runImport(options({ mode: "import", store: fakeStore(2) })).then(() => "no failure", (error: unknown) => error);
  assert.ok(failing instanceof FailedAfterUpload);
  assert.equal(failing.uploaded, 1);
  assert.match(
    failureReport(failing),
    /^Outreach Instagram import failed; nothing was written\.\n1 photos were uploaded to the public store first\. No row names them; the daily sweep deletes them after a day\.\n {2}the store is down$/,
  );
  assert.deepEqual(await databaseWrites(), []);

  await world();
  const fail = { name: "writing the ledger", act: () => Promise.reject(new Error("EACCES: permission denied")) };
  const real = await runImport(options({ mode: "import", store: fakeStore() }), [fail]).then(() => "no failure", failureReport);
  assert.match(real, /^Outreach Instagram import was written: its transaction committed\. Then writing the ledger failed\.\n {2}EACCES: permission denied$/);
});
