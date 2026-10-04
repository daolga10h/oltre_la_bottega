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
