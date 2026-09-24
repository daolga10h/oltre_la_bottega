# Sito vetrina Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire il sito vetrina statico di Oltre la Bottega (una pagina lunga + pagina privacy) in `site/`, pronto per essere pubblicato come secondo progetto Vercel su `oltrelabottega.it`.

**Architecture:** Cartella `site/` autonoma dentro il repo, senza build né dipendenze: `index.html`, `privacy.html`, `style.css`, `config.js` (nome del negozio, contatti e dati legali in un unico punto), `main.js` (legge `config.js` e riempie testi e link). Un controllo `site/check.mjs` (Node, senza dipendenze) verifica link, immagini, meta tag e, in modalità `--release`, che nessun dato di contatto/legale sia rimasto vuoto. Lo script `scripts/site-smoke.mjs` apre il sito con Playwright (già presente per gli E2E) su telefono e desktop.

**Tech Stack:** HTML5, CSS3, JavaScript minimo (ES5 in `main.js`), Inter self-hosted (woff2), Node per i controlli, Playwright (già nel repo) per la verifica, Vercel per l'hosting.

**Spec:** `docs/superpowers/specs/2026-09-24-sito-vetrina-design.md`. Campioni visivi approvati (direzione C): https://claude.ai/artifact/5XouK82MET9DRVFhwJSH7N

**Regole per chi implementa:**
- Ogni messaggio di commit termina con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (passalo come secondo `-m`). Non scrivere il nome del tuo modello.
- Nessun dato inventato: niente testimonianze, cifre o statistiche. Le schermate dell'app sono riproduzioni con nomi inventati e la didascalia "Schermata di esempio".
- Nessun `style="..."` e nessuno `<script>` inline nell'HTML: la Content-Security-Policy del Task 4 li bloccherebbe.
- Non modificare nulla in `src/`. Questo lavoro non tocca l'app.
- Il nome del negozio è in **rebranding**: compare solo in `site/config.js` (fonte) e come testo di partenza negli elementi con `data-site="nomeNegozio"`. Non scriverlo altrove a mano, tranne nei meta tag (Task 4, con nota).

---

## Struttura dei file

| File | Responsabilità |
|---|---|
| `site/index.html` | Pagina unica: barra, hero, storia, app, come si parte, dubbi frequenti, contatti, piè di pagina |
| `site/privacy.html` | Informativa privacy breve |
| `site/style.css` | Tutti gli stili (token dell'app, hero, sezioni, riproduzioni delle schermate) |
| `site/config.js` | Unico punto da modificare: nome negozio, firma, WhatsApp, email, dati legali, episodio |
| `site/main.js` | Riempie `data-site`, costruisce i link `wa.me`/`mailto`, anno nel piè di pagina |
| `site/check.mjs` | Controllo statico (link, alt, meta, segnaposto, modalità `--release`) |
| `site/vercel.json` | Header di sicurezza e cache |
| `site/robots.txt`, `site/sitemap.xml` | Indicizzazione |
| `site/fonts/inter-latin.woff2` | Inter self-hosted |
| `site/img/*`, `site/favicon.png`, `site/apple-touch-icon.png`, `site/og.png` | Immagini |
| `scripts/site-smoke.mjs` | Verifica con Playwright: nessun errore, nessuno scroll orizzontale, screenshot |
| `eslint.config.mjs` | Modificato: ignora `site/**` |
| `CLAUDE.md` | Modificato a fine lavoro: decisione e struttura |

---

### Task 1: Branch, scheletro e controllo che fallisce

**Files:**
- Create: `site/check.mjs`
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Crea il branch**

```bash
git checkout -b feature/sito-vetrina
```

Expected: `Switched to a new branch 'feature/sito-vetrina'`

- [ ] **Step 2: Scrivi il controllo `site/check.mjs`**

```js
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
```

- [ ] **Step 3: Escludi `site/**` da ESLint**

In `eslint.config.mjs`, dentro `globalIgnores([...])` aggiungi in fondo alla lista (dopo `".claude/worktrees/**",`):

```js
    // Sito vetrina statico (HTML/CSS/JS senza build): non fa parte dell'app Next.
    "site/**",
```

- [ ] **Step 4: Esegui il controllo e verifica che fallisca**

Run: `node site/check.mjs`
Expected: exit code 1, output che contiene `manca site/config.js`, `manca site/index.html`, `manca site/privacy.html`.

- [ ] **Step 5: Commit**

```bash
git add site/check.mjs eslint.config.mjs
git commit -m "chore(sito): scheletro e controllo statico del sito vetrina" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Asset, configurazione e stili

**Files:**
- Create: `site/fonts/inter-latin.woff2`, `site/img/logo.png`, `site/favicon.png`, `site/apple-touch-icon.png`, `site/config.js`, `site/main.js`, `site/style.css`

- [ ] **Step 1: Font e immagini di base**

```bash
mkdir -p site/fonts site/img
curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36" "https://fonts.googleapis.com/css2?family=Inter:wght@400..800&display=swap" | grep -A6 "/\* latin \*/" | grep -o "https://[^)]*\.woff2" > /tmp/inter-url.txt
curl -s -o site/fonts/inter-latin.woff2 "$(cat /tmp/inter-url.txt)"
cp public/logo-oltre-la-bottega.png site/img/logo.png
cp public/icon-192.png site/favicon.png
cp src/app/apple-icon.png site/apple-touch-icon.png
ls -l site/fonts site/img site/favicon.png site/apple-touch-icon.png
```

Expected: `inter-latin.woff2` di alcune decine di KB (non 0 byte, non una pagina HTML di errore). Se pesa meno di 10 KB, ripeti il download.

- [ ] **Step 2: Scrivi `site/config.js`**

```js
// UNICO punto da modificare per nome del negozio, contatti e dati legali.
// I meta tag in <head> (title, description, og:*) non leggono questo file:
// se cambia il nome del negozio, aggiornali a mano in index.html e privacy.html.
window.SITE = {
  // Nome e descrizione del negozio (rebranding in corso: cambiare solo qui)
  nomeNegozio: "Centro Laser Viterbese",
  descrizioneNegozio: "articoli personalizzati con incisione, targhe e timbri",

  // Firma della sezione "storia"
  firmaNome: "Olga",
  firmaRuolo: "titolare",

  // Contatti. whatsapp: solo cifre con prefisso internazionale, es. 393331234567
  whatsapp: "",
  email: "",
  messaggioWhatsapp: "Buongiorno, vorrei una dimostrazione di Oltre la Bottega.",
  oggettoEmail: "Richiesta dimostrazione Oltre la Bottega",

  // Piè di pagina e privacy: ragione sociale, P.IVA, sede, PEC (una riga)
  datiLegali: "",

  // Episodio che ha fatto nascere l'idea, due righe con le parole di Olga.
  // Finché è vuoto la frase non compare nella pagina.
  episodio: ""
};
```

- [ ] **Step 3: Scrivi `site/main.js`**

```js
// Riempie testi e link a partire da config.js. Senza JS la pagina resta leggibile
// con i testi di partenza; i contatti però richiedono JS.
(function () {
  var cfg = window.SITE || {};

  var nodes = document.querySelectorAll("[data-site]");
  for (var i = 0; i < nodes.length; i++) {
    var value = cfg[nodes[i].getAttribute("data-site")];
    if (typeof value === "string" && value.replace(/\s/g, "") !== "") {
      nodes[i].textContent = value;
      nodes[i].removeAttribute("hidden");
    }
  }

  var wa = cfg.whatsapp
    ? "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(cfg.messaggioWhatsapp || "")
    : "";
  var mail = cfg.email
    ? "mailto:" + cfg.email + "?subject=" + encodeURIComponent(cfg.oggettoEmail || "")
    : "";

  function setLinks(kind, href, external) {
    var links = document.querySelectorAll('[data-contact="' + kind + '"]');
    for (var j = 0; j < links.length; j++) {
      if (!href) {
        if (kind !== "primary") links[j].hidden = true;
        continue;
      }
      links[j].href = href;
      links[j].hidden = false;
      if (external) {
        links[j].target = "_blank";
        links[j].rel = "noopener noreferrer";
      }
    }
  }
  setLinks("primary", wa || mail, !!wa);
  setLinks("whatsapp", wa, true);
  setLinks("email", mail, false);

  var years = document.querySelectorAll("[data-year]");
  for (var k = 0; k < years.length; k++) {
    years[k].textContent = String(new Date().getFullYear());
  }
})();
```

- [ ] **Step 4: Scrivi `site/style.css`**

```css
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 400 800;
  font-display: swap;
  src: url("fonts/inter-latin.woff2") format("woff2");
}

