import { buildDemoData, giorno, type DemoOrder } from "../demoData"
import { computeOrderSummary } from "../../orderItems"
import { computeSaldo } from "../../orderConstants"

const OGGI = new Date("2026-09-30T10:00:00Z")
const STATI_BASE = ["preventivo", "da_fare", "in_lavorazione", "pronto", "consegnato"]

function ordini(oggi: Date = OGGI): DemoOrder[] {
  return buildDemoData(oggi).orders
}

describe("giorno", () => {
  it("calcola giorni relativi a oggi", () => {
    expect(giorno(OGGI, 0)).toBe("2026-09-30")
    expect(giorno(OGGI, 1)).toBe("2026-10-01")
    expect(giorno(OGGI, -30)).toBe("2026-08-31")
  })

  it("attraversa correttamente i cambi di mese e di anno", () => {
    expect(giorno(new Date("2026-01-01T12:00:00Z"), -1)).toBe("2025-12-31")
    expect(giorno(new Date("2026-12-31T12:00:00Z"), 1)).toBe("2027-01-01")
  })
})

describe("buildDemoData — la giornata di oggi", () => {
  const conta = (oggi: Date, filtro: (o: DemoOrder) => boolean) => ordini(oggi).filter(filtro).length

  it("ha 2 lavori da consegnare oggi (non ancora consegnati)", () => {
    const oggi = giorno(OGGI, 0)
    expect(conta(OGGI, (o) => o.order.data_consegna === oggi && o.order.status !== "consegnato")).toBe(2)
  })

  it("ha 1 lavoro consegnato oggi", () => {
    const oggi = giorno(OGGI, 0)
    expect(conta(OGGI, (o) => o.order.data_consegnato === oggi)).toBe(1)
  })

  it("ha 3 ordini pronti da avvisare", () => {
    expect(conta(OGGI, (o) => o.order.status === "pronto" && !o.order.msg_pronto_inviato)).toBe(3)
  })

  it("ha 2 ordini in ritardo", () => {
    const oggi = giorno(OGGI, 0)
    expect(
      conta(OGGI, (o) => !!o.order.data_consegna && o.order.data_consegna < oggi && o.order.status !== "consegnato")
    ).toBe(2)
  })

  it("ha 3 preventivi, da inviare o inviati", () => {
    const preventivi = ordini().filter((o) => o.order.status === "preventivo")
    expect(preventivi).toHaveLength(3)
    for (const p of preventivi) expect(["da_inviare", "inviato"]).toContain(p.order.preventivo)
  })

  it("ha almeno una recensione da chiedere", () => {
    expect(
      conta(OGGI, (o) => o.order.status === "consegnato" && o.order.chiedere_recensione && !o.order.recensione_ricevuta)
    ).toBeGreaterThanOrEqual(1)
  })

  it("la giornata resta la stessa cambiando il giorno di esecuzione", () => {
    const altro = new Date("2027-03-15T08:00:00Z")
    const oggi = giorno(altro, 0)
    expect(conta(altro, (o) => o.order.data_consegna === oggi && o.order.status !== "consegnato")).toBe(2)
    expect(conta(altro, (o) => o.order.data_consegnato === oggi)).toBe(1)
    expect(conta(altro, (o) => o.order.status === "pronto" && !o.order.msg_pronto_inviato)).toBe(3)
  })
})

