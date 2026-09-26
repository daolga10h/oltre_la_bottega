import {
  parsePlan,
  getPlan,
  hasFeature,
  statusOrderForPlan,
  resolvePrintFormat,
  type Feature,
} from "../plan"
import { STATUS_ORDER } from "../orderConstants"

const ALL_FEATURES: Feature[] = [
  "multi_riga",
  "ente",
  "materiale",
  "bozza_grafica",
  "campi_avanzati",
  "elenco_ordini",
  "operatore",
  "da_incassare",
  "riepilogo",
  "etichetta_termica",
  "calcolatrice",
]

describe("parsePlan", () => {
  it("riconosce 'base'", () => {
    expect(parsePlan("base")).toBe("base")
  })

  it("ignora maiuscole e spazi", () => {
    expect(parsePlan("  BASE ")).toBe("base")
  })

  it("ripiega su 'completo' se manca la variabile", () => {
    expect(parsePlan(undefined)).toBe("completo")
    expect(parsePlan("")).toBe("completo")
  })

  it("ripiega su 'completo' per valori non riconosciuti", () => {
    expect(parsePlan("premium")).toBe("completo")
    expect(parsePlan("completo")).toBe("completo")
  })
})

describe("getPlan", () => {
  const original = process.env.NEXT_PUBLIC_PLAN

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_PLAN
    else process.env.NEXT_PUBLIC_PLAN = original
  })

  it("legge NEXT_PUBLIC_PLAN", () => {
    process.env.NEXT_PUBLIC_PLAN = "base"
    expect(getPlan()).toBe("base")
  })

  it("senza variabile è 'completo'", () => {
    delete process.env.NEXT_PUBLIC_PLAN
    expect(getPlan()).toBe("completo")
  })
})

describe("hasFeature", () => {
  it("nel livello completo ogni funzione è attiva", () => {
    for (const feature of ALL_FEATURES) {
      expect(hasFeature(feature, "completo")).toBe(true)
    }
  })

  it("nel livello base ogni funzione avanzata è spenta", () => {
    for (const feature of ALL_FEATURES) {
      expect(hasFeature(feature, "base")).toBe(false)
    }
  })

  it("senza livello esplicito usa quello dell'ambiente", () => {
    const original = process.env.NEXT_PUBLIC_PLAN
    process.env.NEXT_PUBLIC_PLAN = "base"
    expect(hasFeature("materiale")).toBe(false)
    delete process.env.NEXT_PUBLIC_PLAN
    expect(hasFeature("materiale")).toBe(true)
    if (original !== undefined) process.env.NEXT_PUBLIC_PLAN = original
  })
})

describe("statusOrderForPlan", () => {
  it("nel completo restituisce tutti gli stati", () => {
    expect(statusOrderForPlan("completo")).toEqual(STATUS_ORDER)
  })

  it("nel base salta solo la bozza grafica e mantiene l'ordine", () => {
    expect(statusOrderForPlan("base")).toEqual([
      "preventivo",
      "da_fare",
      "in_lavorazione",
      "pronto",
      "consegnato",
    ])
  })

  it("non modifica la costante originale", () => {
    statusOrderForPlan("base")
    expect(STATUS_ORDER).toContain("bozza_grafica")
  })
})

describe("resolvePrintFormat", () => {
  it("nel completo senza parametro è l'etichetta (come oggi)", () => {
    expect(resolvePrintFormat(undefined, "completo")).toBe("etichetta")
  })

  it("nel completo con formato=foglio è il foglio lavoro", () => {
    expect(resolvePrintFormat("foglio", "completo")).toBe("foglio")
  })

  it("nel completo un formato sconosciuto ripiega sull'etichetta", () => {
    expect(resolvePrintFormat("altro", "completo")).toBe("etichetta")
  })

  it("nel base è sempre il foglio lavoro, anche chiedendo l'etichetta", () => {
    expect(resolvePrintFormat(undefined, "base")).toBe("foglio")
    expect(resolvePrintFormat("etichetta", "base")).toBe("foglio")
    expect(resolvePrintFormat("foglio", "base")).toBe("foglio")
  })
})