:root {
  --cream: #f8f7f5;
  --paper: #ffffff;
  --linen: #e3dfd5;
  --stone: #d5d2cd;
  --ash: #aca89f;
  --drift: #8f897e;
  --bark: #61594a;
  --esp: #3b2716;
  --amber: #f9a600;
  --gold: #e89b01;
  --terra: #f0624f;
  --sage: #c8dab8;
  --sagetx: #3a5a2e;
  --honey: #f8da9d;
  --shadow: 0 4px 8px rgba(59, 39, 22, 0.06);
}

* { box-sizing: border-box; }
html { background: var(--cream); color: var(--esp); scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--cream);
  color: var(--esp);
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.55;
  letter-spacing: -0.01em;
}
img, svg { max-width: 100%; }
a { color: inherit; }
h1, h2, h3 { margin: 0; letter-spacing: -0.03em; text-wrap: balance; }
p { margin: 0; }
:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
.skip { position: absolute; left: -999px; top: 8px; background: var(--esp); color: var(--cream); padding: 8px 12px; border-radius: 8px; z-index: 50; }
.skip:focus { left: 8px; }
.wrap { max-width: 1080px; margin: 0 auto; padding-inline: 20px; }
[hidden] { display: none !important; }

/* barra */
.nav { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-block: 16px; }
.brand img { height: 26px; width: auto; display: block; }
.cta-s { font-size: 14px; font-weight: 600; text-decoration: none; padding: 9px 16px; border-radius: 8px; border: 1px solid var(--esp); }

/* bottoni */
.btn { display: inline-block; font-weight: 600; text-decoration: none; padding: 14px 22px; border-radius: 8px; font-size: 16px; }
.btn-esp { background: var(--esp); color: var(--cream); box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.18), 0 2px 6px rgba(59, 39, 22, 0.32); }
.btn-amber { background: var(--amber); color: var(--esp); box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3), 0 2px 6px rgba(59, 39, 22, 0.28); }
.btn-line { background: var(--paper); color: var(--esp); border: 1px solid var(--stone); }
.btns { display: flex; flex-wrap: wrap; gap: 12px; }
@media (prefers-reduced-motion: no-preference) {
  .btn { transition: transform 0.12s ease; }
  .btn:hover { transform: translateY(-1px); }
}

.cap { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--drift); }

/* hero */
.hero { padding-block: 64px 56px; max-width: 900px; margin-inline: auto; }
.hero h1 { font-size: clamp(44px, 8vw, 92px); line-height: 0.98; font-weight: 800; letter-spacing: -0.05em; margin: 18px 0 28px; }
.hero .hl { background: linear-gradient(transparent 62%, var(--honey) 62%); }
.hero .lead { font-size: 21px; color: var(--bark); max-width: 30ch; margin-bottom: 30px; }
.hero--foto { max-width: 1080px; display: grid; grid-template-columns: 1.1fr 1fr; gap: 48px; align-items: center; }
.foto { margin: 0; }
.foto img { display: block; width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--linen); box-shadow: 0 10px 30px rgba(59, 39, 22, 0.14); }
.foto figcaption { font-size: 13px; color: var(--drift); margin-top: 8px; }

/* sezioni */
section { scroll-margin-top: 16px; }
.band { background: var(--paper); border-block: 1px solid var(--linen); }
.sec-pad { padding-block: 64px; }
h2 { font-size: clamp(26px, 3.4vw, 36px); font-weight: 700; line-height: 1.12; }

/* storia */
.storia-grid { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 56px; align-items: start; }
.storia .txt p { font-size: 18px; color: var(--bark); margin-bottom: 16px; max-width: 52ch; }
.storia .firma { font-weight: 600; color: var(--esp); }
.storia .foto { margin-top: 28px; }

