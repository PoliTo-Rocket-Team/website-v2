import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { memoryContentStore } from "@/lib/content/memory";
import { publicItems, statusOf, type ContentItem } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import type { Upload } from "@/lib/dashboard/write";
import { partnerEditor, type LogoFiles } from "./partners-editor";
import { fieldsOf, partnerFieldErrors, type PartnerFields } from "./partners-fields";
import { importedPartners, partnerImportSql } from "./partners-import";
import { partnerColumns, partnerFromColumns } from "./partners-rows";
import { logoKindOf, partners as record, type Partner } from "./partners";

// The Partners page's rules (issue #256) over an in-memory store: the same
// editor both sides of the dashboard data interface build.

const admin: ViewerStanding = { kind: "operations-lead", seat: "operations-lead", siteContent: false };

/** Logo files kept in a list, so a test can see what was stored. */
function files(): LogoFiles & { stored: Upload[] } {
  const stored: Upload[] = [];
  return { stored, put: async (logo) => (stored.push(logo), `https://blob.example/logos/${stored.length}.png`) };
}

function editorOver(items: ContentItem<Partner>[] = importedPartners(), viewer: ViewerStanding = admin) {
  const store = memoryContentStore(items);
  const logos = files();
  return { store, logos, editor: partnerEditor(viewer, store, logos) };
}

const names = (list: readonly Partner[]) => list.map((p) => p.name);

/** An 8-bit RGBA PNG of `width` x `height` in one colour. */
function png(width: number, height: number, [r, g, b]: readonly [number, number, number]): Upload {
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "latin1");
    return Buffer.concat([head, body, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b, 255]).flat())]);
  const bytes = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return { name: "logo.png", contentType: "image/png", bytes: new Uint8Array(bytes) };
}

const evomisure = 3;

test("the import carries every partner of the record, in its order, with its tier, texts and logo", () => {
  const items = importedPartners();
  assert.deepEqual(publicItems(items), record, "the public pages read the record back unchanged");
  assert.deepEqual(items.map((i) => i.siteOrder), record.map((_, i) => i + 1));
  for (const item of items) assert.equal(statusOf(item.version), "published");
  // Every column reads back as it was written.
  for (const partner of record) assert.deepEqual(partnerFromColumns(partnerColumns(partner)), partner);
});

test("migration 0020 holds exactly the import's SQL", () => {
  const migration = readFileSync(join(__dirname, "..", "drizzle", "0020_partners_audit_and_import.sql"), "utf8");
  assert.ok(migration.trimEnd().endsWith(partnerImportSql()), "regenerate the migration's import from partnerImportSql()");
  assert.equal(partnerImportSql().split("--> statement-breakpoint").length, record.length);
});

test("Save draft on a published partner leaves the public pages on the published version until Publish", async () => {
  const { store, editor } = editorOver();
  const published = record[evomisure - 1];
  const fields: PartnerFields = { ...fieldsOf(published), oneLiner: "A new line." };

  const draft = await editor.save(evomisure, "save-draft", fields, null);
  assert.ok(draft.ok);
  assert.equal(statusOf(draft.value.version), "draft-changes");
  assert.equal(publicItems(await store.list())[evomisure - 1].oneLiner, published.oneLiner);

  const live = await editor.save(evomisure, "publish", fields, null);
  assert.ok(live.ok);
  assert.equal(publicItems(await store.list())[evomisure - 1].oneLiner, "A new line.");
});

test("/partners and the home strip show only published partners: a new partner saved as a draft stays off them", async () => {
  const { store, editor } = editorOver();
  const fields: PartnerFields = { name: "Newco", tier: "main", website: "", oneLiner: "Parts.", about: "", support: "" };
  const created = await editor.save(null, "save-draft", fields, png(400, 100, [250, 250, 250]));
  assert.ok(created.ok);
  assert.ok(!names(publicItems(await store.list())).includes("Newco"));
  assert.ok((await editor.save(created.value.id, "publish", fields, null)).ok);
  assert.equal(names(publicItems(await store.list())).at(-1), "Newco", "a new partner goes last");
});

test("a new partner needs a logo; an edit keeps its logo unless one is sent", async () => {
  const { store, editor } = editorOver();
  const fields: PartnerFields = { name: "Newco", tier: "media", website: "", oneLiner: "Parts.", about: "", support: "" };
  assert.deepEqual(await editor.save(null, "publish", fields, null), { ok: false, error: "Add the partner's logo." });
  assert.ok((await editor.save(1, "publish", fieldsOf(record[0]), null)).ok);
  assert.deepEqual(publicItems(await store.list())[0].logo, record[0].logo);
});

