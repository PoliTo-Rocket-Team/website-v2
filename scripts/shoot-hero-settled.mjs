// Dev-only: screenshot the settled hero rocket plus two fin crops three
// seconds apart, to check surface work against the hover bob.
// Usage: [HERO_URL=http://localhost:3000/?built] node scripts/shoot-hero-settled.mjs <outDir>
import { chromium } from "playwright";

const outDir = process.argv[2] ?? ".";
const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

page.on("console", (m) => {
  if (m.type() === "error" || /shader|GLSL/i.test(m.text())) console.log("[page]", m.text().slice(0, 300));
});

await page.goto(process.env.HERO_URL ?? "http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(16000); // entrance + drive-in fully settled

const fins = { x: 230, y: 250, width: 200, height: 220 };
await page.screenshot({ path: `${outDir}/settled.png` });
await page.screenshot({ path: `${outDir}/fins-a.png`, clip: fins });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${outDir}/fins-b.png`, clip: fins });

await browser.close();
