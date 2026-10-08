// `pnpm logos:check`: measures every partner logo in lib/partners.ts and prints
// its luminance, whether it falls under the dark threshold, and whether the
// record's `darkLogo` flag agrees. Exits 1 when a flag disagrees with the
// measurement, so a new partner is flagged the same way every time.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DARK_LOGO_THRESHOLD, measureLogo } from "../lib/logo-luminance";
import { partners } from "../lib/partners";

const publicDir = join(__dirname, "..", "public");

console.log(`Dark threshold: luminance under ${DARK_LOGO_THRESHOLD.toFixed(4)} (3:1 contrast against the page ground)\n`);

let mismatches = 0;
const nameWidth = Math.max(...partners.map((p) => p.name.length));
for (const partner of partners) {
  const { luminance, dark } = measureLogo(readFileSync(join(publicDir, partner.logo.src)));
  const agrees = dark === partner.logo.darkLogo;
  if (!agrees) mismatches++;
  const verdict = dark ? "DARK" : "ok  ";
  const flag = agrees ? "" : `  set darkLogo: ${dark} (record says ${partner.logo.darkLogo})`;
  console.log(`${partner.name.padEnd(nameWidth)}  ${luminance.toFixed(4)}  ${verdict}${flag}`);
}

if (mismatches > 0) {
  console.error(`\n${mismatches} logo(s) carry a darkLogo flag the measurement disagrees with. Fix them in lib/partners.ts.`);
  process.exit(1);
}
console.log("\nEvery darkLogo flag matches its measurement.");
