import assert from "node:assert/strict";
import { test } from "node:test";
import { isPdfBytes } from "@/lib/apply/application-form";
import { samplePdf } from "./sample-pdf";

// The preview seed's PDFs (issue #406) must open in a browser's viewer: the
// cross-reference table has to point at each object's first byte.

test("a sample PDF is a PDF whose cross-reference table points at every object", () => {
  const bytes = samplePdf("Curriculum vitae", ["Application 21, for Test Engineer (Test Bench).", "Nicolò, preview data only."]);
  assert.equal(isPdfBytes(bytes), true);
  const text = new TextDecoder().decode(bytes);
  const startxref = Number(/startxref\n([0-9]+)\n%%EOF\n$/.exec(text)?.[1]);
  assert.equal(text.slice(startxref, startxref + 5), "xref\n");
  const offsets = [...text.slice(startxref).matchAll(/^([0-9]{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.equal(offsets.length, 5);
  offsets.forEach((offset, i) => assert.ok(text.startsWith(`${i + 1} 0 obj\n`, offset), `object ${i + 1}`));
  const length = Number(/\/Length ([0-9]+) >>\nstream\n/.exec(text)?.[1]);
  const stream = /stream\n([\s\S]*?)\nendstream/.exec(text)?.[1] ?? "";
  assert.equal(stream.length, length);
  assert.match(stream, /\(Application 21, for Test Engineer \\\(Test Bench\\\)\.\) Tj/);
  assert.match(stream, /\(Nicolo, preview data only\.\) Tj/);
});
