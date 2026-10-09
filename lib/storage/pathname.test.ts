import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parsePrivatePathname, parsePublicPathname, privatePathname, publicPathname } from "./pathname";

describe("file pathnames", () => {
  test("each kind of file goes to its own folder", () => {
    assert.equal(privatePathname("application", "a1b2.pdf"), "applications/a1b2.pdf");
    assert.equal(privatePathname("order", "po-17.pdf"), "orders/po-17.pdf");
    assert.equal(publicPathname("photo", "giulia.webp"), "photos/giulia.webp");
  });

  test("a new file's name cannot name a folder or climb out of one", () => {
    for (const name of ["", "../x.pdf", "a/b.pdf", ".hidden", "a b.pdf"]) {
      assert.throws(() => privatePathname("application", name));
      assert.throws(() => publicPathname("photo", name));
    }
  });

  test("a stored pathname is read back only inside its own store's folders", () => {
    assert.equal(parsePrivatePathname("applications/chiara_cv_hash123.pdf"), "applications/chiara_cv_hash123.pdf");
    assert.equal(parsePrivatePathname("orders/2026/po 17.pdf"), "orders/2026/po 17.pdf");
    assert.equal(parsePrivatePathname("photos/giulia.webp"), null);
    assert.equal(parsePublicPathname("applications/a.pdf"), null);
    assert.equal(parsePublicPathname("photos/giulia.webp"), "photos/giulia.webp");
  });

  test("a stored pathname that climbs out of its folder is refused", () => {
    for (const stored of ["applications/", "applications/../orders/x.pdf", "applications//x.pdf", "/applications/x.pdf"]) {
      assert.equal(parsePrivatePathname(stored), null);
    }
  });
});