describe("buildDemoData — coerenza dei dati", () => {
  it("ha circa 20 ordini e 15 clienti diversi", () => {
    const lista = ordini()
    expect(lista.length).toBeGreaterThanOrEqual(18)
    expect(lista.length).toBeLessThanOrEqual(22)
    const clienti = new Set(lista.map((o) => o.order.telefono))
    expect(clienti.size).toBe(15)
  })

  it("ogni ordine ha una sola riga articolo (il livello base non ha il multi-riga)", () => {
    for (const o of ordini()) expect(o.items).toHaveLength(1)
  })

  it("cosa_ordinato, prezzo e saldo sono coerenti con le righe", () => {
    for (const o of ordini()) {
      const { cosaOrdinato, prezzo } = computeOrderSummary(o.items)
      expect(o.order.cosa_ordinato).toBe(cosaOrdinato)
      expect(o.order.prezzo).toBe(prezzo)
      expect(o.order.saldo).toBe(computeSaldo(prezzo, o.order.acconto))
    }
  })

  it("usa solo gli stati del livello base e nessun sottostato avanzato", () => {
    for (const o of ordini()) {
      expect(STATI_BASE).toContain(o.order.status)
      expect(o.order.bozza_grafica).toBe("non_serve")
      expect(o.order.materiale).toBe("non_serve")
    }
  })

  it("gli ordini consegnati hanno data di consegna effettiva, saldo zero e un evento in cronologia", () => {
    for (const o of ordini().filter((x) => x.order.status === "consegnato")) {
      expect(o.order.data_consegnato).not.toBeNull()
      expect(o.order.saldo).toBe(0)
      expect(o.events.map((e) => e.event_type)).toEqual(["created", "status_change"])
    }
  })

  it("gli ordini non consegnati non hanno data di consegna effettiva", () => {
    for (const o of ordini().filter((x) => x.order.status !== "consegnato")) {
      expect(o.order.data_consegnato).toBeNull()
      expect(o.events.map((e) => e.event_type)).toEqual(["created"])
    }
  })

  it("un cliente torna più volte (storico): almeno 3 ordini con lo stesso telefono", () => {
    const perTelefono = new Map<string, number>()
    for (const o of ordini()) perTelefono.set(o.order.telefono, (perTelefono.get(o.order.telefono) ?? 0) + 1)
    expect(Math.max(...perTelefono.values())).toBeGreaterThanOrEqual(3)
  })

  it("i clienti ente hanno cognome e azienda vuoti, un referente e nessuna recensione da chiedere", () => {
    const enti = ordini().filter((o) => o.order.is_ente)
    expect(enti.length).toBeGreaterThanOrEqual(2)
    for (const o of enti) {
      expect(o.order.cognome).toBeNull()
      expect(o.order.azienda).toBeNull()
      expect(o.order.referente).toBeTruthy()
      expect(o.order.chiedere_recensione).toBe(false)
    }
  })

  it("i telefoni sono tutti inventati (333 0000xxx) e le email usano il dominio riservato example.com", () => {
    for (const o of ordini()) {
      expect(o.order.telefono).toMatch(/^333 0000\d{3}$/)
      if (o.order.email_cliente) expect(o.order.email_cliente).toMatch(/@example\.com$/)
    }
  })

  it("un ordine con canale 'mail' ha l'email del cliente", () => {
    for (const o of ordini().filter((x) => x.order.canale === "mail")) {
      expect(o.order.email_cliente).toBeTruthy()
    }
  })

  it("è deterministico: lo stesso giorno produce gli stessi dati", () => {
    expect(JSON.stringify(buildDemoData(OGGI))).toBe(JSON.stringify(buildDemoData(OGGI)))
  })
})

describe("buildDemoData — promemoria", () => {
  const { reminders } = buildDemoData(OGGI)

  it("ha 3 promemoria attivi e 1 completato oggi", () => {
    expect(reminders.filter((r) => r.status === "attivo")).toHaveLength(3)
    const completati = reminders.filter((r) => r.status === "completato")
    expect(completati).toHaveLength(1)
    expect(completati[0].completed_at?.startsWith("2026-09-30")).toBe(true)
  })

  it("gli attivi scadono oggi o prima (compaiono nella pagina Oggi)", () => {
    for (const r of reminders.filter((x) => x.status === "attivo")) {
      expect(r.due_at.slice(0, 10) <= "2026-09-30").toBe(true)
    }
  })

  it("un solo promemoria attivo è in ritardo; quelli di oggi scadono più tardi nella giornata", () => {
    const attivi = reminders.filter((r) => r.status === "attivo")
    const inRitardo = attivi.filter((r) => new Date(r.due_at).getTime() < OGGI.getTime())
    expect(inRitardo).toHaveLength(1)
    expect(inRitardo[0].due_at.slice(0, 10)).toBe("2026-09-29")
    const diOggi = attivi.filter((r) => r.due_at.slice(0, 10) === "2026-09-30")
    expect(diOggi).toHaveLength(2)
    for (const r of diOggi) expect(new Date(r.due_at).getTime()).toBeGreaterThan(OGGI.getTime())
  })
})

describe("buildDemoData — nessun istante di oggi nel futuro", () => {
  const momenti = [OGGI, new Date("2026-09-30T00:10:00Z")]

  it.each(momenti.map((m) => [m.toISOString(), m] as const))("con generazione alle %s", (_etichetta, adesso) => {
    const limite = adesso.getTime()
    const dati = buildDemoData(adesso)
    for (const o of dati.orders) {
      expect(new Date(o.order.created_at).getTime()).toBeLessThanOrEqual(limite)
      expect(new Date(o.order.updated_at).getTime()).toBeLessThanOrEqual(limite)
      for (const e of o.events) expect(new Date(e.created_at).getTime()).toBeLessThanOrEqual(limite)
    }
    for (const r of dati.reminders) {
      if (r.completed_at) expect(new Date(r.completed_at).getTime()).toBeLessThanOrEqual(limite)
    }
    expect(JSON.stringify(buildDemoData(adesso))).toBe(JSON.stringify(dati))
  })
})
