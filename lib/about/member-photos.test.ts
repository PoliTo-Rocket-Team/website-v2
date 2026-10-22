import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { memberPhotos, memberPhotoSql } from "./member-photos";

const root = join(__dirname, "..", "..");

test("migration 0041 holds exactly the member photo statement, and every photo it writes is a file of the site", () => {
  const migration = readFileSync(join(root, "drizzle", "0041_current_site_photos.sql"), "utf8");
  assert.ok(migration.trimEnd().endsWith(memberPhotoSql()), "regenerate the migration from memberPhotoSql()");
  assert.ok(memberPhotos.length > 0);
  for (const { photo } of memberPhotos) assert.ok(existsSync(join(root, "public", photo)), `${photo} is in public/`);
});
