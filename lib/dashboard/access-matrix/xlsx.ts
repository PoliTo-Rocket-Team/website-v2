import { inflateRawSync } from "node:zlib";

// Reads back the first sheet of an .xlsx file as text rows, so the matrix
// suite checks what the Members export (issue #539) actually wrote. An .xlsx
// is a zip of XML parts: this reads the zip's central directory, inflates each
// part, and lays every cell at the column its reference names.

/** Every part of the zip, by name, as text. */
function zipParts(file: Buffer): Map<string, string> {
  const end = file.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("not a zip file");
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

const unescape = (text: string) =>
  text.replace(/&(lt|gt|quot|apos|amp);/g, (_, e: string) => ({ lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" })[e]!);

/** The text runs inside one XML fragment, joined. */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join("");

/** "C" is column 2. */
function columnOf(ref: string): number {
  return [...ref.replace(/[0-9]/g, "")].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

/** The first sheet's rows; an empty cell reads "". */
export function readSheet(file: Buffer): string[][] {
  const parts = zipParts(file);
  const shared = [...(parts.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const sheet = parts.get("xl/worksheets/sheet1.xml");
  if (sheet === undefined) throw new Error("no first sheet");
  return [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) => {
    const cells: string[] = [];
    for (const cell of row[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cell[1];
      const body = cell[2] ?? "";
      const ref = /r="([A-Z]+[0-9]+)"/.exec(attributes)?.[1];
      if (ref === undefined) continue;
      const type = /t="([^"]+)"/.exec(attributes)?.[1];
      const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
      cells[columnOf(ref)] = type === "s" ? (shared[Number(value)] ?? "") : type === "inlineStr" ? textOf(body) : unescape(value);
    }
    return Array.from(cells, (c) => c ?? "");
  });
}
