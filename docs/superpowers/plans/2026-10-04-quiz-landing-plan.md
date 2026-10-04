# Pagina di atterraggio "Quiz + regalo" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire `oltrelabottega.it/quiz`: un quiz di 7 domande che dà un risultato (3 profili) e un regalo stampabile diverso per profilo, con un invito leggero a scrivere su WhatsApp.

**Architecture:** Sito statico esistente in `site/` (HTML + CSS + JS senza build, `cleanUrls`, CSP che blocca script e stili inline). Contenuti e logica del quiz in un solo file `quiz-data.js` (puro, testabile con `node --test` caricandolo come fa già `check.mjs` con `config.js`), rendering in `quiz.js`, quattro pagine nuove (`quiz`, `modulo`, `svuota-la-testa`, `un-foglio-solo`) tutte `noindex` e senza menu.

**Tech Stack:** HTML, CSS, JavaScript ES5 (come `main.js`), Node (`node --test`, nessuna dipendenza), Vercel (progetto `site/` già esistente).

**Spec:** `docs/superpowers/specs/2026-10-04-quiz-landing-design.md`. Testi dei due regali: `docs/quiz/regalo-svuota-la-testa.md` e `docs/quiz/regalo-un-foglio-solo.md` (già riscritti da Olga: vanno riportati **così come sono**).

**Scelte provvisorie da validare con Olga dopo la costruzione** (non bloccano il lavoro): titolo della pagina "Quanto tieni a mente?", soglie del punteggio (0-4 / 5-9 / 10-14), nomi dei profili.

---

## File Structure

| File | Cosa fa |
|---|---|
| `site/config.js` (modifica) | aggiunge `messaggioQuiz` (testo WhatsApp preimpostato) |
| `site/quiz-data.js` (nuovo) | domande, profili, `calcolaPunteggio`, `profiloPer` in `window.QUIZ` |
| `site/quiz.test.mjs` (nuovo) | test di `quiz-data.js` e dei link ai regali |
| `site/quiz.html`, `site/quiz.css`, `site/quiz.js` (nuovi) | pagina di atterraggio e suo rendering |
| `site/regalo.css`, `site/regalo.js` (nuovi) | stile (schermo e stampa A4) e pulsante "Stampa" dei tre regali |
| `site/modulo.html`, `site/svuota-la-testa.html`, `site/un-foglio-solo.html` (nuovi) | i tre regali stampabili |
| `site/privacy.html` (modifica) | una riga: quiz e fogli non salvano né inviano nulla |
| `site/.vercelignore` (modifica) | non pubblicare `quiz.test.mjs` |
| `site/check.mjs` (modifica) | controlla anche le 4 pagine nuove (noindex, niente link al sito) |
| `CLAUDE.md` (modifica) | una riga nel Piano di rilascio |

