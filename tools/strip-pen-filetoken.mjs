#!/usr/bin/env node
// Git's clean filter for *.pen files (.gitattributes, filter=pen-filetoken).
// Pencil writes a random per-file ID into the root object as "fileToken" on
// every save; the secret scan reads it as an API key. This drops that
// top-level key and the comma that joined it, and copies every other byte as
// it came: no JSON parse and re-serialise, so key order and whitespace stay.
// No smudge: the working file keeps its token, the index never gets one.
// Input it cannot read as a JSON object goes out unchanged.
//
// Installed by tools/install-git-hooks.sh. Reads stdin, writes stdout.

const KEY = Buffer.from('"fileToken"');

const isSpace = (b) => b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09;

function skipSpace(buf, i) {
  while (i < buf.length && isSpace(buf[i])) i++;
  return i;
}

// buf[i] is '"'; returns the index just past the closing quote, or -1.
function skipString(buf, i) {
  for (i++; i < buf.length; i++) {
    if (buf[i] === 0x5c) i++;
    else if (buf[i] === 0x22) return i + 1;
  }
  return -1;
}

// Returns the index just past the value starting at buf[i], or -1.
function skipValue(buf, i) {
  const c = buf[i];
  if (c === 0x22) return skipString(buf, i);
  if (c === 0x7b || c === 0x5b) {
    let depth = 0;
    while (i < buf.length) {
      const b = buf[i];
      if (b === 0x22) {
        i = skipString(buf, i);
        if (i < 0) return -1;
        continue;
      }
      if (b === 0x7b || b === 0x5b) depth++;
      else if (b === 0x7d || b === 0x5d) {
        depth--;
        if (depth === 0) return i + 1;
      }
      i++;
    }
    return -1;
  }
  // A number, true, false or null runs to the next delimiter.
  while (i < buf.length && !isSpace(buf[i]) && buf[i] !== 0x2c && buf[i] !== 0x7d && buf[i] !== 0x5d) i++;
  return i;
}

// The byte range [start, end) that removes the first top-level "fileToken"
// member with the comma that joined it, or null when there is none.
function findCut(buf) {
  let i = skipSpace(buf, 0);
  if (buf[i] !== 0x7b) return null;
  i = skipSpace(buf, i + 1);
  if (buf[i] === 0x7d) return null;
  let precedingComma = -1;
  for (;;) {
    if (buf[i] !== 0x22) return null;
    const keyStart = i;
    const keyEnd = skipString(buf, i);
    if (keyEnd < 0) return null;
    i = skipSpace(buf, keyEnd);
    if (buf[i] !== 0x3a) return null;
    i = skipSpace(buf, i + 1);
    const valueEnd = skipValue(buf, i);
    if (valueEnd < 0) return null;
    i = skipSpace(buf, valueEnd);
    const isToken = keyEnd - keyStart === KEY.length && buf.subarray(keyStart, keyEnd).equals(KEY);
    if (buf[i] === 0x2c) {
      const next = skipSpace(buf, i + 1);
      if (isToken) {
        // A member before it: drop its own leading comma. The first member:
        // drop it through the comma and space up to the next key.
        return precedingComma >= 0 ? [precedingComma, valueEnd] : [keyStart, next];
      }
      precedingComma = i;
      i = next;
      continue;
    }
    if (buf[i] === 0x7d) {
      if (isToken) return precedingComma >= 0 ? [precedingComma, valueEnd] : [keyStart, valueEnd];
      return null;
    }
    return null;
  }
}

function stripFileToken(buf) {
  for (let cut = findCut(buf); cut; cut = findCut(buf)) {
    buf = Buffer.concat([buf.subarray(0, cut[0]), buf.subarray(cut[1])]);
  }
  return buf;
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
process.stdout.write(stripFileToken(Buffer.concat(chunks)));
