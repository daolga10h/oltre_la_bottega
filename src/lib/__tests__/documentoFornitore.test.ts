import { parseExtraction, SUPPORTED_MEDIA_TYPES, MAX_FILE_BYTES } from "../documentoFornitore"

describe("costanti", () => {
  it("ammette PDF e immagini comuni", () => {
    expect(SUPPORTED_MEDIA_TYPES).toEqual(["application/pdf", "image/jpeg", "image/png", "image/webp"])
  })

  it("il limite sta sotto i 4,5 MB delle richieste Vercel", () => {
    expect(MAX_FILE_BYTES).toBeLessThan(4.5 * 1024 * 1024)
  })
})

describe("parseExtraction", () => {
  const valido = {
    fornitore: "F.B. s.n.c. di Busato Martino e Matteo",
    data: "2025-10-29",
    righe: [
      { codice: "003553", nome: "Targa 003 Tutta Silver 20x15", unita: "Nr.", quantita: 10, prezzo: 14.38, importo: 143.8 },
      { codice: "011502", nome: "Targa 011 Silver 17x12 cm", unita: "Nr.", quantita: 5, prezzo: 10.86, importo: 54.3 },
    ],
  }

  it("restituisce fornitore, data e righe quando tutto è corretto", () => {
    expect(parseExtraction(valido)).toEqual(valido)
  })

  it("scarta le righe senza nome o senza prezzo valido", () => {
    const r = parseExtraction({
      ...valido,
      righe: [
        { codice: "1", nome: "", prezzo: 5 },
        { codice: "2", nome: "Senza prezzo" },
        { codice: "3", nome: "Prezzo testo", prezzo: "5" },
        { codice: "4", nome: "Prezzo negativo", prezzo: -1 },
        { codice: "5", nome: "Buona", prezzo: 5 },
        "non un oggetto",
        null,
      ],
    })
    expect(r.righe).toHaveLength(1)
    expect(r.righe[0].nome).toBe("Buona")
  })

  it("trasforma campi mancanti o vuoti in null", () => {
    const r = parseExtraction({ fornitore: "X", data: null, righe: [{ nome: "A", prezzo: 1, codice: "  ", unita: "" }] })
    expect(r.righe[0]).toEqual({ codice: null, nome: "A", unita: null, quantita: null, prezzo: 1, importo: null })
  })

  it("accetta un codice scritto come numero", () => {
    const r = parseExtraction({ fornitore: "X", righe: [{ nome: "A", prezzo: 1, codice: 3553 }] })
    expect(r.righe[0].codice).toBe("3553")
  })

  it("data non valida diventa null", () => {
    expect(parseExtraction({ ...valido, data: "29/10/2025" }).data).toBeNull()
    expect(parseExtraction({ ...valido, data: "2025-13-45" }).data).toBeNull()
  })

  it("input non utilizzabile: documento vuoto", () => {
    const vuoto = { fornitore: "", data: null, righe: [] }
    expect(parseExtraction(null)).toEqual(vuoto)
    expect(parseExtraction("testo")).toEqual(vuoto)
    expect(parseExtraction({ righe: "no" })).toEqual(vuoto)
  })
})
