import { documentFingerprint } from "../documentFingerprint"
import type { DocumentoLetto } from "../documentoFornitore"

const doc: DocumentoLetto = {
  fornitore: "Trodat GmbH",
  data: "2026-06-17",
  righe: [
    { codice: "111383", nome: "8913 IMPRINT 2.0, NERO", unita: "PZ", quantita: 50, prezzo: 4.65, sconti: [], importo: 232.5 },
    { codice: "111640", nome: "8913 IMPRINT 2.0, BLU", unita: "PZ", quantita: 50, prezzo: 4.65, sconti: [], importo: 232.5 },
  ],
}

describe("documentFingerprint", () => {
  it("è un SHA-256 esadecimale", () => {
    expect(documentFingerprint(doc)).toMatch(/^[0-9a-f]{64}$/)
  })

  it("lo stesso documento dà sempre la stessa impronta", () => {
    expect(documentFingerprint(doc)).toBe(documentFingerprint({ ...doc, righe: [...doc.righe] }))
  })

  it("non dipende dall'ordine delle righe", () => {
    expect(documentFingerprint(doc)).toBe(documentFingerprint({ ...doc, righe: [...doc.righe].reverse() }))
  })

  it("non dipende da maiuscole e spazi in fornitore, codice e nome", () => {
    const quasi: DocumentoLetto = {
      ...doc,
      fornitore: "  trodat   gmbh ",
      righe: doc.righe.map((r) => ({ ...r, nome: `  ${r.nome.toLowerCase()} `, codice: ` ${r.codice} ` })),
    }
    expect(documentFingerprint(quasi)).toBe(documentFingerprint(doc))
  })

  it("con lo stesso codice il nome scritto in modo diverso non cambia l'impronta", () => {
    const altroNome: DocumentoLetto = { ...doc, righe: doc.righe.map((r) => ({ ...r, nome: `${r.nome} (nuovo)` })) }
    expect(documentFingerprint(altroNome)).toBe(documentFingerprint(doc))
  })

  it("senza codice conta il nome", () => {
    const senzaCodice = (nome: string): DocumentoLetto => ({ ...doc, righe: [{ ...doc.righe[0], codice: null, nome }] })
    expect(documentFingerprint(senzaCodice("Timbro A"))).not.toBe(documentFingerprint(senzaCodice("Timbro B")))
  })

  it("cambia se cambia una quantità, un prezzo, uno sconto o la data", () => {
    const base = documentFingerprint(doc)
    const conRiga = (patch: object) => ({ ...doc, righe: [{ ...doc.righe[0], ...patch }, doc.righe[1]] })
    expect(documentFingerprint(conRiga({ quantita: 51 }))).not.toBe(base)
    expect(documentFingerprint(conRiga({ prezzo: 4.7 }))).not.toBe(base)
    expect(documentFingerprint(conRiga({ sconti: [10] }))).not.toBe(base)
    expect(documentFingerprint({ ...doc, data: "2026-06-18" })).not.toBe(base)
  })

  it("gestisce quantità e importo mancanti e un documento senza righe", () => {
    expect(documentFingerprint({ fornitore: "X", data: null, righe: [] })).toMatch(/^[0-9a-f]{64}$/)
    const senza = { ...doc, righe: [{ ...doc.righe[0], quantita: null, importo: null }] }
    expect(documentFingerprint(senza)).toMatch(/^[0-9a-f]{64}$/)
  })
})
