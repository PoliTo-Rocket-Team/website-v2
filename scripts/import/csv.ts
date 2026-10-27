// Parses a CSV export (issue #677): comma-separated, a field in double quotes
// may hold commas, line breaks and doubled quotes, as the old Supabase project
// exported long text. Returns the records in order, the header first. A record
// that spans lines starts at the line `lines` names, so a report can point at it.

export type CsvRecord = { readonly cells: readonly string[]; /** The file line the record starts on, from 1. */ readonly line: number };

export function parseCsv(text: string): CsvRecord[] {
  const source = text.replace(/^﻿/, "");
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let start = 1;
  let any = false;
  const endField = () => {
    cells.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    if (!(cells.length === 1 && cells[0] === "")) records.push({ cells, line: start });
    cells = [];
    any = false;
  };
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (!any) {
      start = line;
      any = true;
    }
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        if (c === "\n") line++;
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      endField();
    } else if (c === "\r" && source[i + 1] === "\n") {
      continue;
    } else if (c === "\n" || c === "\r") {
      endRecord();
      line++;
    } else {
      field += c;
    }
  }
  if (any) endRecord();
  return records;
}
