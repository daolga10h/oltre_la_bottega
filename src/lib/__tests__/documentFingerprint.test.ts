import { documentFingerprint, fileFingerprint } from "../documentFingerprint"
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

  it("non cambia se cambiano quantità, prezzi, sconti o importi", () => {
    const base = documentFingerprint(doc)
    const conRiga = (patch: object) => ({ ...doc, righe: [{ ...doc.righe[0], ...patch }, doc.righe[1]] })
    expect(documentFingerprint(conRiga({ quantita: 51 }))).toBe(base)
    expect(documentFingerprint(conRiga({ prezzo: 4.7 }))).toBe(base)
    expect(documentFingerprint(conRiga({ sconti: [10] }))).toBe(base)
    expect(documentFingerprint(conRiga({ importo: 999 }))).toBe(base)
  })

  it("non cambia se il fornitore è scritto più lungo", () => {
    const corto = { ...doc, fornitore: "Munari" }
    const lungo = { ...doc, fornitore: "Munari snc di Munari Pier Domenico & C." }
    expect(documentFingerprint(lungo)).toBe(documentFingerprint(corto))
  })

  it("cambia se cambia la data, un codice o la prima parola del fornitore", () => {
    const base = documentFingerprint(doc)
    expect(documentFingerprint({ ...doc, data: "2026-06-18" })).not.toBe(base)
    expect(documentFingerprint({ ...doc, righe: [doc.righe[0]] })).not.toBe(base)
    expect(documentFingerprint({ ...doc, righe: [...doc.righe, { ...doc.righe[0], codice: "999999" }] })).not.toBe(base)
    expect(documentFingerprint({ ...doc, fornitore: "Altro GmbH" })).not.toBe(base)
  })

  it("gestisce quantità e importo mancanti e un documento senza righe", () => {
    expect(documentFingerprint({ fornitore: "X", data: null, righe: [] })).toMatch(/^[0-9a-f]{64}$/)
    const senza = { ...doc, righe: [{ ...doc.righe[0], quantita: null, importo: null }] }
    expect(documentFingerprint(senza)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe("fileFingerprint", () => {
  it("stessi byte, stessa impronta esadecimale di 64 caratteri", () => {
    const a = fileFingerprint(new Uint8Array([1, 2, 3]))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(fileFingerprint(new Uint8Array([1, 2, 3]))).toBe(a)
  })

  it("un byte diverso dà un'impronta diversa", () => {
    expect(fileFingerprint(new Uint8Array([1, 2, 3]))).not.toBe(fileFingerprint(new Uint8Array([1, 2, 4])))
  })
})
