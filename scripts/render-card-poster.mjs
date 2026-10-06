// Renders the project card's poster (CAVOUR_CARD_POSTER in
// components/landing/cavour-assets.ts): the card canvas's finished frame as a
// still, so the card shows its rocket before the 3D has loaded.
//
// Usage: node scripts/render-card-poster.mjs
//
// It mounts the real card scene (rocket-card-3d.tsx) alone on a blank page in
// a 480 x 1048 box at 1.5x, the canvas's own top resolution, and saves an
// element screenshot with a transparent background. No server: the page and
// the public/ files are answered from disk.
//
// One page, one capture, then the browser closes. Headless Chrome may draw
// WebGL in software, which is slow and hot, so never put this in a loop.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public/design/cavour/card-poster.png");
const BOX = { width: 480, height: 1048 };
const SCALE = 1.5;
const ORIGIN = "http://poster.local";

// esbuild is not a direct dependency; tsx (one) ships it.
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx"))("esbuild");

const entry = `
import { createRoot } from "react-dom/client";
import RocketCard3D from "./rocket-card-3d";
const frames = (n, cb) => (n === 0 ? cb() : requestAnimationFrame(() => frames(n - 1, cb)));
createRoot(document.getElementById("stage")).render(
  <RocketCard3D
    tuning={false}
    onReadout={() => {}}
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
  if (state !== "ready") throw new Error(`card scene ${state}`);
  await writeFile(out, await page.locator("#stage").screenshot({ omitBackground: true }));
  console.log(`wrote ${path.relative(root, out)}`);
} finally {
  await browser.close();
}
