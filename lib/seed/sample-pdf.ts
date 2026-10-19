// A small, real PDF for the preview seed (issue #406): one A4 page of plain
// text in Helvetica, built in code so the repository holds no binary and every
// build writes the same bytes. The seeded applications' CV and motivation
// letter cards open these on a preview.

/** Text the PDF can draw: plain ASCII, with accents dropped and PDF string escapes applied. */
function pdfText(line: string): string {
  return line
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/[\\()]/g, (c) => `\\${c}`);
}

/** A one-page PDF: the title large, then each line under it. */
export function samplePdf(title: string, lines: readonly string[]): Uint8Array {
  const text = [
    "BT",
    "/F1 20 Tf",
    "72 770 Td",
    `(${pdfText(title)}) Tj`,
    "/F1 12 Tf",
    ...lines.flatMap((line, i) => [i === 0 ? "0 -36 Td" : "0 -18 Td", `(${pdfText(line)}) Tj`]),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  // Every character is ASCII, so a string offset is a byte offset.
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}
