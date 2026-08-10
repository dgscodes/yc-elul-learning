/* ══════════════════════════════════════════════════════════════
   Renders the day's poster to a PNG, using the real page.

   The point of doing it this way — a browser loading poster.html —
   rather than redrawing the card in something server-side, is that
   there is nothing to keep in sync. This runs card-render.js, the
   same file the website and the print sheet run. Change the card and
   the emailed poster changes with it.

   Usage:  node tools/render-poster.mjs [--day N] [--out dir]
   ══════════════════════════════════════════════════════════════ */
import { chromium } from "playwright";
import { mkdir, writeFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* POSTER_FEED lets a test point this at a fixture instead of the
   live sheet. Unset in normal use. */
const FEED = process.env.POSTER_FEED ||
  "https://script.google.com/macros/s/AKfycbyxLZ54K7FTOmK42yDkjT49EiK2_H1TEAWH12cxN6auvGLDBT_wA8d5lw59XaSyB0sK/exec";
const ELUL_START = new Date(2026, 7, 14);   /* 1 Elul 5786 */
const ELUL_DAYS  = 29;

function arg(name, fallback){
  const i = process.argv.indexOf("--" + name);
  return i > -1 && process.argv[i+1] ? process.argv[i+1] : fallback;
}

function todayElul(){
  const t = new Date(); t.setHours(0,0,0,0);
  const s = new Date(ELUL_START); s.setHours(0,0,0,0);
  const n = Math.round((t - s) / 86400000) + 1;
  return (n >= 1 && n <= ELUL_DAYS) ? n : 0;
}

const outDir = path.resolve(ROOT, arg("out", "daily"));
const day = parseInt(arg("day", String(todayElul())), 10);

if(!(day >= 1 && day <= ELUL_DAYS)){
  console.log("Outside Elul — nothing to render.");
  process.exit(0);
}

/* Fetched here rather than left to the page: the page would be
   making a cross-origin request from a file:// document, which the
   browser blocks. Node has no such rule, so we fetch and hand the
   body to the page instead. */
let feedBody = "";
try {
  const r = await fetch(FEED, { redirect: "follow" });
  if(!r.ok) throw new Error("feed returned " + r.status);
  feedBody = await r.text();
} catch (err) {
  console.error("Could not read the sponsorship feed:", err.message);
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

/* Yesterday's posters must not survive into today — a stale image is
   worse than a missing one, because it looks current. */
if(existsSync(outDir)){
  for(const f of await readdir(outDir)){
    if(f.endsWith(".png")) await unlink(path.join(outDir, f));
  }
}

/* CHROMIUM_PATH is only needed where a browser is already on disk
   under a different name. CI installs its own and ignores this. */
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
page.on("pageerror", e => console.error("page error:", String(e)));
await page.route("**://script.google.com/**", r =>
  r.fulfill({ status: 200, contentType: "text/csv", body: feedBody }));

await page.goto("file://" + path.join(ROOT, "poster.html") + "?day=" + day);
await page.waitForFunction(() => document.fonts && document.fonts.status === "loaded", null, { timeout: 20000 })
  .catch(() => console.warn("Fonts did not report ready; continuing."));
await page.waitForTimeout(1200);

const count = await page.evaluate(() => {
  const label = document.querySelector("#pagerLabel");
  const has = !!document.querySelector("#stage canvas");
  if(!has) return 0;
  const m = label && label.textContent ? /of (\d+)/.exec(label.textContent) : null;
  return m ? parseInt(m[1], 10) : 1;
});

if(!count){
  console.log(`No sponsorship for ${day} Elul — nothing to render.`);
  await browser.close();
  process.exit(0);
}

const written = [];
for(let i = 0; i < count; i++){
  if(i > 0){
    await page.click("#next");
    await page.waitForTimeout(500);
  }
  const canvas = page.locator("#stage canvas").first();
  const name = `elul-${String(day).padStart(2,"0")}-${i+1}.png`;
  const dataUrl = await canvas.evaluate(el => el.toDataURL("image/png"));
  await writeFile(
    path.join(outDir, name),
    Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64")
  );
  written.push(name);
}

/* A stable filename the daily email can rely on without knowing how
   many sedarim were booked. */
await writeFile(
  path.join(outDir, "today.json"),
  JSON.stringify({ day, count: written.length, files: written, rendered: new Date().toISOString() }, null, 2) + "\n"
);

console.log(`${day} Elul — rendered ${written.length}: ${written.join(", ")}`);
await browser.close();
