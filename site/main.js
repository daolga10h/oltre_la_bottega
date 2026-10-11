// Riempie testi e link a partire da config.js. Senza JS la pagina resta leggibile
// con i testi di partenza; i contatti però richiedono JS.
(function () {
  var cfg = window.SITE || {};

  var nodes = document.querySelectorAll("[data-site]");
  for (var i = 0; i < nodes.length; i++) {
    var value = cfg[nodes[i].getAttribute("data-site")];
    if (typeof value === "string" && value.replace(/\s/g, "") !== "") {
      var parts = value.split("\n\n");
      nodes[i].textContent = parts[0];
      nodes[i].removeAttribute("hidden");
      // Testo su più paragrafi: gli altri seguono come <p> separati
      var last = nodes[i];
      for (var k = 1; k < parts.length; k++) {
        var extra = last.cloneNode(false);
        extra.removeAttribute("data-site");
        extra.textContent = parts[k];
        last.parentNode.insertBefore(extra, last.nextSibling);
        last = extra;
      }
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
