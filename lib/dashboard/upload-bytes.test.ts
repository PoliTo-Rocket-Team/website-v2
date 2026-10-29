import assert from "node:assert/strict";
import { test } from "node:test";
import { checkedMemberPhoto, checkedPhoto, checkedQuote } from "./upload-bytes";

// A dashboard upload is what its bytes are, whatever type the browser
// declared (issue #831).

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const PDF = new Uint8Array(Buffer.from("%PDF-1.7"));
const HTML = new TextEncoder().encode("<html><script>");
const upload = (bytes: Uint8Array, contentType: string, name = "file") => ({ name, contentType, bytes });

test("a profile or Alumni photo is a JPEG or PNG by its bytes, and the store is told the type the bytes show", () => {
  assert.deepEqual(checkedPhoto(upload(PNG, "image/jpeg")), { ok: true, value: { bytes: PNG, contentType: "image/png", extension: "png" } });
  assert.deepEqual(checkedPhoto(upload(JPEG, "image/png")), { ok: true, value: { bytes: JPEG, contentType: "image/jpeg", extension: "jpg" } });
  assert.deepEqual(checkedPhoto(upload(HTML, "image/png")), { ok: false, error: "The photo must be a JPEG or PNG." });
  const big = new Uint8Array(2 * 1024 * 1024 + 1);
  big.set(JPEG);
  assert.deepEqual(checkedPhoto(upload(big, "image/jpeg")), { ok: false, error: "The photo must be 2 MB or less." });
});

test("a member photo from Edit details is a JPEG by its bytes", () => {
  assert.ok(checkedMemberPhoto(upload(JPEG, "application/octet-stream")).ok);
  assert.deepEqual(checkedMemberPhoto(upload(PNG, "image/jpeg")), { ok: false, error: "The photo must be a JPEG." });
  assert.deepEqual(checkedMemberPhoto(upload(HTML, "image/jpeg")), { ok: false, error: "The photo must be a JPEG." });
});

test("a quote is a PDF by its bytes, whatever its name or declared type", () => {
  assert.ok(checkedQuote(upload(PDF, "application/octet-stream", "quote.bin")).ok);
  assert.deepEqual(checkedQuote(upload(HTML, "application/pdf", "quote.pdf")), { ok: false, error: "The quote must be a PDF." });
});