Non si toccano: `index.html`, `main.js`, `style.css`, `sitemap.xml`, `robots.txt`, `vercel.json` (la CSP resta com'è: tutto in file esterni).

---

### Task 1: Contenuti e logica del quiz (con test)

**Files:**
- Create: `site/quiz.test.mjs`
- Create: `site/quiz-data.js`
- Modify: `site/config.js`

- [ ] **Step 1: Scrivere il test (fallisce perché `quiz-data.js` non esiste)**

Creare `site/quiz.test.mjs`:

```js
// Test di quiz-data.js. Esecuzione: node --test site/quiz.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const sandbox = {};
new Function("window", readFileSync(join(root, "quiz-data.js"), "utf8"))(sandbox);
const Q = sandbox.QUIZ;

test("7 domande, ciascuna con 3 risposte", () => {
  assert.equal(Q.domande.length, 7);
  for (const d of Q.domande) {
    assert.ok(d.testo.length > 0);
    assert.equal(d.risposte.length, 3);
  }
});

test("i profili coprono ogni punteggio da 0 a 14, senza buchi né sovrapposizioni", () => {
  for (let p = 0; p <= 14; p++) {
    const trovati = Q.profili.filter((x) => p >= x.da && p <= x.a);
    assert.equal(trovati.length, 1, "punteggio " + p);
  }
});

test("calcolaPunteggio somma le risposte", () => {
  assert.equal(Q.calcolaPunteggio([0, 0, 0, 0, 0, 0, 0]), 0);
  assert.equal(Q.calcolaPunteggio([2, 2, 2, 2, 2, 2, 2]), 14);
  assert.equal(Q.calcolaPunteggio([1, 0, 2, 1, 0, 2, 1]), 7);
});

test("calcolaPunteggio rifiuta risposte incomplete o non valide", () => {
  assert.throws(() => Q.calcolaPunteggio([0, 0, 0]));
  assert.throws(() => Q.calcolaPunteggio([0, 0, 0, 0, 0, 0, 3]));
  assert.throws(() => Q.calcolaPunteggio([0, 0, 0, 0, 0, 0, "1"]));
});

test("profiloPer sceglie il profilo giusto ai confini", () => {
  assert.equal(Q.profiloPer(0).id, "ordine");
  assert.equal(Q.profiloPer(4).id, "ordine");
  assert.equal(Q.profiloPer(5).id, "buchi");
  assert.equal(Q.profiloPer(9).id, "buchi");
  assert.equal(Q.profiloPer(10).id, "spalle");
  assert.equal(Q.profiloPer(14).id, "spalle");
  assert.throws(() => Q.profiloPer(15));
  assert.throws(() => Q.profiloPer(-1));
});

test("ogni regalo punta a una pagina che esiste", () => {
  for (const p of Q.profili) {
    const file = p.regalo.href.replace(/^\//, "") + ".html";
    assert.ok(existsSync(join(root, file)), p.id + ": manca site/" + file);
  }
});

test("solo il profilo più organizzato riceve il modulo", () => {
  const conModulo = Q.profili.filter((p) => p.regalo.href === "/modulo").map((p) => p.id);
  assert.deepEqual(conModulo, ["ordine"]);
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `node --test site/quiz.test.mjs`
Expected: FAIL con `ENOENT ... quiz-data.js`.

- [ ] **Step 3: Scrivere `site/quiz-data.js`**

```js
// Contenuti e logica del quiz. Nessuna dipendenza: caricato dal browser (window.QUIZ)
// e letto da quiz.test.mjs. L'indice di ogni risposta è anche il suo punteggio (0, 1, 2).
window.QUIZ = (function () {
  var domande = [
    { testo: "Un cliente ti chiede se il suo ordine è pronto. Tu…",
      risposte: ["rispondi subito, sai dov'è", "controlli tra fogli e messaggi", "dici «ti richiamo» e speri"] },
    { testo: "Hai promesso una consegna per giovedì. Come te la ricordi?",
      risposte: ["è segnata in un posto solo", "è su un foglio, forse in un messaggio", "la ricordo io"] },
    { testo: "Torna un cliente. Sai cosa aveva ordinato l'ultima volta?",
      risposte: ["lo vedo in pochi secondi", "devo cercare tra quaderni e messaggi", "glielo chiedo di nuovo"] },
    { testo: "Le recensioni:",
      risposte: ["le chiedo di solito", "ogni tanto", "non mi viene mai in mente"] },
    { testo: "A fine giornata riesci a staccare?",
      risposte: ["sì, tranquillamente", "quasi, ripasso qualcosa a mente", "no, tengo tutto in testa"] },
    { testo: "Quando arrivano le urgenze, i lavori già iniziati…",
      risposte: ["restano sempre in vista", "a volte vengono rimandati a dopo", "spesso li perdo di vista o dimentico"] },
    { testo: "Se domani non ci fossi tu, chi ti sostituisce capirebbe a che punto sono i lavori?",
      risposte: ["sì, certo", "forse con qualche spiegazione", "no, è tutto nella mia testa"] }
  ];

  var profili = [
    { id: "ordine", da: 0, a: 4, nome: "Il banco in ordine",
      intro: "Hai già un metodo che regge. Due accorgimenti per non perderlo nei giorni pieni:",
      consigli: [
        "Scrivi la data di consegna nel momento in cui la prometti.",
        "Chiedi la recensione prima che il cliente esca."
      ],
      regalo: { titolo: "Il modulo di presa ordine",
                testo: "Una pagina da stampare e compilare al banco, uguale per ogni tipo di lavoro.",
                href: "/modulo", bottone: "Apri il modulo" } },
    { id: "buchi", da: 5, a: 9, nome: "Il banco con qualche buco",
      intro: "Funziona, ma ti salva la memoria. Due cose da fare subito:",
      consigli: [
        "Un foglio solo per tutti gli ordini aperti.",
        "Ogni sera tre domande: cosa consegno domani? cosa devo ordinare o chi richiamare? da chi aspetto una risposta?"
      ],
      regalo: { titolo: "Un foglio solo",
                testo: "Tre mosse piccole per avere tutti gli ordini in un posto solo.",
                href: "/un-foglio-solo", bottone: "Apri la guida" } },
    { id: "spalle", da: 10, a: 14, nome: "Tutto sulle tue spalle",
      intro: "Il lavoro funziona perché lo tieni tutto in testa, ed è faticoso. Per cominciare:",
      consigli: [
        "Scrivi oggi su un foglio ogni lavoro aperto con la data di consegna, senza sistemarlo.",
        "Se non hai tempo, scrivi solo le tre cose che temi di dimenticare."
      ],
      regalo: { titolo: "Svuota la testa in 10 minuti",
                testo: "Un metodo in tre passi per togliere dalla testa quello che non deve restarci.",
                href: "/svuota-la-testa", bottone: "Apri la guida" } }
  ];

  function calcolaPunteggio(risposte) {
    if (!Array.isArray(risposte) || risposte.length !== domande.length) {
      throw new Error("risposte incomplete");
    }
    var totale = 0;
    for (var i = 0; i < risposte.length; i++) {
      var v = risposte[i];
      if (v !== 0 && v !== 1 && v !== 2) throw new Error("risposta non valida: " + v);
      totale += v;
    }
    return totale;
  }

  function profiloPer(punteggio) {
    for (var i = 0; i < profili.length; i++) {
      if (punteggio >= profili[i].da && punteggio <= profili[i].a) return profili[i];
    }
    throw new Error("punteggio fuori scala: " + punteggio);
  }

  return { domande: domande, profili: profili, calcolaPunteggio: calcolaPunteggio, profiloPer: profiloPer };
})();
```

- [ ] **Step 4: Aggiungere il messaggio WhatsApp del quiz a `site/config.js`**

Dopo la riga `oggettoEmail: ...,` aggiungere:

```js
  // Messaggio WhatsApp preimpostato dal pulsante finale del quiz
  messaggioQuiz: "Buongiorno, ho fatto il quiz e scaricato il foglio. Vorrei vedere come funziona Oltre la Bottega.",
```

(`oggettoEmail` ha la virgola finale, quindi la nuova riga va subito dopo e prima della riga vuota con il commento "Piè di pagina e privacy".)

- [ ] **Step 5: Eseguire il test**

Run: `node --test site/quiz.test.mjs`
Expected: i primi 5 test PASS; **gli ultimi 2 ("ogni regalo punta a una pagina che esiste" e "solo il profilo più organizzato…") il primo FAIL** perché le pagine dei regali non esistono ancora (`manca site/modulo.html` ecc.) e il secondo PASS. Questo è atteso: il test dei link diventa verde alla fine del Task 4.

- [ ] **Step 6: Commit**

```bash
git add site/quiz-data.js site/quiz.test.mjs site/config.js
git commit -m "feat(quiz): contenuti e logica del quiz con test"
```

---

### Task 2: Pagina del quiz

**Files:**
- Create: `site/quiz.html`
- Create: `site/quiz.css`
- Create: `site/quiz.js`

- [ ] **Step 1: Creare `site/quiz.html`**

```html
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quanto tieni a mente? Il quiz di due minuti</title>
<meta name="description" content="Sette domande per capire se la tua bottega dipende dalla tua memoria. Alla fine un foglio da stampare in regalo, senza lasciare nessun dato.">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f8f7f5">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="preload" href="fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="quiz.css">
</head>
<body>
<a class="skip" href="#contenuto">Vai al contenuto</a>

<header class="wrap q-top"><img src="img/logo.png" alt="Oltre la Bottega" height="26"></header>

<main class="wrap q-main" id="contenuto">

  <section class="hero q-hero" id="q-inizio">
    <p class="cap">Quiz di due minuti</p>
    <h1>Quanto tieni a <span class="hl">mente?</span></h1>
    <p class="lead">Sette domande per capire quanto la tua bottega dipende dalla tua memoria. Alla fine ricevi in regalo un foglio da stampare. Non ti chiedo nessun dato.</p>
    <button class="btn btn-esp" type="button" id="q-start">Comincia il quiz</button>
    <noscript><p class="q-noscript">Per fare il quiz serve JavaScript attivo nel browser.</p></noscript>
  </section>

  <section class="q-card" id="q-domanda" hidden>
    <p class="q-prog" id="q-prog"></p>
    <h2 id="q-testo" tabindex="-1"></h2>
    <div class="q-ans" id="q-ans"></div>
  </section>

  <section class="q-card" id="q-risultato" hidden>
    <p class="cap">Il tuo risultato</p>
    <h2 id="r-nome" tabindex="-1"></h2>
    <p id="r-intro" class="q-intro"></p>
    <ul class="q-list" id="r-consigli"></ul>

    <div class="q-gift">
      <p class="cap">Il tuo regalo</p>
      <h3 id="r-regalo-titolo"></h3>
      <p id="r-regalo-testo"></p>
      <a class="btn btn-amber" id="r-regalo-link" href="#" target="_blank" rel="noopener noreferrer">Apri</a>
    </div>

    <div class="q-invito">
      <p>Se vuoi che invece di scriverlo a mano lo faccia un'app, ti faccio vedere come.</p>
      <div class="btns">
        <a class="btn btn-esp" id="r-wa" href="#" target="_blank" rel="noopener noreferrer" hidden>Scrivimi su WhatsApp</a>
        <button class="btn btn-line" type="button" id="r-ripeti">Rifai il quiz</button>
      </div>
    </div>
  </section>

</main>

<footer class="wrap foot">
  <div class="foot-row">
    <span>© <span data-year>2026</span> Oltre la Bottega · <span data-site="datiLegali">Dati legali in aggiornamento</span></span>
    <span><a href="/privacy">Privacy</a></span>
  </div>
</footer>

<script src="config.js"></script>
<script src="main.js"></script>
<script src="quiz-data.js"></script>
<script src="quiz.js"></script>
</body>
</html>
```

(L'unico collegamento verso il resto del sito è "Privacy" nel piè di pagina, necessario per legge. Nessun menu, nessun link a `/`.)

- [ ] **Step 2: Creare `site/quiz.css`**

```css
/* pagina di atterraggio del quiz: si appoggia a style.css */
.q-top { padding-block: 16px; }
.q-top img { height: 26px; width: auto; display: block; }
.q-main { padding-bottom: 48px; }
.q-hero .lead { max-width: 36ch; }
.q-noscript { margin-top: 16px; color: var(--bark); }

.q-card { max-width: 640px; margin: 24px auto 0; background: var(--paper); border: 1px solid var(--linen); border-radius: 12px; padding: 28px 24px; box-shadow: var(--shadow); }
.q-card h2 { font-size: clamp(22px, 3.4vw, 28px); margin-bottom: 20px; }
.q-card h2:focus { outline: none; }
.q-prog { font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--drift); margin-bottom: 10px; }

