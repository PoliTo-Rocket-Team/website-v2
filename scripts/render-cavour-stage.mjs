// Renders the /projects/cavour hero still (CAVOUR_STAGE_POSTER in
// components/landing/cavour-assets.ts): the parked rocket, as the panel shows
// it, with a transparent background so the Cavour texture shows through.
//
// Usage: node scripts/render-cavour-stage.mjs
//
// It mounts the stage scene (cavour-stage-3d.tsx) alone on a blank page in
// the panel's desktop box, 1312 x 620, at 1.5x, takes an element screenshot
// and saves it as WebP (quality 90, exact alpha: about 30 KB). No server:
// the page and the public/ files are answered from disk.
//
// One page, one capture, then the browser closes. Headless Chrome may draw
// WebGL in software, which is slow and hot, so never put this in a loop.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public/design/cavour/stage-poster.webp");
const BOX = { width: 1312, height: 620 };
const SCALE = 1.5;
const ORIGIN = "http://poster.local";

// Neither esbuild nor sharp is a direct dependency; tsx ships the one and
// next the other.
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx"))("esbuild");
const sharp = createRequire(require.resolve("next"))("sharp");

const entry = `
import { createRoot } from "react-dom/client";
import CavourStage3D from "./cavour-stage-3d";
const frames = (n, cb) => (n === 0 ? cb() : requestAnimationFrame(() => frames(n - 1, cb)));
createRoot(document.getElementById("stage")).render(
  <CavourStage3D
    onReady={() => frames(2, () => (window.posterState = "ready"))}
    onFailed={() => (window.posterState = "failed")}
  />,
);
`;
const bundle = await esbuild.build({
  stdin: { contents: entry, loader: "tsx", resolveDir: path.join(root, "components/landing") },
  bundle: true,
  format: "esm",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
  write: false,
});
const html = `<!doctype html><html><body style="margin:0">
<div id="stage" style="position:relative;width:${BOX.width}px;height:${BOX.height}px"></div>
<script type="module" src="/bundle.js"></script></body></html>`;

const browser = await chromium.launch({ args: ["--force-color-profile=srgb", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: BOX, deviceScaleFactor: SCALE });
  page.on("pageerror", (e) => console.error("[page]", e.message));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
    if (pathname === "/bundle.js") {
      return route.fulfill({ contentType: "text/javascript", body: bundle.outputFiles[0].text });
    }
    const file = path.join(root, "public", decodeURIComponent(pathname));
    return route.fulfill({ body: await readFile(file) });
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => window.posterState, null, { timeout: 90_000 });
  const state = await page.evaluate(() => window.posterState);
  if (state !== "ready") throw new Error(`stage scene ${state}`);
  const png = await page.locator("#stage").screenshot({ omitBackground: true });
  await writeFile(out, await sharp(png).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer());
  console.log(`wrote ${path.relative(root, out)}`);
} finally {
  await browser.close();
}
