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
