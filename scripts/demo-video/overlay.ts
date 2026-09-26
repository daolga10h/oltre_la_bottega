// Codice iniettato in ogni pagina del video (context.addInitScript): disegna un
// cursore ben visibile, un cerchio che si allarga a ogni clic e la barra delle
// didascalie in basso. Gli elementi si ricreano a ogni caricamento di pagina;
// posizione del cursore e didascalia corrente sopravvivono alla navigazione
// grazie a sessionStorage. Disattiva anche window.print (il foglio lavoro la
// chiama da solo e aprirebbe la finestra di stampa).
export const OVERLAY_SCRIPT = String.raw`
(() => {
  window.print = () => {};

  const ID_CURSORE = "__demo-cursore";
  const ID_DIDASCALIA = "__demo-didascalia";
  const CHIAVE_POS = "__demoCursore";
  const CHIAVE_TESTO = "__demoDidascalia";

  const leggi = (chiave) => { try { return sessionStorage.getItem(chiave); } catch { return null; } };
  const scrivi = (chiave, valore) => {
    try {
      if (valore === null) sessionStorage.removeItem(chiave);
      else sessionStorage.setItem(chiave, valore);
    } catch {}
  };

  let pos = null;
  try { pos = JSON.parse(leggi(CHIAVE_POS) || "null"); } catch {}

  const radice = () => document.body || document.documentElement;

  function cursore() {
    let el = document.getElementById(ID_CURSORE);
    if (!el && radice()) {
      el = document.createElement("div");
      el.id = ID_CURSORE;
      el.style.cssText = "position:fixed;left:0;top:0;width:32px;height:32px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));";
      el.innerHTML = '<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M4 2 L4 26 L10.5 20 L15 30 L19.5 28 L15 18.5 L24 18.5 Z" fill="#1a1a1a" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/></svg>';
      radice().appendChild(el);
    }
    if (el && pos) el.style.transform = "translate(" + pos.x + "px," + pos.y + "px)";
    return el;
  }

  function didascalia() {
    let el = document.getElementById(ID_DIDASCALIA);
    if (!el && radice()) {
      el = document.createElement("div");
      el.id = ID_DIDASCALIA;
      el.style.cssText = [
        "position:fixed", "left:0", "right:0", "bottom:28px", "margin:0 auto",
        "width:fit-content", "max-width:90%", "box-sizing:border-box", "padding:14px 30px", "border-radius:16px",
        "background:#3b2716", "color:#f2e4c9", "font:500 26px/1.35 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif",
        "text-align:center", "box-shadow:0 6px 24px rgba(0,0,0,.35)", "z-index:2147483646",
        "pointer-events:none", "opacity:0", "transition:opacity .35s ease", "white-space:normal",
      ].join(";");
      radice().appendChild(el);
      const testo = leggi(CHIAVE_TESTO);
      if (testo) { el.textContent = testo; el.style.opacity = "1"; }
    }
    return el;
  }

  function cerchio(x, y) {
    if (!radice()) return;
    const c = document.createElement("div");
    c.style.cssText = "position:fixed;left:" + (x - 22) + "px;top:" + (y - 22) + "px;width:44px;height:44px;border-radius:50%;border:4px solid #e89b01;background:rgba(232,155,1,.25);z-index:2147483645;pointer-events:none;transform:scale(.3);opacity:1;transition:transform .5s ease-out,opacity .5s ease-out;";
    radice().appendChild(c);
    requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transform = "scale(1.4)"; c.style.opacity = "0"; }));
    setTimeout(() => c.remove(), 650);
  }

  let timerCambio = null;
  window.__setCaption = (testo) => {
    scrivi(CHIAVE_TESTO, testo);
    const el = didascalia();
    if (!el) return;
    clearTimeout(timerCambio);
    if (!testo) { el.style.opacity = "0"; return; }
    if (el.style.opacity === "1" && el.textContent !== testo) {
      el.style.opacity = "0";
      timerCambio = setTimeout(() => { el.textContent = testo; el.style.opacity = "1"; }, 350);
    } else {
      el.textContent = testo;
      el.style.opacity = "1";
    }
  };
  window.__ripple = (x, y) => cerchio(x, y);

  document.addEventListener("mousemove", (e) => {
    pos = { x: e.clientX, y: e.clientY };
    scrivi(CHIAVE_POS, JSON.stringify(pos));
    cursore();
  }, true);
  document.addEventListener("mousedown", (e) => cerchio(e.clientX, e.clientY), true);

  // Spazio in fondo al modulo del nuovo ordine: la barra delle didascalie non
  // copre il pulsante "Crea ordine". Solo lì: altrove si vedrebbe la fine
  // del menu laterale.
  function spazioInFondo() {
    const esistente = document.getElementById("__demo-spazio");
    const serve = location.pathname === "/orders/new";
    if (!serve) { if (esistente) esistente.remove(); return; }
    if (esistente || !document.head) return;
    const stile = document.createElement("style");
    stile.id = "__demo-spazio";
    stile.textContent = "body::after{content:\"\";display:block;flex:none;height:140px}";
    document.head.appendChild(stile);
  }

  function prepara() { spazioInFondo(); cursore(); didascalia(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", prepara);
  else prepara();
  // Rete di sicurezza: se React ricostruisce il body, gli elementi tornano.
  setInterval(prepara, 500);
})();
`
