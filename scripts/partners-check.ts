// `pnpm partners:check`: prints every partner text's length against its limit
// in lib/partners.ts. Importing the record already throws while a text is
// over its limit (the same check `next build` runs), so this exits 1 then.
import { PARTNER_TEXT_LIMITS, partners, textLength } from "../lib/partners";

const { oneLiner, about, support } = PARTNER_TEXT_LIMITS;
const nameWidth = Math.max(...partners.map((p) => p.name.length));
const cell = (text: string | undefined) => (text === undefined ? "-" : String(textLength(text))).padStart(8);

console.log(`${"".padEnd(nameWidth)}  ${"oneLiner".padStart(8)}  ${"about".padStart(8)}  ${"support".padStart(8)}`);
console.log(`${"limit".padEnd(nameWidth)}  ${String(oneLiner).padStart(8)}  ${String(about).padStart(8)}  ${String(support).padStart(8)}`);
for (const p of partners) {
  console.log(`${p.name.padEnd(nameWidth)}  ${cell(p.oneLiner)}  ${cell(p.story?.about)}  ${cell(p.story?.support)}`);
}
console.log("\nEvery partner text is within its limit.");
