import { ordersToCsv, type OrderExportRow } from "@/lib/csv"

function makeOrder(overrides: Partial<OrderExportRow> = {}): OrderExportRow {
  return {
    nome: "Gigi",
    cognome: "Rossi",
    telefono: "3331234567",
    email_cliente: "gigi@example.com",
    cosa_ordinato: "Targa incisa",
    data_ordine: "2026-08-01",
    data_consegna: "2026-08-10",
    data_consegnato: null,
    status: "pronto",
    operatore: "Maria",
    prezzo: 50,
    acconto: 20,
    saldo: 30,
    note: null,
    ...overrides,
  }
}

describe("ordersToCsv", () => {
  it("returns just the header row for an empty list", () => {
    const csv = ordersToCsv([])
    expect(csv).toBe(
      "Nome,Cognome,Telefono,Email,Cosa ordinato,Data ordine,Data consegna,Data consegnato,Stato,Operatore,Prezzo,Acconto,Saldo,Note"
    )
  })

  it("maps a full order to a CSV row, translating status to its Italian label", () => {
    const csv = ordersToCsv([makeOrder()])
    const lines = csv.split("\r\n")
    expect(lines[1]).toBe(
      "Gigi,Rossi,3331234567,gigi@example.com,Targa incisa,2026-08-01,2026-08-10,,Pronto,Maria,50,20,30,"
    )
  })

  it("turns null fields into empty strings instead of the literal word null", () => {
    const csv = ordersToCsv([
      makeOrder({ cognome: null, telefono: null, email_cliente: null, data_consegnato: null, operatore: null, note: null }),
    ])
    const lines = csv.split("\r\n")
    expect(lines[1]).not.toContain("null")
  })

  it("wraps a field containing a comma in quotes", () => {
    const csv = ordersToCsv([makeOrder({ cosa_ordinato: "Targa, incisione oro" })])
    expect(csv).toContain('"Targa, incisione oro"')
  })

  it("doubles internal quotes and wraps the field in quotes", () => {
    const csv = ordersToCsv([makeOrder({ note: 'Cliente dice "urgente"' })])
    expect(csv).toContain('"Cliente dice ""urgente"""')
  })

  it("falls back to the raw status value if it has no known Italian label", () => {
    const csv = ordersToCsv([makeOrder({ status: "stato_sconosciuto" })])
    expect(csv).toContain("stato_sconosciuto")
  })
})