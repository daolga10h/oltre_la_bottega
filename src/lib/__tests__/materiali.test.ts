import {
  normalizeText,
  matchMaterial,
  applyPriceUpdate,
  checkRow,
  priceVariation,
  classifyRow,
  parsePrice,
  formatPrezzo,
  matchesSearch,
  isValidIsoDate,
  todayIso,
  netPrice,
  round3,
  parseDiscounts,
  formatDiscounts,
  type Materiale,
} from "../materiali"

const base: Materiale = {
  id: "m1",
  fornitore: "FB Targhe",
  codice: "003553",
  nome: "Targa 003 Tutta Silver 20x15",
  unita: "Nr.",
  prezzo_attuale: 14.38,
  data_acquisto_attuale: "2025-10-29",
  prezzo_precedente: null,
  data_acquisto_precedente: null,
}

describe("normalizeText", () => {
  it("toglie maiuscole e spazi in eccesso", () => {
    expect(normalizeText("  FB   Targhe ")).toBe("fb targhe")
  })

  it("trasforma null e undefined in stringa vuota", () => {
    expect(normalizeText(null)).toBe("")
    expect(normalizeText(undefined)).toBe("")
  })
})

describe("matchMaterial", () => {
  it("abbina per fornitore + codice ignorando maiuscole e spazi", () => {
    const trovato = matchMaterial([base], " fb  targhe ", { codice: " 003553", nome: "altro nome" })
    expect(trovato?.id).toBe("m1")
  })

  it("non abbina lo stesso codice di un altro fornitore", () => {
    expect(matchMaterial([base], "Altro Fornitore", { codice: "003553", nome: base.nome })).toBeNull()
  })

  it("non abbina un codice diverso anche se il nome è uguale, quando il materiale ha già un codice", () => {
    expect(matchMaterial([base], "FB Targhe", { codice: "999999", nome: base.nome })).toBeNull()
  })

  it("abbina per nome se il materiale salvato non ha codice e la riga ne porta uno", () => {
    const senzaCodice: Materiale = { ...base, codice: null }
    expect(matchMaterial([senzaCodice], "FB Targhe", { codice: "003553", nome: base.nome })?.id).toBe("m1")
  })

  it("senza codice sulla riga abbina per nome", () => {
    expect(matchMaterial([base], "FB Targhe", { codice: null, nome: "TARGA 003  tutta silver 20x15" })?.id).toBe("m1")
  })

  it("senza codice e con nome diverso non abbina", () => {
    expect(matchMaterial([base], "FB Targhe", { codice: null, nome: "Targa 011" })).toBeNull()
  })
})

describe("applyPriceUpdate", () => {
  it("stesso prezzo e data più recente: avanza solo la data attuale, il precedente non cambia", () => {
    const m = { ...base, prezzo_precedente: 13.9, data_acquisto_precedente: "2025-05-12" }
    const r = applyPriceUpdate(m, { prezzo: 14.38, data: "2025-12-01" })
    expect(r.prezzo_attuale).toBe(14.38)
    expect(r.data_acquisto_attuale).toBe("2025-12-01")
    expect(r.prezzo_precedente).toBe(13.9)
    expect(r.data_acquisto_precedente).toBe("2025-05-12")
  })

  it("prezzo diverso e data più recente: l'attuale diventa precedente", () => {
    const r = applyPriceUpdate(base, { prezzo: 15.1, data: "2026-01-10" })
    expect(r).toEqual({
      prezzo_attuale: 15.1,
      data_acquisto_attuale: "2026-01-10",
      prezzo_precedente: 14.38,
      data_acquisto_precedente: "2025-10-29",
    })
  })

  it("prezzo diverso nello stesso giorno: l'attuale diventa precedente", () => {
    const r = applyPriceUpdate(base, { prezzo: 15, data: "2025-10-29" })
    expect(r.prezzo_attuale).toBe(15)
    expect(r.prezzo_precedente).toBe(14.38)
  })

  it("stesso prezzo e stessa data: nessuna modifica", () => {
    expect(applyPriceUpdate(base, { prezzo: 14.38, data: "2025-10-29" })).toEqual({
      prezzo_attuale: 14.38,
      data_acquisto_attuale: "2025-10-29",
      prezzo_precedente: null,
      data_acquisto_precedente: null,
    })
  })

  it("considera uguali prezzi che differiscono meno di mezzo millesimo", () => {
    const r = applyPriceUpdate(base, { prezzo: 14.3800001, data: "2025-10-29" })
    expect(r.prezzo_precedente).toBeNull()
  })

  it("data più vecchia e nessun precedente: il prezzo entra come precedente, l'attuale resta", () => {
    const r = applyPriceUpdate(base, { prezzo: 13.5, data: "2025-03-01" })
    expect(r.prezzo_attuale).toBe(14.38)
    expect(r.data_acquisto_attuale).toBe("2025-10-29")
    expect(r.prezzo_precedente).toBe(13.5)
    expect(r.data_acquisto_precedente).toBe("2025-03-01")
  })

  it("data più vecchia ma meno recente del precedente già presente: nessuna modifica", () => {
    const m = { ...base, prezzo_precedente: 13.9, data_acquisto_precedente: "2025-06-01" }
    expect(applyPriceUpdate(m, { prezzo: 12, data: "2025-02-01" })).toEqual({
      prezzo_attuale: 14.38,
      data_acquisto_attuale: "2025-10-29",
      prezzo_precedente: 13.9,
      data_acquisto_precedente: "2025-06-01",
    })
  })

  it("data più vecchia dell'attuale ma più recente del precedente: sostituisce il precedente", () => {
    const m = { ...base, prezzo_precedente: 13.9, data_acquisto_precedente: "2025-03-01" }
    const r = applyPriceUpdate(m, { prezzo: 14.1, data: "2025-08-01" })
    expect(r.prezzo_precedente).toBe(14.1)
    expect(r.data_acquisto_precedente).toBe("2025-08-01")
    expect(r.prezzo_attuale).toBe(14.38)
  })

  it("data più vecchia con prezzo uguale all'attuale: nessuna modifica", () => {
    const r = applyPriceUpdate(base, { prezzo: 14.38, data: "2025-03-01" })
    expect(r.prezzo_precedente).toBeNull()
  })
})

