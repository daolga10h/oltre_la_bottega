// Apre il sito statico in `site/` con Chromium (Playwright, già nel repo) su telefono
// e desktop. Controlla: nessun errore in console, nessuna richiesta fallita, nessuno
// scroll orizzontale, font Inter caricato. Salva gli screenshot in test-results/site-smoke/.
//   node scripts/site-smoke.mjs
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "site");
const outDir = join(fileURLToPath(new URL(".", import.meta.url)), "..", "test-results", "site-smoke");
mkdirSync(outDir, { recursive: true });

const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".svg": "image/svg+xml", ".txt": "text/plain", ".xml": "application/xml",
};

const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  let file = normalize(join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (!existsSync(file) && existsSync(file + ".html")) file += ".html";
  if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end("non trovato"); return; }
  res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const failures = [];
const browser = await chromium.launch();
const viewports = [
  { name: "telefono", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
];

for (const vp of viewports) {
  for (const path of ["/", "/privacy"]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const label = `${vp.name} ${path}`;
    page.on("console", (m) => { if (m.type() === "error") failures.push(`${label}: errore console: ${m.text()}`); });
    page.on("pageerror", (e) => failures.push(`${label}: errore pagina: ${e.message}`));
    page.on("requestfailed", (r) => failures.push(`${label}: richiesta fallita: ${r.url()}`));
    page.on("response", (r) => { if (r.status() >= 400) failures.push(`${label}: HTTP ${r.status()} ${r.url()}`); });

    await page.goto(base + path, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) failures.push(`${label}: scroll orizzontale di ${overflow}px`);
    const font = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Inter" && f.status === "loaded"); });
    if (!font) failures.push(`${label}: font Inter non caricato`);

    const name = `${vp.name}${path === "/" ? "-home" : "-privacy"}.png`;
    await page.screenshot({ path: join(outDir, name), fullPage: true });
    await page.close();
  }
}

await browser.close();
server.close();

if (failures.length) {
  console.error(`✗ ${failures.length} problema/i:`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ Nessun problema. Screenshot in ${outDir}`);