.q-ans { display: grid; gap: 10px; }
.q-opt { font: inherit; font-weight: 600; text-align: left; padding: 16px 18px; border-radius: 8px; border: 1px solid var(--stone); background: var(--cream); color: var(--esp); cursor: pointer; }
.q-opt:hover, .q-opt:focus-visible { border-color: var(--gold); background: var(--honey); }

.q-intro { color: var(--bark); font-size: 17px; }
.q-list { padding-left: 20px; color: var(--bark); margin: 12px 0 0; }
.q-list li { margin-bottom: 8px; }

.q-gift { margin-top: 28px; padding: 20px; background: var(--honey); border: 1px solid rgba(232, 155, 1, 0.4); border-radius: 8px; }
.q-gift h3 { font-size: 22px; margin: 6px 0; }
.q-gift p { color: var(--bark); }
.q-gift .btn { margin-top: 14px; }

.q-invito { margin-top: 28px; }
.q-invito p { color: var(--bark); font-size: 17px; margin-bottom: 14px; }
```

- [ ] **Step 3: Creare `site/quiz.js`**

```js
// Rendering del quiz. Contenuti e punteggio stanno in quiz-data.js.
// Nessun dato viene salvato o inviato: le risposte vivono solo in questa pagina.
(function () {
  var Q = window.QUIZ;
  var cfg = window.SITE || {};
  var risposte = [];
  var indice = 0;

  function $(id) { return document.getElementById(id); }

  function mostra(id, titoloId) {
    var sezioni = ["q-inizio", "q-domanda", "q-risultato"];
    for (var i = 0; i < sezioni.length; i++) $(sezioni[i]).hidden = sezioni[i] !== id;
    window.scrollTo(0, 0);
    if (titoloId) $(titoloId).focus();
  }

  function renderDomanda() {
    var d = Q.domande[indice];
    $("q-prog").textContent = "Domanda " + (indice + 1) + " di " + Q.domande.length;
    $("q-testo").textContent = d.testo;
    var box = $("q-ans");
    box.textContent = "";
    d.risposte.forEach(function (testo, valore) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "q-opt";
      b.textContent = testo;
      b.addEventListener("click", function () { rispondi(valore); });
      box.appendChild(b);
    });
  }

  function rispondi(valore) {
    risposte.push(valore);
    indice += 1;
    if (indice < Q.domande.length) {
      renderDomanda();
      mostra("q-domanda", "q-testo");
    } else {
      mostraRisultato();
    }
  }

  function mostraRisultato() {
    var p = Q.profiloPer(Q.calcolaPunteggio(risposte));
    $("r-nome").textContent = p.nome;
    $("r-intro").textContent = p.intro;
    var lista = $("r-consigli");
    lista.textContent = "";
    p.consigli.forEach(function (c) {
      var li = document.createElement("li");
      li.textContent = c;
      lista.appendChild(li);
    });
    $("r-regalo-titolo").textContent = p.regalo.titolo;
    $("r-regalo-testo").textContent = p.regalo.testo;
    var link = $("r-regalo-link");
    link.href = p.regalo.href;
    link.textContent = p.regalo.bottone;

    var wa = $("r-wa");
    if (cfg.whatsapp) {
      wa.href = "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(cfg.messaggioQuiz || "");
      wa.hidden = false;
    }
    mostra("q-risultato", "r-nome");
  }

  function ricomincia() {
    risposte = [];
    indice = 0;
    renderDomanda();
    mostra("q-domanda", "q-testo");
  }

  $("q-start").addEventListener("click", ricomincia);
  $("r-ripeti").addEventListener("click", ricomincia);
})();
```

- [ ] **Step 4: Controllo a mano (le pagine dei regali non ci sono ancora, quindi il link regalo darà 404: è atteso)**

Run: `npx --yes serve site -l 4000` e aprire `http://localhost:4000/quiz`.
Expected: titolo "Quanto tieni a mente?", il pulsante avvia il quiz, 7 domande una alla volta con "Domanda N di 7", alla fine compare il risultato con nome, 2 consigli, riquadro "Il tuo regalo", pulsante WhatsApp e "Rifai il quiz". Nessun errore nella console del browser. Fermare il server con Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add site/quiz.html site/quiz.css site/quiz.js
git commit -m "feat(quiz): pagina del quiz con risultato e invito finale"
```

---

### Task 3: Stile e script comuni dei tre regali

**Files:**
- Create: `site/regalo.css`
- Create: `site/regalo.js`

- [ ] **Step 1: Creare `site/regalo.css`**

```css
/* pagine dei regali stampabili: schermo e stampa A4. Si appoggia a style.css (.doc, .wrap, .foot) */
.r-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-block: 16px; }
.r-top img { height: 26px; width: auto; display: block; }
.r-top .cta-s { font: inherit; font-size: 14px; font-weight: 600; background: var(--paper); color: var(--esp); cursor: pointer; }