describe("checkRow", () => {
  it("true quando quantità × prezzo coincide con l'importo", () => {
    expect(checkRow({ quantita: 10, prezzo: 14.38, importo: 143.8 })).toBe(true)
    expect(checkRow({ quantita: 5, prezzo: 23.05, importo: 115.25 })).toBe(true)
  })

  it("false quando non coincide", () => {
    expect(checkRow({ quantita: 10, prezzo: 14.38, importo: 150 })).toBe(false)
  })

  it("tollera un centesimo di differenza ma non cinque", () => {
    expect(checkRow({ quantita: 10, prezzo: 14.381, importo: 143.8 })).toBe(true)
    expect(checkRow({ quantita: 10, prezzo: 14.38, importo: 143.85 })).toBe(false)
  })

  it("true quando mancano quantità o importo (nulla da controllare)", () => {
    expect(checkRow({ quantita: null, prezzo: 14.38, importo: 143.8 })).toBe(true)
    expect(checkRow({ quantita: 10, prezzo: 14.38, importo: null })).toBe(true)
  })
})

describe("priceVariation", () => {
  it("calcola la variazione percentuale con segno", () => {
    expect(priceVariation(15.1, 14.38)).toBeCloseTo(5.007, 2)
    expect(priceVariation(13, 14.38)).toBeCloseTo(-9.597, 2)
  })

  it("null se manca il precedente o è zero", () => {
    expect(priceVariation(15, null)).toBeNull()
    expect(priceVariation(15, 0)).toBeNull()
  })
})

describe("classifyRow", () => {
  const riga = { codice: "003553", nome: base.nome, unita: "Nr.", quantita: 10, prezzo: 14.38, importo: 143.8 }

  it("nuovo se non esiste ancora", () => {
    expect(classifyRow([], "FB Targhe", riga)).toEqual({ tipo: "nuovo" })
  })

  it("invariato se il prezzo è uguale all'attuale", () => {
    expect(classifyRow([base], "FB Targhe", riga)).toEqual({ tipo: "invariato" })
  })

  it("variato (con il prezzo di prima) se il prezzo è diverso", () => {
    expect(classifyRow([base], "FB Targhe", { ...riga, prezzo: 15.1 })).toEqual({ tipo: "variato", era: 14.38 })
  })
})

describe("parsePrice", () => {
  it("legge virgola e punto decimale", () => {
    expect(parsePrice("14,380")).toBeCloseTo(14.38, 5)
    expect(parsePrice("14.38")).toBeCloseTo(14.38, 5)
  })

  it("legge il formato italiano con le migliaia", () => {
    expect(parsePrice("1.234,56")).toBeCloseTo(1234.56, 5)
  })

  it("ignora spazi e simbolo dell'euro", () => {
    expect(parsePrice(" € 14,38 ")).toBeCloseTo(14.38, 5)
  })

  it("null per vuoto, testo o negativo", () => {
    expect(parsePrice("")).toBeNull()
    expect(parsePrice("abc")).toBeNull()
    expect(parsePrice("-3")).toBeNull()
  })
})

describe("formatPrezzo", () => {
  it("mostra almeno due decimali e al massimo tre, con la virgola", () => {
    expect(formatPrezzo(14.38)).toBe("14,38")
    expect(formatPrezzo(14.375)).toBe("14,375")
    expect(formatPrezzo(5)).toBe("5,00")
    expect(formatPrezzo(0.5)).toBe("0,50")
  })
})

