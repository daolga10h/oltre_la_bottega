import { CONTATTO_WHATSAPP, SCENE, tempoLettura, tempoInScena, durataPianificata } from "../videoScenes"

const tutteLeDidascalie = () => SCENE.flatMap((s) => s.didascalie)

describe("scene del video dimostrativo", () => {
  it("sono nell'ordine previsto dal design", () => {
    expect(SCENE.map((s) => s.id)).toEqual([
      "apertura",
      "oggi",
      "nuovo-ordine",
      "bacheca",
      "avvisa",
      "foglio",
      "clienti",
      "chiusura",
    ])
  })

  it("ogni scena ha almeno una didascalia", () => {
    for (const scena of SCENE) expect(scena.didascalie.length).toBeGreaterThan(0)
  })

  it("ogni didascalia è non vuota e non più lunga di 95 caratteri", () => {
    for (const d of tutteLeDidascalie()) {
      expect(d.testo.trim().length).toBeGreaterThan(0)
      expect(d.testo.length).toBeLessThanOrEqual(95)
      expect(d.secondiExtra).toBeGreaterThanOrEqual(0)
    }
  })

  it("il numero WhatsApp compare solo nell'ultima didascalia", () => {
    const didascalie = tutteLeDidascalie()
    const ultima = didascalie[didascalie.length - 1]
    expect(ultima.testo).toContain(CONTATTO_WHATSAPP)
    for (const d of didascalie.slice(0, -1)) expect(d.testo).not.toContain(CONTATTO_WHATSAPP)
  })

  it("la durata pianificata sta tra 120 e 200 secondi", () => {
    const totale = durataPianificata()
    expect(totale).toBeGreaterThanOrEqual(120)
    expect(totale).toBeLessThanOrEqual(200)
  })

  it("la durata pianificata è la somma dei tempi in scena", () => {
    const somma = tutteLeDidascalie().reduce((acc, d) => acc + tempoInScena(d), 0)
    expect(durataPianificata()).toBeCloseTo(somma, 5)
  })
})

describe("tempoLettura", () => {
  it("è circa 15 caratteri al secondo più 1,2 secondi di pausa", () => {
    expect(tempoLettura("x".repeat(60))).toBeCloseTo(60 / 15 + 1.2, 5)
  })

  it("non scende sotto 2,5 secondi", () => {
    expect(tempoLettura("Ciao")).toBe(2.5)
    expect(tempoLettura("")).toBe(2.5)
  })
})

describe("tempoInScena", () => {
  it("aggiunge al tempo di lettura i secondi extra della didascalia", () => {
    const testo = "x".repeat(45)
    expect(tempoInScena({ testo, secondiExtra: 4 })).toBeCloseTo(tempoLettura(testo) + 4, 5)
  })
})