/* funzioni (riproduzioni dell'app) */
.app-intro { max-width: 60ch; margin-bottom: 40px; }
.app-intro p { font-size: 18px; color: var(--bark); margin-top: 12px; }
.feature { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; padding-block: 28px; }
.feature:nth-of-type(even) .feature-txt { order: 2; }
.feature h3 { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
.feature p { color: var(--bark); font-size: 17px; max-width: 40ch; }
.mockcap { font-size: 12px; color: var(--drift); margin-top: 10px; }

.mock { background: var(--cream); border: 1px solid var(--linen); border-radius: 12px; box-shadow: 0 18px 40px rgba(59, 39, 22, 0.14); overflow: hidden; font-size: 13px; letter-spacing: -0.005em; }
.mock-bar { height: 6px; background: linear-gradient(90deg, var(--gold), var(--amber)); }
.mock-body { padding: 16px; }
.mock h4 { margin: 0 0 12px; font-size: 20px; letter-spacing: -0.03em; }
.kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
.kpi { background: var(--paper); border: 1px solid var(--linen); border-radius: 8px; padding: 10px 12px; position: relative; overflow: hidden; box-shadow: var(--shadow); }
.kpi i { position: absolute; inset: 0 0 auto 0; height: 3px; }
.kpi i.r { background: var(--terra); }
.kpi i.g { background: var(--gold); }
.kpi small { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--drift); }
.kpi strong { font-size: 28px; font-weight: 700; letter-spacing: -0.04em; line-height: 1.2; }
.sec { font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ash); margin: 14px 0 6px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--paper); border: 1px solid var(--linen); border-radius: 8px; padding: 9px 12px; margin-bottom: 6px; }
.row .n { font-weight: 600; display: block; }
.row .c { color: var(--bark); font-size: 12px; display: block; }
.tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
.t-red { background: rgba(240, 98, 79, 0.15); color: var(--terra); }
.t-hon { background: var(--honey); color: var(--bark); }
.t-sage { background: var(--sage); color: var(--sagetx); }
.t-lin { background: var(--linen); color: var(--bark); }

.board { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 8px; min-width: 640px; }
.board-scroll { overflow-x: auto; }
.col-h { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--drift); margin-bottom: 6px; }
.card { background: var(--paper); border: 1px solid var(--linen); border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; box-shadow: var(--shadow); }
.card b { display: block; font-size: 12px; }
.card span { display: block; font-size: 11px; color: var(--bark); }

