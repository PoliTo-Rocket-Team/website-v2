import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

// Issue #582: the footer opens with one section pad (pt-section,
// components/landing/footer.tsx), and that pad alone is the gap above it. A
// page whose <main> also pads its bottom by the section token doubles the gap,
// so no <main> under app/ or components/ may carry one.

const root = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return files(path);
    return e.name.endsWith(".tsx") ? [path] : [];
  });
}

/** Each <main ...> opening tag in a source file, props across lines included. */
function mainTags(source: string): string[] {
  return source.match(/<main\b(?:=>|[^>])*>/g) ?? [];
}

test("no page's <main> pads its bottom by the section token, so the footer alone sets the gap above it", () => {
  const scanned: string[] = [];
  for (const file of [...files(join(root, "app")), ...files(join(root, "components"))]) {
    const name = relative(root, file);
    for (const tag of mainTags(readFileSync(file, "utf8"))) {
      scanned.push(name);
      assert.doesNotMatch(
        tag,
        /\bp[by]-section\b/,
        `${name}: a <main> with a bottom section pad doubles the gap to the footer; the footer's pt-section sets it`,
      );
    }
  }
  // The scan reaches the pages the issue names, the multi-line /projects tag included.
  for (const page of ["components/projects/list-page.tsx", "components/about/team-page.tsx", "app/partners/page.tsx"]) {
    assert.ok(scanned.includes(page), `${page}: no <main> found; the scan is broken`);
  }
});