describe("matchesSearch", () => {
  it("cerca in fornitore, codice e nome senza badare a maiuscole", () => {
    expect(matchesSearch(base, "fb")).toBe(true)
    expect(matchesSearch(base, "003553")).toBe(true)
    expect(matchesSearch(base, "SILVER")).toBe(true)
    expect(matchesSearch(base, "ottone")).toBe(false)
  })

  it("ricerca vuota: true", () => {
    expect(matchesSearch(base, "  ")).toBe(true)
  })
})

describe("isValidIsoDate", () => {
  it("accetta solo date vere in formato AAAA-MM-GG", () => {
    expect(isValidIsoDate("2025-10-29")).toBe(true)
    expect(isValidIsoDate("2025-13-45")).toBe(false)
    expect(isValidIsoDate("2025-02-30")).toBe(false)
    expect(isValidIsoDate("29/10/2025")).toBe(false)
    expect(isValidIsoDate("")).toBe(false)
  })
})

describe("todayIso", () => {
  it("usa il calendario di Roma, non quello UTC", () => {
    // 22:30 UTC del 24 ottobre 2026 = 00:30 del 25 a Roma (ora legale ancora attiva)
    expect(todayIso(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-25")
    expect(todayIso(new Date("2026-10-24T12:00:00Z"))).toBe("2026-10-24")
  })
})

describe("netPrice", () => {
  it("senza sconti il netto è il listino", () => {
    expect(netPrice(22.02, [])).toBeCloseTo(22.02, 6)
  })

  it("applica gli sconti a cascata (foglio Munari: 50% poi 20%)", () => {
    expect(netPrice(22.02, [50, 20])).toBeCloseTo(8.808, 6)
    expect(netPrice(32.58, [50, 20])).toBeCloseTo(13.032, 6)
    expect(netPrice(49.87, [50, 20])).toBeCloseTo(19.948, 6)
  })

  it("lo sconto singolo e quello in più voci di uguale effetto danno lo stesso netto", () => {
    expect(netPrice(100, [10, 10])).toBeCloseTo(81, 6)
    expect(netPrice(100, [19])).toBeCloseTo(81, 6)
  })

  it("con il netto i conti tornano sul foglio Munari", () => {
    expect(checkRow({ quantita: 10, prezzo: netPrice(22.02, [50, 20]), importo: 88.08 })).toBe(true)
    expect(checkRow({ quantita: 2, prezzo: netPrice(32.58, [50, 20]), importo: 26.06 })).toBe(true)
    expect(checkRow({ quantita: 2, prezzo: netPrice(65.72, [50, 20]), importo: 52.58 })).toBe(true)
    expect(checkRow({ quantita: 2, prezzo: netPrice(44.65, [50, 20]), importo: 35.72 })).toBe(true)
    expect(checkRow({ quantita: 2, prezzo: netPrice(49.87, [50, 20]), importo: 39.9 })).toBe(true)
  })
})

describe("round3", () => {
  it("arrotonda a tre decimali", () => {
    expect(round3(8.8080001)).toBe(8.808)
    expect(round3(19.9484)).toBe(19.948)
    expect(round3(19.9486)).toBe(19.949)
  })
})

describe("parseDiscounts", () => {
  it("vuoto: nessuno sconto", () => {
    expect(parseDiscounts("")).toEqual([])
    expect(parseDiscounts("   ")).toEqual([])
  })

  it("legge uno o più sconti separati da +, /, ; o spazi", () => {
    expect(parseDiscounts("50")).toEqual([50])
    expect(parseDiscounts("50+20")).toEqual([50, 20])
    expect(parseDiscounts("50 + 20")).toEqual([50, 20])
    expect(parseDiscounts("50 20")).toEqual([50, 20])
    expect(parseDiscounts("50/20")).toEqual([50, 20])
  })

  it("la virgola è il decimale, non un separatore", () => {
    expect(parseDiscounts("12,5")).toEqual([12.5])
    expect(parseDiscounts("12,5+10")).toEqual([12.5, 10])
  })

  it("ignora il simbolo % e gli sconti a zero", () => {
    expect(parseDiscounts("50% + 20%")).toEqual([50, 20])
    expect(parseDiscounts("0")).toEqual([])
  })

  it("null se qualcosa non è un numero tra 0 e 100", () => {
    expect(parseDiscounts("abc")).toBeNull()
    expect(parseDiscounts("50+x")).toBeNull()
    expect(parseDiscounts("-5")).toBeNull()
    expect(parseDiscounts("120")).toBeNull()
  })
})

describe("formatDiscounts", () => {
  it("scrive gli sconti separati da + con la virgola decimale", () => {
    expect(formatDiscounts([])).toBe("")
    expect(formatDiscounts([50])).toBe("50")
    expect(formatDiscounts([50, 20])).toBe("50 + 20")
    expect(formatDiscounts([12.5, 10])).toBe("12,5 + 10")
  })
})