.r-doc .r-sub { font-style: italic; color: var(--drift); margin-bottom: 20px; }
.r-doc blockquote { margin: 12px 0; padding-left: 14px; border-left: 3px solid var(--gold); font-weight: 600; color: var(--esp); }
.r-doc .r-closing { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--linen); font-style: italic; }
.r-doc .r-cta { margin-top: 16px; }
.r-doc .r-web { margin-top: 24px; font-size: 13px; color: var(--drift); }

/* tabella da compilare (Un foglio solo) */
.r-table { width: 100%; border-collapse: collapse; margin: 12px 0 20px; }
.r-table th, .r-table td { border: 1px solid var(--esp); padding: 8px; text-align: left; }
.r-table th { font-size: 13px; background: var(--linen); }
.r-table td { height: 2.4em; }

/* quattro gruppi (Svuota la testa) */
.r-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0 20px; }
.r-grid div { border: 1px solid var(--esp); border-radius: 4px; min-height: 130px; padding: 8px 10px; }
.r-grid b { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--bark); }

/* modulo di presa ordine */
.m-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.m-row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.m-field { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 14px; }
.m-field span { font-weight: 600; white-space: nowrap; }
.m-field i { flex: 1; min-width: 0; height: 1.4em; border-bottom: 1px solid var(--esp); }
.m-box { border: 1px solid var(--esp); border-radius: 4px; min-height: 90px; margin-bottom: 14px; }
.m-box--big { min-height: 150px; }

@media (max-width: 560px) {
  .m-row2, .m-row3, .r-grid { grid-template-columns: 1fr; }
}

