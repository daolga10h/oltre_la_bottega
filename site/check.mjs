// Controllo statico del sito vetrina. Nessuna dipendenza.
//   node site/check.mjs            controlli di struttura (link, alt, meta, segnaposto)
//   node site/check.mjs --release  in più: contatti e dati legali devono essere compilati
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const release = process.argv.includes("--release");
const failures = [];
const ok = (cond, msg) => {
  if (!cond) failures.push(msg);
};
const read = (rel) => {
  const p = join(root, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
};

// --- config.js ---
const configSrc = read("config.js");
ok(configSrc !== null, "manca site/config.js");
const sandbox = {};
if (configSrc !== null) new Function("window", configSrc)(sandbox);
const cfg = sandbox.SITE || {};

// --- pagine ---
for (const page of ["index.html", "privacy.html"]) {
  const html = read(page);
  if (html === null) {
    failures.push(`manca site/${page}`);
    continue;
  }

  // riferimenti locali (src/href) devono esistere
  for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    const ref = m[1];
    if (/^(https?:|\/\/|#|mailto:|tel:|data:|javascript:)/.test(ref)) continue;
    const clean = ref.split("#")[0].split("?")[0];
    const rel = clean === "/" || clean === "" ? "index.html" : clean.replace(/^\//, "");
    const found = existsSync(join(root, rel)) || existsSync(join(root, rel + ".html"));
    ok(found, `${page}: riferimento inesistente "${ref}"`);
  }

  // immagine social
  for (const m of html.matchAll(/property="og:image" content="https:\/\/oltrelabottega\.it\/([^"]+)"/g)) {
    ok(existsSync(join(root, m[1])), `${page}: og:image inesistente "${m[1]}"`);
  }

  // ogni <img> ha l'attributo alt
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    ok(/\balt="/.test(m[0]), `${page}: <img> senza alt: ${m[0].slice(0, 60)}`);
  }

  // meta base
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  ok(title.length >= 10 && title.length <= 60, `${page}: <title> assente o fuori 10-60 caratteri (${title.length})`);
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  ok(desc.length >= 50 && desc.length <= 170, `${page}: description assente o fuori 50-170 caratteri (${desc.length})`);

  // un solo h1
  ok((html.match(/<h1[\s>]/g) || []).length === 1, `${page}: deve esserci un solo <h1>`);

  // niente segnaposto rimasti
  ok(!/lorem|\bTODO\b|\[Nome/i.test(html), `${page}: segnaposto rimasto (lorem/TODO/[Nome)`);

  // niente stili o script inline (la CSP di site/vercel.json li bloccherebbe)
  ok(!/\sstyle="/.test(html), `${page}: style="" inline non ammesso`);
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), `${page}: <script> inline non ammesso`);

  // ogni data-site usato esiste in config.js
  for (const m of html.matchAll(/data-site="([^"]+)"/g)) {
    ok(m[1] in cfg, `${page}: data-site="${m[1]}" non definito in config.js`);
  }
}

// --- controlli di pubblicazione ---
if (release) {
  ok(/^\d{10,15}$/.test(cfg.whatsapp || ""), 'config.js: "whatsapp" deve essere solo cifre con prefisso (es. 393331234567)');
  ok(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cfg.email || ""), 'config.js: "email" mancante o non valida');
  ok((cfg.datiLegali || "").trim().length > 0, 'config.js: "datiLegali" vuoto');
  ok((cfg.episodio || "").trim().length > 0, 'config.js: "episodio" vuoto');
  ok((cfg.nomeNegozio || "").trim().length > 0, 'config.js: "nomeNegozio" vuoto');
}

if (failures.length) {
  console.error(`✗ ${failures.length} problema/i:`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ Sito OK${release ? " (controlli di pubblicazione inclusi)" : ""}`);