test("the panel's limits are the record's, counted in code points, and the server refuses a text over its limit", async () => {
  const { editor } = editorOver();
  const base = fieldsOf(record[0]);
  // "ò" is one character: 80 of them fit the one-liner.
  assert.deepEqual(partnerFieldErrors({ ...base, oneLiner: "ò".repeat(80) }), {});
  assert.ok(partnerFieldErrors({ ...base, oneLiner: "x".repeat(81) }).oneLiner);
  assert.ok(partnerFieldErrors({ ...base, about: "x".repeat(221) }).about);
  assert.ok(partnerFieldErrors({ ...base, support: "x".repeat(161) }).support);
  assert.deepEqual(partnerFieldErrors({ ...base, about: "x".repeat(220), support: "x".repeat(160) }), {});

  const over = await editor.save(1, "publish", { ...base, about: "x".repeat(221) }, null);
  assert.equal(over.ok, false);
  assert.equal((await editor.save(1, "publish", { ...base, website: "sophia.com" }, null)).ok, false, "a website is a full address");
  assert.equal((await editor.save(1, "publish", { ...base, tier: "gold" }, null)).ok, false);
});

test("an uploaded logo is measured: a dark one is saved with the dark flag, a light one without", async () => {
  const { store, editor, logos } = editorOver();
  const fields = fieldsOf(record[0]);

  const dark = await editor.save(1, "publish", fields, png(300, 100, [20, 20, 30]));
  assert.ok(dark.ok);
  const darkLogo = publicItems(await store.list())[0].logo;
  assert.deepEqual(darkLogo, { src: "https://blob.example/logos/1.png", width: 300, height: 100, kind: "wordmark", darkLogo: true });

  assert.ok((await editor.save(1, "publish", fields, png(100, 100, [240, 120, 20]))).ok);
  assert.equal(publicItems(await store.list())[0].logo.darkLogo, false);
  assert.equal(publicItems(await store.list())[0].logo.kind, "mark");
  assert.equal(logos.stored.length, 2);

  const measured = await editor.measure(png(300, 100, [20, 20, 30]));
  assert.deepEqual(measured, { ok: true, value: { width: 300, height: 100, kind: "wordmark", darkLogo: true } });
  assert.equal((await editor.measure({ ...png(10, 10, [0, 0, 0]), contentType: "image/jpeg" })).ok, false);
  assert.equal((await editor.save(1, "publish", fields, { name: "x.png", contentType: "image/png", bytes: new Uint8Array([1, 2, 3]) })).ok, false);
  assert.equal(logos.stored.length, 2, "a logo that cannot be measured is not stored");
});

test("every logo in the record has the kind its shape gives", () => {
  for (const partner of record) assert.equal(logoKindOf(partner.logo.width, partner.logo.height), partner.logo.kind, partner.name);
});

test("dragging a tier's rows sets its site order, the public pages follow it, and the other tier stays put", async () => {
  const { store, editor } = editorOver();
  const main = record.filter((p) => p.tier === "main").map((_, i) => i + 1);
  const reversed = [...main].reverse();
  assert.ok((await editor.reorder("main", reversed)).ok);
  const shown = names(publicItems(await store.list()));
  assert.deepEqual(shown, [...reversed.map((id) => record[id - 1].name), "JEToP"]);
  assert.equal((await editor.reorder("media", reversed)).ok, false, "ids from another tier are refused");
});

test("only full access and site-content access reach the partners and their writes", async () => {
  const refusedFor: readonly ViewerStanding[] = [
    { kind: "department-head", siteContent: false },
    { kind: "division-lead", siteContent: false },
    { kind: "member", siteContent: false },
    { kind: "non-member", siteContent: false },
  ];
  for (const viewer of refusedFor) {
    const { store, editor, logos } = editorOver(importedPartners(), viewer);
    assert.equal(await editor.list(), null);
    assert.equal((await editor.save(1, "publish", fieldsOf(record[0]), png(10, 10, [0, 0, 0]))).ok, false);
    assert.equal((await editor.measure(png(10, 10, [0, 0, 0]))).ok, false);
    assert.equal((await editor.remove(1)).ok, false);
    assert.equal((await editor.reorder("main", [1])).ok, false);
    assert.equal(logos.stored.length, 0);
    assert.deepEqual(publicItems(await store.list()), record);
  }
  const member: ViewerStanding = { kind: "member", siteContent: true };
  assert.ok((await editorOver(importedPartners(), member).editor.list()) !== null);
});
