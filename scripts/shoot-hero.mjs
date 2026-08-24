// Dev-only: screenshot the hero choreography (decision 0004) for review.
// Usage: node scripts/shoot-hero.mjs <outDir>
import { chromium } from "playwright";

const outDir = process.argv[2] ?? ".";
const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

page.on("console", (m) => {
  if (m.type() === "error") console.log("[page error]", m.text());
});

await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });

const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png` });

await page.waitForTimeout(1200);
await shot("1-gathered"); // words in, block still together
await page.waitForTimeout(2800);
await shot("2-separating"); // block splitting, rocket driving in
await page.waitForTimeout(6500);
await shot("3-settled"); // final 04 layout

// Lift-off: cross the threshold once
await page.evaluate(() => window.scrollTo({ top: 300, behavior: "instant" }));
await page.waitForTimeout(900);
await shot("4-liftoff"); // rocket accelerating out
await page.waitForTimeout(1500);

// Replay: return to the top
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await page.waitForTimeout(600);
await shot("5-replay"); // gathered block again

await browser.close();