.pay { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
.pay div { background: var(--paper); border: 1px solid var(--linen); border-radius: 8px; padding: 10px 8px; text-align: center; box-shadow: var(--shadow); }
.pay small { display: block; font-size: 11px; color: var(--drift); }
.pay strong { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
.order-head { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; margin-bottom: 4px; }
.order-head h4 { margin: 0; }
.order-head span { font-size: 12px; color: var(--bark); white-space: nowrap; }

.notify { background: var(--honey); border: 1px solid rgba(232, 155, 1, 0.4); border-radius: 8px; padding: 12px; }
.notify b { display: block; margin-bottom: 8px; }
.notify .msg { background: var(--paper); border-radius: 8px; padding: 10px 12px; font-size: 13px; color: var(--bark); margin-bottom: 10px; }
.notify .acts { display: flex; gap: 8px; }
.notify .acts span { flex: 1; text-align: center; font-weight: 600; font-size: 12px; padding: 8px; border-radius: 8px; background: var(--esp); color: var(--cream); }
.notify .acts span.alt { background: var(--paper); color: var(--esp); border: 1px solid var(--stone); }

.label { background: var(--paper); border: 1px dashed var(--stone); border-radius: 4px; padding: 16px; display: flex; gap: 16px; align-items: center; justify-content: space-between; max-width: 340px; margin-inline: auto; }
.label .l-name { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
.label .l-line { font-size: 12px; color: var(--bark); margin-top: 4px; }
.label svg { width: 84px; height: 84px; flex: none; }

/* come si parte */
.steps { list-style: none; padding: 0; margin: 28px 0 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.steps li { background: var(--paper); border: 1px solid var(--linen); border-radius: 8px; padding: 20px; box-shadow: var(--shadow); }
.steps b { display: block; font-size: 17px; margin-bottom: 6px; }
.steps span { color: var(--bark); font-size: 15px; }
.prezzi { margin-top: 32px; max-width: 62ch; }
.prezzi h3 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.prezzi p { color: var(--bark); font-size: 17px; }

/* dubbi frequenti */
.faq-list { margin-top: 24px; max-width: 760px; }
.faq-list details { border-top: 1px solid var(--linen); padding: 16px 0; }
.faq-list details:last-child { border-bottom: 1px solid var(--linen); }
.faq-list summary { font-weight: 600; font-size: 17px; cursor: pointer; }
.faq-list details p { color: var(--bark); margin-top: 10px; max-width: 60ch; }

/* contatti */
.contatti { text-align: center; }
.contatti p { font-size: 19px; color: var(--bark); max-width: 44ch; margin: 14px auto 28px; }
.contatti .btns { justify-content: center; }

/* piè di pagina */
.foot { padding-block: 32px 48px; font-size: 13px; color: var(--drift); }
.foot .foot-row { display: flex; flex-wrap: wrap; gap: 8px 24px; justify-content: space-between; }
.foot a { color: var(--bark); }

/* privacy */
.doc { max-width: 720px; padding-block: 24px 64px; }
.doc h1 { font-size: 34px; font-weight: 800; margin-bottom: 16px; }
.doc h2 { font-size: 20px; margin: 28px 0 8px; }
.doc p, .doc li { color: var(--bark); }
.doc ul { padding-left: 20px; }

@media (max-width: 820px) {
  .hero { padding-block: 36px 40px; }
  .hero--foto, .storia-grid, .feature { grid-template-columns: 1fr; gap: 28px; }
  .feature:nth-of-type(even) .feature-txt { order: 0; }
  .steps { grid-template-columns: 1fr; }
  .sec-pad { padding-block: 44px; }
  .kpi strong { font-size: 22px; }
}
```

- [ ] **Step 5: Verifica che il font sia stato scaricato**

Run: `node -e "const b=require('fs').readFileSync('site/fonts/inter-latin.woff2');console.log(b.length, b.slice(0,4).toString())"`
Expected: una dimensione maggiore di 10000 e la stringa `wOF2`.

- [ ] **Step 6: Commit**

```bash
git add site
git commit -m "feat(sito): asset, configurazione e stili del sito vetrina" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Pagina `index.html`

**Files:**
- Create: `site/index.html`

- [ ] **Step 1: Scrivi `site/index.html`**

I meta tag qui dentro dicono "Centro Laser Viterbese" solo nella firma della storia tramite `data-site`; nel `<head>` non compare il nome del negozio, quindi il rebranding non li tocca.

```html
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Oltre la Bottega: cosa devo fare oggi?</title>
<meta name="description" content="Ordini, clienti e consegne per botteghe artigiane e micro-attività. Nata in una bottega vera, pensata per il banco. Prenota una dimostrazione.">
<link rel="canonical" href="https://oltrelabottega.it/">
<meta property="og:type" content="website">
<meta property="og:locale" content="it_IT">
<meta property="og:site_name" content="Oltre la Bottega">
<meta property="og:title" content="Oltre la Bottega: cosa devo fare oggi?">
<meta property="og:description" content="Ordini, clienti e consegne per botteghe artigiane e micro-attività. Nata in una bottega vera, pensata per il banco.">
<meta property="og:url" content="https://oltrelabottega.it/">
<meta property="og:image" content="https://oltrelabottega.it/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f8f7f5">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="preload" href="fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="style.css">
</head>
<body>
<a class="skip" href="#contenuto">Vai al contenuto</a>

<header class="wrap nav">
  <a class="brand" href="/"><img src="img/logo.png" alt="Oltre la Bottega" height="26"></a>
  <a class="cta-s" data-contact="primary" href="#contatti">Prenota una dimostrazione</a>
</header>

<main id="contenuto">

  <section class="wrap hero" id="inizio">
    <p class="cap">Nata in bottega</p>
    <h1>Cosa devo fare <span class="hl">oggi?</span></h1>
    <p class="lead">Ogni mattina, la stessa domanda. Oltre la Bottega ti risponde in meno di un minuto.</p>
    <div class="btns">
      <a class="btn btn-esp" data-contact="primary" href="#contatti">Prenota una dimostrazione</a>
      <a class="btn btn-line" href="#storia">Leggi la storia</a>
    </div>
  </section>

  <section class="storia band" id="storia">
    <div class="wrap sec-pad">
      <div class="storia-grid">
        <h2>L'ho costruita per la mia bottega, perché quelle che c'erano non erano fatte per un banco.</h2>
        <div class="txt">
          <p>I gestionali che c'erano erano pensati per un ufficio con una scrivania. Io avevo un banco, un cliente che aspettava e le mani ancora nel lavoro precedente.</p>
          <p class="episodio" data-site="episodio" hidden></p>
          <p>Ogni funzione nasce da qualcosa successo davvero. Un ordine senza il numero di telefono salvato ha reso impossibile avvisare il cliente: oggi il telefono è obbligatorio. Le recensioni non venivano mai chieste, non per pigrizia ma perché al momento della consegna non c'è mai un attimo libero: oggi basta un bottone che prepara il messaggio.</p>
          <p class="firma">— <span data-site="firmaNome">Olga</span>, <span data-site="firmaRuolo">titolare</span> di <span data-site="nomeNegozio">Centro Laser Viterbese</span>, <span data-site="descrizioneNegozio">articoli personalizzati con incisione, targhe e timbri</span></p>
        </div>
      </div>
    </div>
  </section>

  <section class="app sec-pad wrap" id="app">
    <div class="app-intro">
      <h2>Una schermata sola, invece di dieci menu.</h2>
      <p>Le azioni che fai spesso richiedono al massimo tre o quattro passi. Il resto non si vede finché non serve.</p>
    </div>

    <div class="feature">
      <div class="feature-txt">
        <h3>Apri e sai cosa fare</h3>
        <p>Ritardi, consegne di oggi, clienti da avvisare, materiale da ordinare: tutto nella prima schermata.</p>
      </div>
      <div>
        <div class="mock"><div class="mock-bar"></div><div class="mock-body">
          <h4>Oggi</h4>
          <div class="kpis">
            <div class="kpi"><i class="r"></i><small>In ritardo</small><strong>2</strong></div>
            <div class="kpi"><i class="g"></i><small>Da consegnare</small><strong>3</strong></div>
            <div class="kpi"><small>Da avvisare</small><strong>1</strong></div>
          </div>
          <div class="sec">Da consegnare oggi</div>
          <div class="row"><div><span class="n">Rossi Marta</span><span class="c">Targa in ottone, 2 pezzi</span></div><span class="tag t-hon">Pronto</span></div>
          <div class="row"><div><span class="n">Bianchi Luca</span><span class="c">Timbro personalizzato</span></div><span class="tag t-hon">In lavorazione</span></div>
          <div class="sec">Da avvisare</div>
          <div class="row"><div><span class="n">Ferri Anna</span><span class="c">Bomboniere incise</span></div><span class="tag t-red">Avvisa</span></div>
        </div></div>
        <p class="mockcap">Schermata di esempio.</p>
      </div>
    </div>

    <div class="feature">
      <div class="feature-txt">
        <h3>I lavori come su una lavagna</h3>
        <p>Preventivo, bozza grafica, da fare, in lavorazione, pronto. Cinque colonne, un colpo d'occhio, senza scorrere.</p>
      </div>
      <div>
        <div class="mock"><div class="mock-bar"></div><div class="mock-body">
          <h4>Bacheca</h4>
          <div class="board-scroll"><div class="board">
            <div><div class="col-h">Preventivo</div><div class="card"><b>Verdi Paola</b><span>Targa 30×20</span></div></div>
            <div><div class="col-h">Bozza grafica</div><div class="card"><b>Neri Sara</b><span>Timbro</span></div></div>
            <div><div class="col-h">Da fare</div><div class="card"><b>Conti Marco</b><span>Penne incise</span></div><div class="card"><b>Esposito Gina</b><span>Targa</span></div></div>
            <div><div class="col-h">In lavorazione</div><div class="card"><b>Bianchi Luca</b><span>Timbro</span></div></div>
            <div><div class="col-h">Pronto</div><div class="card"><b>Rossi Marta</b><span>Targa in ottone</span></div></div>
          </div></div>
        </div></div>
        <p class="mockcap">Schermata di esempio.</p>
      </div>
    </div>

    <div class="feature">
      <div class="feature-txt">
        <h3>Cliente, articoli, pagamento</h3>
        <p>Il nome del cliente in cima, più articoli nello stesso ordine, prezzo, acconto e saldo sempre chiari.</p>
      </div>
      <div>
        <div class="mock"><div class="mock-bar"></div><div class="mock-body">
          <div class="order-head"><h4>Ferri Anna</h4><span>Consegna 28/09</span></div>
          <div class="row"><div><span class="n">Bomboniere incise</span><span class="c">30 pezzi</span></div><span class="tag t-lin">€ 75,00</span></div>
          <div class="row"><div><span class="n">Targa in ottone</span><span class="c">1 pezzo</span></div><span class="tag t-lin">€ 45,00</span></div>
          <div class="pay">
            <div><small>Prezzo</small><strong>€ 120,00</strong></div>
            <div><small>Acconto</small><strong>€ 50,00</strong></div>
            <div><small>Saldo</small><strong>€ 70,00</strong></div>
          </div>
        </div></div>
        <p class="mockcap">Schermata di esempio.</p>
      </div>
    </div>

    <div class="feature">
      <div class="feature-txt">
        <h3>Avvisi e recensioni con un click</h3>
        <p>Il messaggio è già scritto: apri WhatsApp o la mail e mandi. Un ordine pronto ti compare tra le cose da avvisare, così non si dimentica.</p>
      </div>
      <div>
        <div class="mock"><div class="mock-bar"></div><div class="mock-body">
          <div class="notify">
            <b>Avvisa il cliente</b>
            <div class="msg">Buongiorno, l'ordine è pronto per il ritiro.</div>
            <div class="acts"><span>WhatsApp</span><span class="alt">Email</span></div>
          </div>
        </div></div>
        <p class="mockcap">Schermata di esempio.</p>
      </div>
    </div>

    <div class="feature">
      <div class="feature-txt">
        <h3>Etichetta con QR da attaccare</h3>
        <p>Stampi l'etichetta dell'ordine e la attacchi all'oggetto. Il QR apre la scheda, con tutto quello che serve sapere.</p>
      </div>
      <div>
        <div class="mock"><div class="mock-bar"></div><div class="mock-body">
          <div class="label">
            <div>
              <div class="l-name">Ferri Anna</div>
              <div class="l-line">Bomboniere incise, 30 pezzi</div>
              <div class="l-line">Consegnare: 28/09/2026</div>
              <div class="l-line">Da pagare: € 70,00</div>
            </div>
            <svg viewBox="0 0 21 21" role="img" aria-label="Codice QR di esempio">
              <rect width="21" height="21" fill="#ffffff"/>
              <g fill="#3b2716">
                <rect x="0" y="0" width="7" height="7"/><rect x="14" y="0" width="7" height="7"/><rect x="0" y="14" width="7" height="7"/>
              </g>
              <g fill="#ffffff">
                <rect x="1" y="1" width="5" height="5"/><rect x="15" y="1" width="5" height="5"/><rect x="1" y="15" width="5" height="5"/>
              </g>
              <g fill="#3b2716">
                <rect x="2" y="2" width="3" height="3"/><rect x="16" y="2" width="3" height="3"/><rect x="2" y="16" width="3" height="3"/>
                <rect x="9" y="1" width="2" height="2"/><rect x="9" y="5" width="1" height="2"/><rect x="11" y="3" width="2" height="2"/>
                <rect x="8" y="9" width="2" height="2"/><rect x="12" y="8" width="3" height="2"/><rect x="16" y="9" width="2" height="2"/>
                <rect x="19" y="10" width="2" height="2"/><rect x="9" y="12" width="1" height="3"/><rect x="12" y="12" width="2" height="2"/>
                <rect x="15" y="14" width="3" height="1"/><rect x="18" y="16" width="2" height="2"/><rect x="9" y="17" width="3" height="2"/>
                <rect x="14" y="18" width="2" height="2"/><rect x="12" y="15" width="1" height="2"/><rect x="0" y="9" width="2" height="2"/>
                <rect x="4" y="10" width="2" height="1"/>
              </g>
            </svg>
          </div>
        </div></div>
        <p class="mockcap">Schermata di esempio.</p>
      </div>
    </div>
  </section>

  <section class="band" id="come-si-parte">
    <div class="wrap sec-pad">
      <h2>Si parte in tre passi, senza cambiare le tue abitudini.</h2>
      <ol class="steps">
        <li><b>Ti mostro l'app</b><span>Una chiamata, con dei lavori di esempio, per vedere se fa per te.</span></li>
        <li><b>Prepariamo la tua bottega</b><span>Il nome della bottega e chi prende gli ordini. La configurazione la faccio io.</span></li>
        <li><b>La usi dal primo giorno</b><span>Da tablet, telefono o PC sul banco. Se hai un dubbio, rispondo io.</span></li>
      </ol>
      <div class="prezzi">
        <h3>Come funziona il prezzo</h3>
        <p>Una quota di attivazione una tantum e un canone annuale. Se un anno non rinnovi, l'app continua a funzionare com'è: non ti blocco l'accesso ai tuoi dati. Le cifre te le dico nella chiamata.</p>
      </div>
    </div>
  </section>

  <section class="wrap sec-pad" id="dubbi">
    <h2>Dubbi frequenti</h2>
    <div class="faq-list">
      <details><summary>Va bene per la mia attività?</summary><p>È pensata per botteghe e micro-attività da 1 a 5 persone che lavorano su ordinazione. Non è un programma di contabilità: non emette fatture.</p></details>
      <details><summary>Dove sono i miei dati?</summary><p>In uno spazio riservato alla tua bottega, non condiviso con altre attività. Ogni giorno ricevi anche per email una copia di tutti gli ordini.</p></details>
      <details><summary>Cosa succede se smetto di pagare?</summary><p>L'app continua a funzionare com'è. Non riceve più aggiornamenti né assistenza.</p></details>
      <details><summary>Serve un PC?</summary><p>No. Funziona dal browser, da tablet, telefono o PC. Sul banco basta un tablet.</p></details>
      <details><summary>Serve una stampante?</summary><p>Solo se vuoi le etichette con il QR: serve una stampante per etichette. Senza, tutto il resto funziona uguale.</p></details>
      <details><summary>È difficile da imparare?</summary><p>Le azioni che fai più spesso richiedono al massimo tre o quattro passi. Nei primi giorni ti aiuto io.</p></details>
    </div>
  </section>

  <section class="contatti band" id="contatti">
    <div class="wrap sec-pad">
      <h2>Prenota una dimostrazione</h2>
      <p>Scrivimi su WhatsApp o per email: ti rispondo io e scegliamo un momento per vedere l'app insieme.</p>
      <div class="btns">
        <a class="btn btn-amber" data-contact="whatsapp" href="#contatti" hidden>Scrivimi su WhatsApp</a>
        <a class="btn btn-line" data-contact="email" href="#contatti" hidden>Scrivimi per email</a>
      </div>
    </div>
  </section>

</main>

<footer class="wrap foot">
  <div class="foot-row">
    <span>© <span data-year>2026</span> Oltre la Bottega · <span data-site="datiLegali">Dati legali in aggiornamento</span></span>
    <span><a href="/privacy">Privacy</a> · <a href="https://app.oltrelabottega.it">Accedi all'app</a></span>
  </div>
</footer>

<script src="config.js"></script>
<script src="main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Esegui il controllo**

Run: `node site/check.mjs`
Expected: fallisce con `manca site/privacy.html` e `manca site/og.png`/`og:image inesistente "og.png"` (li creiamo nei task 4 e 6). Nessun altro errore: in particolare nessun `<img> senza alt`, nessun `style=` inline, nessun `data-site` non definito.

- [ ] **Step 3: Commit**

```bash
git add site/index.html
git commit -m "feat(sito): pagina principale del sito vetrina" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Privacy, indicizzazione e header di sicurezza

**Files:**
- Create: `site/privacy.html`, `site/robots.txt`, `site/sitemap.xml`, `site/vercel.json`

- [ ] **Step 1: Scrivi `site/privacy.html`**

Il testo è un'informativa essenziale per un sito senza cookie né moduli. **Va fatta leggere alla persona che segue la contabilità/legale di Olga prima di pubblicare**: non sostituisce una consulenza.

```html
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy · Oltre la Bottega</title>
<meta name="description" content="Informativa sulla privacy del sito di Oltre la Bottega: nessun cookie, nessun tracciamento, dati trattati solo se ci scrivi.">
<link rel="canonical" href="https://oltrelabottega.it/privacy">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f8f7f5">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="stylesheet" href="style.css">
</head>
<body>
<header class="wrap nav">
  <a class="brand" href="/"><img src="img/logo.png" alt="Oltre la Bottega" height="26"></a>
  <a class="cta-s" href="/">Torna al sito</a>
</header>
<main class="wrap doc">
  <h1>Privacy</h1>
  <p>Questo sito presenta il programma Oltre la Bottega. È fatto per non raccogliere dati: niente cookie, niente statistiche, niente moduli.</p>

  <h2>Chi è il titolare</h2>
  <p data-site="datiLegali">Dati legali in aggiornamento</p>

  <h2>Quali dati tratto</h2>
  <ul>
    <li>Se mi scrivi su WhatsApp o per email, ricevo il tuo nome, il tuo numero o indirizzo e il contenuto del messaggio.</li>
    <li>Il sito è ospitato da Vercel, che come ogni server registra dati tecnici della visita (per esempio indirizzo IP e pagina richiesta) per il funzionamento e la sicurezza del servizio.</li>
  </ul>

  <h2>Perché e per quanto tempo</h2>
  <p>Uso i tuoi dati solo per risponderti e organizzare la dimostrazione che mi chiedi. Li conservo per il tempo necessario e, se non nasce un rapporto di lavoro, li cancello su tua richiesta.</p>

  <h2>Cookie e statistiche</h2>
  <p>Il sito non usa cookie e non usa strumenti di statistica o di pubblicità. I caratteri di scrittura sono caricati dal sito stesso, non da servizi esterni.</p>

  <h2>I tuoi diritti</h2>
  <p>Puoi chiedere di vedere, correggere o cancellare i tuoi dati scrivendomi ai contatti indicati nel sito. Puoi anche rivolgerti al Garante per la protezione dei dati personali.</p>
</main>
<footer class="wrap foot">
  <div class="foot-row"><span>© <span data-year>2026</span> Oltre la Bottega</span><span><a href="/">Torna al sito</a></span></div>
</footer>
<script src="config.js"></script>
<script src="main.js"></script>
</body>
</html>
```

Nota: `privacy.html` ha un solo `<h1>` e `<h2>` come sezioni. Il controllo richiede title 10-60 e description 50-170 caratteri: sono già nei limiti.

- [ ] **Step 2: Scrivi `site/robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://oltrelabottega.it/sitemap.xml
```

- [ ] **Step 3: Scrivi `site/sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://oltrelabottega.it/</loc></url>
</urlset>
```

(La privacy è `noindex`, quindi non va in sitemap.)

- [ ] **Step 4: Scrivi `site/vercel.json`**

```json
{
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'none'"
        }
      ]
    },
    {
      "source": "/fonts/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/img/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=86400" }]
    }
  ]
}
```

- [ ] **Step 5: Esegui il controllo**

Run: `node site/check.mjs`
Expected: resta solo il problema `og:image inesistente "og.png"` (lo risolve il Task 6). Nessun altro.

- [ ] **Step 6: Commit**

```bash
git add site
git commit -m "feat(sito): privacy, robots, sitemap e header di sicurezza" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Verifica nel browser (telefono e desktop)

**Files:**
- Create: `scripts/site-smoke.mjs`

- [ ] **Step 1: Scrivi `scripts/site-smoke.mjs`**

```js
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
    const font = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check("16px Inter"); });
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
```

- [ ] **Step 2: Esegui e leggi il risultato**

Run: `node scripts/site-smoke.mjs`
Expected: `✓ Nessun problema.` Se `/og.png` non c'è ancora non viene richiesto dalla pagina (è solo nel meta), quindi non deve comparire come errore. Se compaiono problemi, correggili nei file di `site/` e rilancia.

- [ ] **Step 3: Guarda gli screenshot**

Apri `test-results/site-smoke/telefono-home.png` e `test-results/site-smoke/desktop-home.png` con lo strumento di lettura immagini. Cerca a occhio: testo tagliato, sezioni che si sovrappongono, la Bacheca che esce dallo schermo su telefono (deve scorrere dentro il suo riquadro, non allargare la pagina), colori coerenti con il campione C. Correggi in `site/style.css` ciò che non va e rilancia lo script.

- [ ] **Step 4: Commit**

```bash
git add scripts/site-smoke.mjs site
git commit -m "test(sito): verifica con Playwright su telefono e desktop" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Immagine per le anteprime social (`og.png`)

**Files:**
- Create: `site/og.png`

- [ ] **Step 1: Genera l'immagine 1200×630 dal sito stesso**

Lo script apre il sito in locale, sostituisce il contenuto della pagina con una copertina e la fotografa, così usa lo stesso Inter e gli stessi colori. Non viene committato: è un comando una tantum.

```bash
node --input-type=module -e "
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
const root = 'site';
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.woff2':'font/woff2'};
const server = createServer((req,res)=>{ const p = new URL(req.url,'http://x').pathname; const f = join(root, p==='/'?'index.html':p); if(!existsSync(f)){res.writeHead(404);res.end();return;} res.writeHead(200,{'Content-Type':types[extname(f)]||'application/octet-stream'}); res.end(readFileSync(f)); });
await new Promise(r=>server.listen(0,r));
const url='http://localhost:'+server.address().port+'/';
const b = await chromium.launch();
const page = await b.newPage({ viewport:{width:1200,height:630} });
await page.goto(url,{waitUntil:'networkidle'});
await page.evaluate(()=>{
  document.body.innerHTML='<div style=\"width:1200px;height:630px;background:#f8f7f5;display:flex;flex-direction:column;justify-content:center;padding:0 96px;box-sizing:border-box;position:relative\"><div style=\"position:absolute;top:0;left:0;right:0;height:14px;background:linear-gradient(90deg,#e89b01,#f9a600)\"></div><img src=\"img/logo.png\" style=\"height:56px;width:auto;align-self:flex-start;margin-bottom:56px\"><div style=\"font-size:104px;font-weight:800;letter-spacing:-0.05em;line-height:1;color:#3b2716\">Cosa devo fare <span style=\"background:linear-gradient(transparent 62%,#f8da9d 62%)\">oggi?</span></div><div style=\"font-size:34px;color:#61594a;margin-top:32px\">Nata in bottega, pensata per il banco.</div></div>';
});
await page.evaluate(()=>document.fonts.ready);
await page.screenshot({ path:'site/og.png' });
await b.close(); server.close();
"
ls -l site/og.png
```

Expected: `site/og.png` di qualche decina di KB.

- [ ] **Step 2: Guarda l'immagine**

Apri `site/og.png` con lo strumento di lettura immagini. Controlla che logo, titolo e riga siano tutti dentro l'immagine e leggibili. Se il titolo va a capo o esce dal bordo, riduci `font-size` da 104px a 92px nel comando e rigenera.

- [ ] **Step 3: Esegui il controllo completo**

Run: `node site/check.mjs && node scripts/site-smoke.mjs`
Expected: due volte `✓`. Nessun problema restante.

- [ ] **Step 4: Commit**

```bash
git add site/og.png
git commit -m "feat(sito): immagine per le anteprime social" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Foto reali (da fare quando Olga le consegna)

**Non eseguire prima di avere le foto.** Le foto previste: (a) il banco pieno di fogli, (b) Olga e il marito in negozio, opzionale (c) il negozio. Olga le mette in una cartella e indica il percorso; il marito deve essere d'accordo a comparire.

**Files:**
- Create: `site/img/banco.jpg`, `site/img/olga-e-marito.jpg`, opzionale `site/img/negozio.jpg`
- Modify: `site/index.html`

- [ ] **Step 1: Controlla la privacy delle foto**

Apri ogni foto con lo strumento di lettura immagini. Nel banco con i fogli **non devono leggersi** nomi, telefoni o dati di clienti. Se qualcosa si legge, chiedi a Olga se preferisce una foto rifatta con fogli qualsiasi o se vuoi sfocare le zone leggibili (Step 2 applica un blur alle regioni indicate).

- [ ] **Step 2: Ottimizza per il web**

`sharp` è già nel repo come dipendenza transitiva di Next. Sostituisci `SORGENTE_BANCO` e `SORGENTE_COPPIA` con i percorsi reali (e ripeti per `negozio.jpg` se c'è):

```bash
node -e "
const sharp = require('sharp');
(async () => {
  await sharp('SORGENTE_BANCO').rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile('site/img/banco.jpg');
  await sharp('SORGENTE_COPPIA').rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile('site/img/olga-e-marito.jpg');
  console.log('fatto');
})();
"
ls -l site/img
```

Expected: `fatto`, e ogni file sotto 300 KB. Se uno pesa di più, abbassa `quality` a 70.

Per sfocare una zona leggibile (coordinate in pixel dell'immagine ridimensionata, es. left 100, top 200, larghezza 300, altezza 120), estrai la regione, sfocala e ricomponila con `composite`; verifica il risultato guardando l'immagine.

- [ ] **Step 3: Inserisci la foto nell'hero**

In `site/index.html`, nella sezione hero cambia la classe della sezione in `wrap hero hero--foto` e avvolgi testo e foto così:

```html
  <section class="wrap hero hero--foto" id="inizio">
    <div>
      <p class="cap">Nata in bottega</p>
      <h1>Cosa devo fare <span class="hl">oggi?</span></h1>
      <p class="lead">Ogni mattina, la stessa domanda. Oltre la Bottega ti risponde in meno di un minuto.</p>
      <div class="btns">
        <a class="btn btn-esp" data-contact="primary" href="#contatti">Prenota una dimostrazione</a>
        <a class="btn btn-line" href="#storia">Leggi la storia</a>
      </div>
    </div>
    <figure class="foto">
      <img src="img/banco.jpg" alt="Il banco del negozio, pieno di fogli e appunti" width="1200" height="800" loading="eager">
      <figcaption>Il mio banco, prima.</figcaption>
    </figure>
  </section>
```

Sostituisci `width`/`height` con le dimensioni reali della foto ottimizzata (`node -e "require('sharp')('site/img/banco.jpg').metadata().then(m=>console.log(m.width,m.height))"`).

- [ ] **Step 4: Inserisci la foto nella storia**

In `site/index.html`, dentro `<div class="txt">` della sezione storia, subito dopo il paragrafo della firma (`<p class="firma">…</p>`), aggiungi:

```html
          <figure class="foto">
            <img src="img/olga-e-marito.jpg" alt="Olga e suo marito nel negozio" width="1200" height="800" loading="lazy">
            <figcaption>Io e mio marito, in negozio.</figcaption>
          </figure>
```

(anche qui, dimensioni reali). Se Olga vuole cambiare le didascalie, usa le sue parole.

- [ ] **Step 5: Verifica**

Run: `node site/check.mjs && node scripts/site-smoke.mjs`
Expected: due volte `✓`. Apri `test-results/site-smoke/telefono-home.png` e `desktop-home.png`: le foto non tagliano il testo, non allargano la pagina, l'hero su telefono mostra prima il testo e poi la foto.

- [ ] **Step 6: Commit**

```bash
git add site
git commit -m "feat(sito): foto del banco e di Olga con il marito" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Contenuti finali, controllo di pubblicazione e messa online

**Non eseguire prima di avere da Olga:** numero WhatsApp, email, dati legali (ragione sociale, P.IVA, eventuale PEC), l'episodio in due righe, il nome definitivo del negozio (se il rebranding è concluso) e conferma della firma.

**Files:**
- Modify: `site/config.js`, `CLAUDE.md`

- [ ] **Step 1: Compila `site/config.js`**

Sostituisci i valori vuoti con quelli di Olga (solo cifre con prefisso per `whatsapp`, es. `393331234567`), tenendo il resto invariato. Se il nome del negozio è cambiato, aggiornalo in `nomeNegozio` e `descrizioneNegozio`, e nel testo di partenza dentro `index.html` (elementi con `data-site="nomeNegozio"`).

- [ ] **Step 2: Esegui i controlli di pubblicazione**

Run: `node site/check.mjs --release && node scripts/site-smoke.mjs`
Expected: `✓ Sito OK (controlli di pubblicazione inclusi)` e `✓ Nessun problema.`

- [ ] **Step 3: Leggi insieme a Olga il risultato**

Apri `test-results/site-smoke/desktop-home.png` e `telefono-home.png`, mostrali a Olga e fai approvare i testi (in particolare la storia, la firma, l'episodio, la formula dei prezzi). Fai leggere `/privacy` a chi segue la parte legale/contabile di Olga: è un'informativa essenziale e va confermata prima della pubblicazione.

- [ ] **Step 4: Merge su `main`**

```bash
git add site/config.js site/index.html
git commit -m "feat(sito): contenuti finali e contatti" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git checkout main
git merge --no-ff feature/sito-vetrina -m "Merge branch 'feature/sito-vetrina'"
git push origin main
```

Dopo il push controlla che la CI sia verde: `gh run watch` (test e type check devono restare verdi; il lint è informativo).

- [ ] **Step 5: Crea il secondo progetto Vercel (passo manuale sul Dashboard, guidare Olga)**

1. Vercel → **Add New… → Project** → importa lo stesso repo GitHub.
2. Nome progetto: `oltre-la-bottega-sito`. **Root Directory**: `site`. Framework Preset: **Other**. Build Command e Output Directory vuoti.
3. **Deploy**. Aspetta lo stato *Ready* e apri l'indirizzo `*.vercel.app` del nuovo progetto: verifica la pagina.
4. **Settings → Domains → Add**: `oltrelabottega.it`, poi `www.oltrelabottega.it` con redirect a `oltrelabottega.it`.
5. Presso il registrar del dominio imposta i record che Vercel indica (di norma `A` per il dominio radice e `CNAME` per `www`). **Non toccare** il record del sottodominio `app`, che serve l'app.

- [ ] **Step 6: Verifica online**

Dopo la propagazione DNS (da minuti a qualche ora):

```bash
curl -sI https://oltrelabottega.it | head -20
curl -sI https://oltrelabottega.it/privacy | head -5
curl -s https://oltrelabottega.it/robots.txt
curl -sI https://oltrelabottega.it/og.png | head -5
curl -sI https://app.oltrelabottega.it/login | head -3
```

Expected: `HTTP/2 200` per le prime quattro, con gli header `content-security-policy` e `x-frame-options` sulla prima; l'app su `app.` risponde ancora (200). Poi incolla `https://oltrelabottega.it` in una chat WhatsApp e controlla che compaia l'anteprima con l'immagine `og.png`.

- [ ] **Step 7: Aggiorna `CLAUDE.md`**

Nella tabella "Decisioni chiave e motivazioni" aggiungi in fondo una riga (data del giorno di pubblicazione al posto di `AAAA-MM-GG`):

```
| Sito vetrina statico in `site/`, secondo progetto Vercel su `oltrelabottega.it` (AAAA-MM-GG) | Racconta l'app a titolari di botteghe e porta a "Prenota una dimostrazione". La storia di Olga (l'app nata per la sua bottega) è il punto di forza, prima della schermata. Una sola pagina + privacy, HTML/CSS senza build, Inter self-hosted, nessun cookie né statistica. Nome negozio, contatti e dati legali in `site/config.js`. Prezzi solo come formula (attivazione + canone; se non rinnovi l'app continua a funzionare), nessuna cifra pubblica. Le schermate sono riproduzioni con dati inventati (l'app gira sullo stesso database di produzione, uno screenshot vero mostrerebbe clienti reali). La demo online con dati finti è un progetto separato, da fare. Controlli: `node site/check.mjs [--release]` e `node scripts/site-smoke.mjs`. Design in `docs/superpowers/specs/2026-09-24-sito-vetrina-design.md`, piano in `docs/superpowers/plans/2026-09-24-sito-vetrina-plan.md` |
```

Nell'albero "Struttura del progetto" aggiungi `├── site/                            # Sito vetrina statico (oltrelabottega.it), progetto Vercel separato` sotto `supabase/migrations/`.

Nella sezione "Piano di rilascio" aggiungi una riga: `- **Sito vetrina** ✅: pubblicato su oltrelabottega.it; da fare: demo online con dati finti (progetto separato)`.

- [ ] **Step 8: Commit e push finali**

```bash
git add CLAUDE.md
git commit -m "docs: documenta il sito vetrina in CLAUDE.md" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin main
```

---

## Self-review rispetto allo spec

| Requisito dello spec | Dove |
|---|---|
| Direzione C, stile e logo dell'app, Inter | Task 2 (stili), Task 3 (pagina) |
| Struttura in 8 punti (barra, hero, storia, app, come si parte, dubbi, contatti, piè) | Task 3 |
| Pulsante "Prenota una dimostrazione" via WhatsApp/email | Task 2 (`main.js`), Task 3 |
| Prezzi solo come formula | Task 3 (sezione "Come funziona il prezzo") |
| Nome negozio in un solo blocco, rebranding | Task 2 (`config.js`), Task 3 (`data-site`), regole di testa |
| Nessuna testimonianza o cifra inventata | Regole di testa, Task 3 |
| Foto (banco, coppia, negozio) con controllo privacy | Task 7 |
| Schermate dell'app = riproduzioni con dati inventati e didascalia | Task 3 |
| Sito statico in `site/`, secondo progetto Vercel, dominio radice | Task 8 |
| Nessun cookie né statistiche; Inter self-hosted | Task 2, Task 4 |
| Contatti con `wa.me` ed email, senza backend | Task 2 (`main.js`) |
| Meta, anteprima social, favicon | Task 3, Task 6 |
| Responsive da telefono | Task 2 (CSS), Task 5 |
| ESLint non deve dare problemi nuovi | Task 1 |
| Dati legali e privacy | Task 4 (`privacy.html`), Task 8 (revisione legale) |
| Verifica prima della pubblicazione | Task 5, Task 8 |
| Punti aperti (contatti, dati legali, foto, episodio, nome) | Task 7, Task 8 (bloccanti, con `--release`) |

Coerenza dei nomi: `window.SITE` con chiavi `nomeNegozio`, `descrizioneNegozio`, `firmaNome`, `firmaRuolo`, `whatsapp`, `email`, `messaggioWhatsapp`, `oggettoEmail`, `datiLegali`, `episodio`. Gli attributi `data-site` usati in `index.html` e `privacy.html` sono `nomeNegozio`, `descrizioneNegozio`, `firmaNome`, `firmaRuolo`, `episodio`, `datiLegali`, tutti definiti in `config.js` (il controllo lo verifica).

**Da sapere prima di eseguire:** le didascalie delle foto nel Task 7 ("Il mio banco, prima.", "Io e mio marito, in negozio.") sono proposte: Olga può sostituirle con parole sue. Il testo della storia riprende quello già scritto in `docs/proposta-commerciale.md`; l'episodio resta vuoto finché Olga non lo fornisce.
