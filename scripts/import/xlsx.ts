import { inflateRawSync } from "node:zlib";

// Reads every sheet of an .xlsx workbook as text rows (issue #677). An .xlsx
// is a zip of XML parts: this reads the zip's central directory, inflates each
// part, finds each sheet's part through the workbook's relationships, and lays
// every cell at the column its reference names. A number cell reads as its
// stored value, so a date cell reads as Excel's day serial (`excelDay` turns it
// into a day). The repo has a writer (write-excel-file) and no reader; this is
// the reader the import needs, and nothing more.

/** One sheet: its name as the workbook lists it, and its rows; an empty cell reads "". */
export type Sheet = { readonly name: string; readonly rows: readonly (readonly string[])[] };

/** Every part of the zip, by name, as text. */
function zipParts(file: Buffer): Map<string, string> {
  const end = file.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("not an .xlsx file (no zip directory)");
  const count = file.readUInt16LE(end + 10);
  let at = file.readUInt32LE(end + 16);
  const parts = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    const method = file.readUInt16LE(at + 10);
    const size = file.readUInt32LE(at + 20);
    const nameLength = file.readUInt16LE(at + 28);
    const extraLength = file.readUInt16LE(at + 30);
    const commentLength = file.readUInt16LE(at + 32);
    const local = file.readUInt32LE(at + 42);
    const name = file.toString("utf8", at + 46, at + 46 + nameLength);
    const start = local + 30 + file.readUInt16LE(local + 26) + file.readUInt16LE(local + 28);
    const raw = file.subarray(start, start + size);
    parts.set(name, (method === 8 ? inflateRawSync(raw) : raw).toString("utf8"));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return parts;
}

const ENTITIES: Readonly<Record<string, string>> = { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" };

const unescape = (text: string) =>
  text.replace(/&(lt|gt|quot|apos|amp|#[0-9]+|#x[0-9a-fA-F]+);/g, (_, e: string) =>
    e.startsWith("#x") ? String.fromCodePoint(parseInt(e.slice(2), 16)) : e.startsWith("#") ? String.fromCodePoint(Number(e.slice(1))) : ENTITIES[e]!,
  );

/** The text runs inside one XML fragment, joined; phonetic runs are left out. */
const textOf = (xml: string) =>
  [...xml.replace(/<rPh[\s\S]*?<\/rPh>/g, "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join("");

const attribute = (attributes: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1];

/** "C" is column 2. */
function columnOf(ref: string): number {
  return [...ref.replace(/[0-9]/g, "")].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function rowsOf(xml: string, shared: readonly string[]): string[][] {
  const rows: string[][] = [];
  for (const row of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const index = Number(attribute(row[1], "r") ?? rows.length + 1) - 1;
    const cells: string[] = [];
    for (const cell of (row[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attribute(cell[1], "r");
      if (ref === undefined) continue;
      const type = attribute(cell[1], "t");
      const body = cell[2] ?? "";
      const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
      cells[columnOf(ref)] =
        type === "s" ? (shared[Number(value)] ?? "") : type === "inlineStr" ? textOf(body) : type === "b" ? (value === "1" ? "TRUE" : "FALSE") : unescape(value);
    }
    rows[index] = Array.from(cells, (c) => c ?? "");
  }
  return Array.from(rows, (r) => r ?? []);
}

/** Every sheet of the workbook, in the order the workbook lists them. */
export function readWorkbook(file: Buffer): Sheet[] {
  const parts = zipParts(file);
  const workbook = parts.get("xl/workbook.xml");
  if (workbook === undefined) throw new Error("not an .xlsx file (no workbook part)");
  const shared = [...(parts.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const targets = new Map(
    [...(parts.get("xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [attribute(m[1], "Id"), attribute(m[1], "Target")] as const),
  );
  return [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].flatMap((m) => {
    const name = unescape(attribute(m[1], "name") ?? "");
    const target = targets.get(attribute(m[1], "r:id"));
    if (target === undefined) return [];
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    const xml = parts.get(path);
    return xml === undefined ? [] : [{ name, rows: rowsOf(xml, shared) }];
  });
}

/** The day (YYYY-MM-DD) an Excel day serial names, counted from 1899-12-30 as Excel does; null when the text is no serial. */
export function excelDay(text: string): string | null {
  if (!/^\d+(\.\d+)?$/.test(text.trim())) return null;
  const serial = Math.floor(Number(text));
  if (serial < 1) return null;
  return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
}