@page { size: A4; margin: 15mm; }
@media print {
  .r-noprint, .skip { display: none !important; }
  html, body { background: #fff; }
  body { font-size: 12pt; }
  .doc { max-width: none; padding: 0; }
  .r-doc h1 { font-size: 22pt; }
  .r-doc h2, .r-table, .r-grid, .m-box { break-inside: avoid; }
  .m-row2 { grid-template-columns: 1fr 1fr; }
  .m-row3 { grid-template-columns: repeat(3, 1fr); }
  .r-grid { grid-template-columns: 1fr 1fr; }
  a { text-decoration: none; }
}
```

- [ ] **Step 2: Creare `site/regalo.js`**

```js
// Pulsante "Stampa" delle pagine dei regali.
(function () {
  var b = document.getElementById("stampa");
  if (b) b.addEventListener("click", function () { window.print(); });
})();
```

- [ ] **Step 3: Commit**

```bash
git add site/regalo.css site/regalo.js
git commit -m "feat(quiz): stile e pulsante Stampa dei regali"
```

---

### Task 4: I tre regali stampabili

**Files:**
- Create: `site/modulo.html`
- Create: `site/svuota-la-testa.html`
- Create: `site/un-foglio-solo.html`

I testi delle due guide sono quelli di `docs/quiz/` (versione di Olga). Non vanno riscritti.

- [ ] **Step 1: Creare `site/modulo.html`**

```html
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Modulo di presa ordine · Oltre la Bottega</title>
<meta name="description" content="Modulo di presa ordine da stampare e compilare al banco: cliente, cosa ha ordinato, date, prezzo, acconto e saldo. Uguale per ogni tipo di lavoro.">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f8f7f5">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="regalo.css">
</head>
<body>
<a class="skip" href="#contenuto">Vai al contenuto</a>
<header class="wrap r-top r-noprint">
  <img src="img/logo.png" alt="Oltre la Bottega" height="26">
  <button class="cta-s" type="button" id="stampa">Stampa</button>
</header>

<main class="wrap doc r-doc" id="contenuto">
  <h1>Modulo di presa ordine</h1>
  <p class="r-sub">Da compilare al banco, con il cliente davanti.</p>

  <h2>Cliente</h2>
  <div class="m-row2">
    <div class="m-field"><span>Nome</span><i></i></div>
    <div class="m-field"><span>Cognome</span><i></i></div>
  </div>
  <div class="m-row2">
    <div class="m-field"><span>Telefono</span><i></i></div>
    <div class="m-field"><span>Email</span><i></i></div>
  </div>

  <h2>Cosa ha ordinato</h2>
  <div class="m-box m-box--big"></div>

  <h2>Date</h2>
  <div class="m-row2">
    <div class="m-field"><span>Data dell'ordine</span><i></i></div>
    <div class="m-field"><span>Consegna promessa</span><i></i></div>
  </div>

  <h2>Pagamento</h2>
  <div class="m-row3">
    <div class="m-field"><span>Prezzo €</span><i></i></div>
    <div class="m-field"><span>Acconto €</span><i></i></div>
    <div class="m-field"><span>Saldo €</span><i></i></div>
  </div>

  <h2>Note</h2>
  <div class="m-box"></div>

  <p class="r-web">Modulo offerto da Oltre la Bottega · oltrelabottega.it</p>
</main>

<footer class="wrap foot r-noprint">
  <div class="foot-row"><span>© <span data-year>2026</span> Oltre la Bottega · <span data-site="datiLegali">Dati legali in aggiornamento</span></span></div>
</footer>

<script src="config.js"></script>
<script src="main.js"></script>
<script src="regalo.js"></script>
</body>
</html>
```

- [ ] **Step 2: Creare `site/svuota-la-testa.html`**

```html
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Svuota la testa in 10 minuti · Oltre la Bottega</title>
<meta name="description" content="Una guida in tre passi per togliere dalla testa gli ordini, le telefonate e le scadenze, mettendoli su un foglio. Da stampare, dieci minuti.">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f8f7f5">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="regalo.css">
</head>
<body>
<a class="skip" href="#contenuto">Vai al contenuto</a>
<header class="wrap r-top r-noprint">
  <img src="img/logo.png" alt="Oltre la Bottega" height="26">
  <button class="cta-s" type="button" id="stampa">Stampa</button>
</header>

<main class="wrap doc r-doc" id="contenuto">
  <h1>Svuota la testa in 10 minuti</h1>
  <p class="r-sub">Una cosa che sai già, e che nei giorni pieni non si fa mai.</p>

  <p><b>Quante cose hai in testa adesso?</b><br>
  Un ordine da consegnare giovedì. Il materiale da ordinare. Quel cliente che aspetta una risposta.
  Non sono dimenticanze: sono promesse, e le tieni tutte insieme, tutto il giorno, anche la sera.</p>
  <p>Lo sai già che tenerle a mente non è un modo comodo di tenerle.
  Ma ogni volta c'è prima il lavoro.
  Per questo ti basta fare una cosa sola, <b>una volta</b>, oggi.</p>

  <h2>Prima di cominciare</h2>
  <p>Ti serve un foglio, una penna, dieci minuti. Metti il telefono dove non lo vedi.</p>

  <h2>Passo 1 · Scrivi tutto, senza ordine (3 minuti)</h2>
  <p>Butta giù ogni cosa che ti gira in testa legata alla bottega: ordini, telefonate, materiali, pagamenti, cose da chiedere.
  <b>Non sistemare, non giudicare, non cancellare.</b>
  Se una cosa ti viene in mente due volte, scrivila due volte.</p>

  <h2>Passo 2 · Per ognuna, scrivi cosa fai <em>per prima</em> (4 minuti)</h2>
  <p>Accanto a ogni voce metti <b>la prossima azione concreta</b> e, se c'è, <b>la data</b>.<br>
  Non «ordine Rossi», ma «<em>chiamare Rossi per confermare la misura, entro mercoledì</em>».<br>
  Una voce senza una prossima azione continua a occupare spazio in testa.</p>

  <h2>Passo 3 · Mettile in quattro gruppi (3 minuti)</h2>
  <p>Dividi il foglio in quattro e riporta ogni voce dove va:</p>
  <div class="r-grid">
    <div><b>Da consegnare</b></div>
    <div><b>Da ordinare</b></div>
    <div><b>Da richiamare</b></div>
    <div><b>Da incassare</b></div>
  </div>
  <p>Quattro gruppi bastano. Se una voce non entra in nessuno, probabilmente è un pensiero e non un lavoro: puoi barrarla.</p>

  <h2>Ora puoi smettere</h2>
  <p>Guarda il foglio. È tutto lì. Per oggi non devi ricordare niente: <b>lo ricorda il foglio.</b></p>
  <p>Appendilo dove lo vedi domattina.</p>

  <h2>Il giorno dopo (2 minuti)</h2>
  <p>Prima di aprire il negozio, rileggilo. Barra quello che è fatto.
  Aggiungi le cose nuove nel gruppo giusto.
  È tutto qui.</p>

  <h2>Se non ci riesci subito</h2>
  <p>Ci sono giorni in cui non c'è un quarto d'ora libero. Fa lo stesso: scrivi <b>solo le tre cose che temi di dimenticare</b>. Il resto verrà dopo. Cominciare è più importante che fare tutto.</p>

  <p class="r-closing">Questo foglio funziona. L'unico difetto: devi riscriverlo ogni giorno.
  Se un giorno vorrai una soluzione più efficiente, scrivimi: ti faccio vedere una che uso io tutti i giorni nella mia bottega.</p>
  <p class="r-cta r-noprint"><a class="btn btn-amber" data-contact="whatsapp" href="#contenuto" hidden>Scrivimi su WhatsApp</a></p>
  <p class="r-web">Guida offerta da Oltre la Bottega · oltrelabottega.it</p>
</main>

<footer class="wrap foot r-noprint">
  <div class="foot-row"><span>© <span data-year>2026</span> Oltre la Bottega · <span data-site="datiLegali">Dati legali in aggiornamento</span></span></div>
</footer>

<script src="config.js"></script>
<script src="main.js"></script>
<script src="regalo.js"></script>
</body>
</html>
```

- [ ] **Step 3: Creare `site/un-foglio-solo.html`**

```html
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Un foglio solo · Oltre la Bottega</title>
<meta name="description" content="Tre mosse piccole per tenere tutti gli ordini aperti su un foglio solo: la tabella da compilare, una regola per le date e un controllo alla settimana.">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f8f7f5">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="regalo.css">
</head>
<body>
<a class="skip" href="#contenuto">Vai al contenuto</a>
<header class="wrap r-top r-noprint">
  <img src="img/logo.png" alt="Oltre la Bottega" height="26">
  <button class="cta-s" type="button" id="stampa">Stampa</button>
</header>

<main class="wrap doc r-doc" id="contenuto">
  <h1>Un foglio solo</h1>
  <p class="r-sub">Una cosa che sai già, e che nei giorni pieni si perde.</p>

  <p><b>Tutto funziona. Ma funziona finché ci sei tu.</b><br>
  Gli ordini li segni: sul quaderno, su un foglietto, in un messaggio, a volte solo a mente. Quasi sempre basta. Ogni tanto, però, una consegna salta fuori solo perché il cliente richiama, non è un imprevisto: è una promessa che non hai mantenuto.</p>
  <p>Lo sai già che servirebbe <b>un posto solo</b> per tenere tutti i dati.</p>

  <h2>Mossa 1 · Un foglio per tutti gli ordini aperti</h2>
  <p>Prendi un foglio e disegna quattro colonne (oppure usa questa tabella):</p>
  <table class="r-table">
    <thead><tr><th>Cliente</th><th>Cosa</th><th>Consegna</th><th>A che punto sono</th></tr></thead>
    <tbody>
      <tr><td></td><td></td><td></td><td></td></tr>
      <tr><td></td><td></td><td></td><td></td></tr>
      <tr><td></td><td></td><td></td><td></td></tr>
      <tr><td></td><td></td><td></td><td></td></tr>
      <tr><td></td><td></td><td></td><td></td></tr>
      <tr><td></td><td></td><td></td><td></td></tr>
      <tr><td></td><td></td><td></td><td></td></tr>
      <tr><td></td><td></td><td></td><td></td></tr>
      <tr><td></td><td></td><td></td><td></td></tr>
      <tr><td></td><td></td><td></td><td></td></tr>
    </tbody>
  </table>
  <p>Ci vanno <b>tutti</b> gli ordini aperti. Niente appunti sparsi altrove: se non è sul foglio, non esiste.<br>
  Le righe nuove si aggiungono <b>subito</b>, mentre il cliente è ancora al banco: è il momento in cui hai tutte le informazioni e hai meno tempo per dimenticarle.</p>
  <p><em>Come scrivere «a che punto sono»:</em> poche parole, sempre le stesse. Per esempio: <em>aspetto conferma · da fare · in lavorazione · pronto · consegnato</em>. Se usi parole diverse ogni volta, tra un mese non ti capisci più.</p>

  <h2>Mossa 2 · Una regola sola per le date</h2>
  <p>Quando prometti una consegna, <b>scrivila nel momento in cui la dici</b>, non dopo. Non «appena finisco qui».<br>
  Se non sai ancora la data, scrivi <em>«da concordare»</em> e cerchiala: così la vedi.</p>

  <h2>Mossa 3 · Un controllo alla settimana, sempre lo stesso giorno</h2>
  <p>Scegli un momento fisso (per esempio il lunedì mattina o il venerdì sera) e per cinque minuti guarda il foglio con una domanda sola:</p>
  <blockquote>Cosa è fermo da troppo tempo?</blockquote>
  <p>Un ordine «aspetto conferma» da dieci giorni, un materiale mai arrivato, un lavoro che sembra dimenticato.<br>
  Se qualcosa è fermo, fai una cosa sola: <b>decidi chi ti serve chiamare e quando</b>, e scrivilo accanto.</p>

  <h2>E a fine giornata: tre domande, due minuti</h2>
  <p>Prima di chiudere, rispondi (anche solo a mente):</p>
  <ol>
    <li><b>Cosa consegno domani?</b></li>
    <li><b>Cosa devo ordinare o chi devo richiamare?</b></li>
    <li><b>Da chi aspetto una risposta?</b></li>
  </ol>
  <p>Poi scrivi sul foglio quello che manca, e dì a te stessa <b>«per oggi ho chiuso»</b>.<br>
  La frase sembra sciocca, ma serve: dà alla testa il permesso di smettere.</p>

  <h2>Se salti un giorno</h2>
  <p>Succede. Non ricominciare da capo: riprendi dal foglio com'è e aggiorna solo quello che è cambiato.</p>

  <p class="r-closing">Questo metodo funziona. Il suo punto debole è che il foglio va aggiornato a mano ogni giorno, e nei periodi pieni è la prima cosa che si salta.
  Se un giorno vorrai una soluzione più efficiente, scrivimi: ti faccio vedere come sarebbe la tua giornata.</p>
  <p class="r-cta r-noprint"><a class="btn btn-amber" data-contact="whatsapp" href="#contenuto" hidden>Scrivimi su WhatsApp</a></p>
  <p class="r-web">Guida offerta da Oltre la Bottega · oltrelabottega.it</p>
</main>

<footer class="wrap foot r-noprint">
  <div class="foot-row"><span>© <span data-year>2026</span> Oltre la Bottega · <span data-site="datiLegali">Dati legali in aggiornamento</span></span></div>
</footer>

<script src="config.js"></script>
<script src="main.js"></script>
<script src="regalo.js"></script>
</body>
</html>
```

- [ ] **Step 4: Eseguire i test del quiz (ora il test dei link ai regali deve passare)**

Run: `node --test site/quiz.test.mjs`
Expected: 7 test PASS, 0 fail.

- [ ] **Step 5: Controllo a mano dei tre regali**

Run: `npx --yes serve site -l 4000`, aprire `/modulo`, `/svuota-la-testa`, `/un-foglio-solo`.
Expected per ognuno: il testo è leggibile, il pulsante "Stampa" apre l'anteprima di stampa; **nell'anteprima non compaiono** logo in alto, pulsante Stampa, piè di pagina e pulsante WhatsApp; il contenuto sta in una pagina A4 (il foglio e il modulo ci devono stare; le guide possono occupare due pagine). Il pulsante "Scrivimi su WhatsApp" compare a schermo nelle due guide. Fermare il server con Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add site/modulo.html site/svuota-la-testa.html site/un-foglio-solo.html
git commit -m "feat(quiz): modulo di presa ordine e due guide stampabili"
```

---

### Task 5: Privacy, esclusioni di pubblicazione e controlli del sito

**Files:**
- Modify: `site/privacy.html`
- Modify: `site/.vercelignore`
- Modify: `site/check.mjs`

- [ ] **Step 1: Aggiornare la privacy**

In `site/privacy.html`, nella lista di "Quali dati tratto", dopo la riga che inizia con `<li>Il sito è ospitato da Vercel` aggiungere:

```html
    <li>Il quiz e i fogli da stampare funzionano nel tuo browser: le risposte non vengono salvate né inviate a nessuno.</li>
```

- [ ] **Step 2: Non pubblicare il file di test**

`site/.vercelignore` diventa:

```
check.mjs
quiz.test.mjs
```

- [ ] **Step 3: Estendere `site/check.mjs`**

Sostituire la riga

```js
for (const page of ["index.html", "privacy.html"]) {
```

con

```js
const landingPages = ["quiz.html", "modulo.html", "svuota-la-testa.html", "un-foglio-solo.html"];
const noindexPages = ["privacy.html", ...landingPages];
for (const page of ["index.html", "privacy.html", ...landingPages]) {
```

e, subito dopo il controllo `// un solo h1` (la riga `ok((html.match(/<h1[\s>]/g) ...`), aggiungere:

```js
  // pagine non indicizzate
  if (noindexPages.includes(page)) {
    ok(/<meta name="robots" content="noindex">/.test(html), `${page}: manca <meta name="robots" content="noindex">`);
  }

  // pagine di atterraggio: nessun menu, nessun link al resto del sito (solo la privacy)
  if (landingPages.includes(page)) {
    ok(!/href="\/"/.test(html), `${page}: pagina di atterraggio, non deve collegare la home`);
    ok(!/href="\/(?!privacy")[^"]*"/.test(html), `${page}: collegamento al sito non ammesso (solo /privacy)`);
  }
```

(Il secondo controllo è volutamente rigoroso: i link interni dei regali stanno nel JS dei dati e non nell'HTML delle pagine, quindi non vengono toccati; qui si ammette solo `/privacy`.)

- [ ] **Step 4: Eseguire il controllo del sito**

Run: `node site/check.mjs`
Expected: `✓ Sito OK`.

Se compare un problema:
- `<title> ... fuori 10-60 caratteri` o `description ... fuori 50-170`: contare i caratteri del testo nella pagina indicata e correggere.
- `riferimento inesistente`: controllare il nome del file in `href`/`src`.

- [ ] **Step 5: Eseguire tutti i test del sito**

Run: `node --test site/quiz.test.mjs`
Expected: 7 test PASS.

- [ ] **Step 6: Commit**

```bash
git add site/privacy.html site/.vercelignore site/check.mjs
git commit -m "feat(quiz): privacy, esclusione del test dalla pubblicazione e controlli del sito"
```

---

### Task 6: Verifica completa e documentazione

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Prova completa a mano su telefono e desktop**

Run: `npx --yes serve site -l 4000` e aprire `http://localhost:4000/quiz` (poi, da telefono sulla stessa rete, `http://<indirizzo-del-computer>:4000/quiz`).

Checklist, per ciascun profilo (rispondere sempre prima / sempre seconda / sempre terza risposta per ottenere i tre risultati: punteggio 0 → "Il banco in ordine", 7 → seconda risposta ovunque → "Il banco con qualche buco", 14 → "Tutto sulle tue spalle"):
- [ ] il risultato mostra il nome giusto e 2 consigli
- [ ] il regalo corrisponde al profilo (modulo / Un foglio solo / Svuota la testa) e si apre in una nuova scheda
- [ ] "Scrivimi su WhatsApp" apre la chat con il messaggio "Buongiorno, ho fatto il quiz e scaricato il foglio…"
- [ ] "Rifai il quiz" riparte dalla prima domanda
- [ ] nessun errore nella console del browser; nessun cookie (Strumenti sviluppatore → Applicazione → Cookie: vuoto)
- [ ] la pagina si legge bene a 390 px di larghezza e non scorre di lato
- [ ] `/quiz` non compare nel menu né nei link di `/` e non è in `sitemap.xml`

Fermare il server con Ctrl+C.

- [ ] **Step 2: Test e controlli finali**

Run:
```bash
node --test site/quiz.test.mjs
node site/check.mjs
```
Expected: 7 test PASS; `✓ Sito OK`.

- [ ] **Step 3: Aggiornare `CLAUDE.md`**

Nella sezione "Piano di rilascio", dopo la riga che inizia con `- **Fase 4** (opzionale)`, aggiungere:

```markdown
- **Pagina di atterraggio `/quiz`** (2026-10-04, costruita nel ramo `feature/sito-vetrina`, non ancora pubblicata): quiz di 7 domande con 3 profili e un regalo stampabile per profilo (modulo di presa ordine per i più organizzati; guide "Un foglio solo" e "Svuota la testa in 10 minuti" per gli altri), senza raccolta dati, `noindex`, non collegata dal menu del sito. Serve per far assaggiare il valore a chi non conosce ancora l'app; pubblicità a pagamento volutamente non decisa (zona o tutta Italia ancora aperta). Titolo "Quanto tieni a mente?", soglie e nomi dei profili sono provvisori fino alla prova con una titolare vera. Design in `docs/superpowers/specs/2026-10-04-quiz-landing-design.md`, piano in `docs/superpowers/plans/2026-10-04-quiz-landing-plan.md`, testi delle guide in `docs/quiz/`
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: pagina di atterraggio /quiz nel piano di rilascio"
```

---

## Self-Review

**Copertura dello spec**
- Pagina separata `/quiz`, senza menu, unica uscita l'invito: Task 2 (HTML senza nav; solo "Privacy" nel piè di pagina, verificato da `check.mjs`).
- 7 domande (4 situazioni + 3 sensazioni), 0/1/2 punti, 3 profili con consigli brevi: Task 1.
- Regalo per profilo, modulo solo per 0-4: Task 1 (dati + test "solo il profilo più organizzato riceve il modulo") e Task 4.
- Nessun dato richiesto, nessun tracciamento: nessun form, nessun pixel; privacy aggiornata in Task 5.
- Invito finale WhatsApp con messaggio preimpostato (non "mandami il risultato"): `messaggioQuiz` in Task 1, bottone in Task 2.
- `noindex`, fuori da `sitemap.xml`: meta in ogni pagina, `sitemap.xml` non toccato, controllo in `check.mjs` (Task 5).
- CSP (niente script/stili inline): tutto in file esterni; `check.mjs` già verifica inline.
- Funzione pura del punteggio testabile: Task 1.
- Punti aperti dello spec rimasti aperti di proposito: titolo, soglie, misura degli arrivi, validazione con una titolare, annunci.

**Nota sul messaggio WhatsApp:** lo spec scrive "scaricato il modulo"; il messaggio reale dice "scaricato il foglio" perché il regalo cambia con il profilo.

**Coerenza dei nomi:** `window.QUIZ` con `domande`, `profili`, `calcolaPunteggio`, `profiloPer`; `regalo.href` = `/modulo`, `/un-foglio-solo`, `/svuota-la-testa` e i file `modulo.html`, `un-foglio-solo.html`, `svuota-la-testa.html`; id usati in `quiz.js` (`q-inizio`, `q-domanda`, `q-risultato`, `q-prog`, `q-testo`, `q-ans`, `r-nome`, `r-intro`, `r-consigli`, `r-regalo-titolo`, `r-regalo-testo`, `r-regalo-link`, `r-wa`, `r-ripeti`, `q-start`) corrispondono tutti a `quiz.html`.

**Una correzione al testo rispetto al brief:** nella domanda 6 la risposta scritta da Olga era "a volte vengono rimandate a dopo" (riferita a "lavori", maschile): nel codice è "rimandati".
