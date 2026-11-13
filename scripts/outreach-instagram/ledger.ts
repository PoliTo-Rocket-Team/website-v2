import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { z } from "zod";
import type { OutreachDraft } from "@/lib/outreach-types";
import type { PostKey } from "./source";

// The import's ledger (issue #886): one JSON file the owner keeps outside the
// repo, beside the source. For each source key it names the post a run wrote a
// draft on, and the draft's fingerprint as the run stored it. The next run
// reads it to tell its own drafts from anyone else's:
//
// - a draft whose post and fingerprint the ledger names is one this import
//   wrote and nobody has changed since, so the run updates it;
// - any other draft is someone else's, so the run leaves it alone and lists
//   the post as skipped.
//
// The database holds no mark of which drafts the import wrote, so the ledger
// is the only record of it. A run writes it after its transaction commits.

/** What the ledger knows of one key: the post its draft is on, and that draft's fingerprint. */
export type LedgerEntry = { readonly postId: number; readonly fingerprint: string };

/** Every key a run has written, with what it wrote. */
export type Ledger = ReadonlyMap<PostKey, LedgerEntry>;

export const emptyLedger: Ledger = new Map();

const fileShape = z.strictObject({
  issue: z.literal(886),
  entries: z.array(z.strictObject({ key: z.string().min(1), postId: z.number().int().positive(), fingerprint: z.string().regex(/^[0-9a-f]{64}$/) })),
});

/** `value` with every object's keys in order, so two reads of one content give one text (as lib/content/versioned.ts compares versions). */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    typeof v === "object" && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
  );
}

/** A draft's fingerprint: the same for two reads of one stored draft, different once any field or tag changes. */
export function fingerprintOf(draft: OutreachDraft): string {
  return createHash("sha256").update(canonicalJson(draft)).digest("hex");
}

/** A ledger file that is not one. */
export class LedgerError extends Error {}

/** The ledger in `file`; an empty one when the file does not exist yet. */
export function readLedger(file: string): Ledger {
  if (!existsSync(file)) return emptyLedger;
  let parsed: z.infer<typeof fileShape>;
  try {
    parsed = fileShape.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    throw new LedgerError(`The ledger ${file} is not an import ledger: ${error instanceof Error ? error.message.split("\n", 1)[0] : String(error)}`);
  }
  const ledger = new Map<PostKey, LedgerEntry>();
  for (const { key, postId, fingerprint } of parsed.entries) {
    if (ledger.has(key)) throw new LedgerError(`The ledger ${file} names the key ${key} twice.`);
    ledger.set(key, { postId, fingerprint });
  }
  return ledger;
}

/** The ledger as its file holds it. */
export function ledgerText(ledger: Ledger): string {
  const entries = [...ledger].map(([key, { postId, fingerprint }]) => ({ key, postId, fingerprint }));
  return `${JSON.stringify({ issue: 886, entries }, null, 2)}\n`;
}

/** Writes the ledger whole or not at all: a temporary file beside it, then a rename. */
export function writeLedger(file: string, ledger: Ledger): void {
  const temporary = `${file}.writing`;
  writeFileSync(temporary, ledgerText(ledger));
  renameSync(temporary, file);
}

/** Writes a ledger to a file that must not exist yet: a seeded ledger never replaces one a run wrote. */
export function writeNewLedger(file: string, ledger: Ledger): void {
  try {
    writeFileSync(file, ledgerText(ledger), { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new LedgerError(`The ledger ${file} already exists; seeding writes a new ledger only.`);
    throw error;
  }
}
