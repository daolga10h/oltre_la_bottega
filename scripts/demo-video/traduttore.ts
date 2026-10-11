// Codice iniettato in ogni pagina (context.addInitScript) quando le riprese sono
// in russo: sostituisce i testi italiani dell'app con quelli del dizionario, e
// continua a farlo quando la pagina cambia (React ridisegna, si aprono menu...).
// L'app non viene toccata: la traduzione esiste solo nella pagina ripresa.
// Dizionario e regole: src/lib/demo/traduzioneRu.ts
import { CODICE_TRADUTTORE, DIZIONARIO_RU, REGOLE_RU } from "../../src/lib/demo/traduzioneRu"

export function traduttoreScript(): string {
  return `
(() => {
  ${CODICE_TRADUTTORE}
  const traduci = creaTraduttore(${JSON.stringify(DIZIONARIO_RU)}, ${JSON.stringify(REGOLE_RU)});
  const ATTRIBUTI = ["placeholder", "title", "aria-label"];

  function testo(nodo) {
    const v = nodo.nodeValue;
    if (!v) return;
    const t = traduci(v);
    if (t !== v) nodo.nodeValue = t;
  }
  function attributi(el) {
    for (const a of ATTRIBUTI) {
      const v = el.getAttribute && el.getAttribute(a);
      if (!v) continue;
      const t = traduci(v);
      if (t !== v) el.setAttribute(a, t);
    }
  }
  function tutto(radice) {
    if (radice.nodeType === 3) { testo(radice); return; }
    if (radice.nodeType !== 1) return;
    const tag = radice.tagName;
    if (tag === "SCRIPT" || tag === "STYLE") return;
    attributi(radice);
    const w = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const p = n.parentElement;
      if (p && (p.tagName === "SCRIPT" || p.tagName === "STYLE")) continue;
      testo(n);
    }
    radice.querySelectorAll("[placeholder],[title],[aria-label]").forEach(attributi);
  }

  new MutationObserver((mutazioni) => {
    for (const m of mutazioni) {
      if (m.type === "childList") m.addedNodes.forEach(tutto);
      else if (m.type === "characterData") testo(m.target);
      else if (m.type === "attributes") attributi(m.target);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTI });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => tutto(document.documentElement));
  else tutto(document.documentElement);
})();
`
}
