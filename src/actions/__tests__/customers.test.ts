import { createSupabaseMock } from "@/lib/testUtils/supabaseMock"

const mockCreateClient = jest.fn()
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))

import { getCustomers, getOrdersByCustomer } from "../customers"

describe("getCustomers", () => {
  afterEach(() => jest.clearAllMocks())

  it("groups multiple orders from the same phone number into one customer", async () => {
    const rows = [
      { nome: "Maria", cognome: "Rossi", telefono: "3331112222", email_cliente: "m@x.it", consenso_marketing: false, data_ordine: "2026-06-01" },
      { nome: "Maria", cognome: "Rossi", telefono: "3331112222", email_cliente: "m@x.it", consenso_marketing: true, data_ordine: "2026-06-20" },
    ]
    mockCreateClient.mockResolvedValue(createSupabaseMock({ orders: [{ data: rows, error: null }] }))

    const result = await getCustomers()

    expect(result).toHaveLength(1)
    expect(result[0].totale_ordini).toBe(2)
    expect(result[0].ultimo_ordine).toBe("2026-06-20")
  })

  it("marks consenso_marketing true if ANY of the customer's orders granted it", async () => {
    const rows = [
      { nome: "Luca", cognome: null, telefono: "111", email_cliente: null, consenso_marketing: false, data_ordine: "2026-06-01" },
      { nome: "Luca", cognome: null, telefono: "111", email_cliente: null, consenso_marketing: true, data_ordine: "2026-06-02" },
    ]
    mockCreateClient.mockResolvedValue(createSupabaseMock({ orders: [{ data: rows, error: null }] }))

    const [customer] = await getCustomers()
    expect(customer.consenso_marketing).toBe(true)
  })

  it("falls back to nome+cognome as the grouping key when telefono is missing, without merging different customers", async () => {
    const rows = [
      { nome: "Anna", cognome: "Bianchi", telefono: null, email_cliente: null, consenso_marketing: false, data_ordine: "2026-06-01" },
      { nome: "Anna", cognome: "Verdi", telefono: null, email_cliente: null, consenso_marketing: false, data_ordine: "2026-06-02" },
    ]
    mockCreateClient.mockResolvedValue(createSupabaseMock({ orders: [{ data: rows, error: null }] }))

    const result = await getCustomers()
    expect(result).toHaveLength(2)
  })

  it("treats an empty-string telefono as missing rather than as a shared grouping key", async () => {
    // regression guard: `o.telefono?.trim() || fallback` — two customers who both
    // happen to have telefono: "" must NOT be merged into a single customer under key ""
    const rows = [
      { nome: "Piero", cognome: "Neri", telefono: "", email_cliente: null, consenso_marketing: false, data_ordine: "2026-06-01" },
      { nome: "Sara", cognome: "Blu", telefono: "", email_cliente: null, consenso_marketing: false, data_ordine: "2026-06-02" },
    ]
    mockCreateClient.mockResolvedValue(createSupabaseMock({ orders: [{ data: rows, error: null }] }))

    const result = await getCustomers()
    expect(result).toHaveLength(2)
  })

  it("sorts customers by most recent order first", async () => {
    const rows = [
      { nome: "Old", cognome: null, telefono: "1", email_cliente: null, consenso_marketing: false, data_ordine: "2026-01-01" },
      { nome: "New", cognome: null, telefono: "2", email_cliente: null, consenso_marketing: false, data_ordine: "2026-06-01" },
    ]
    mockCreateClient.mockResolvedValue(createSupabaseMock({ orders: [{ data: rows, error: null }] }))

    const result = await getCustomers()
    expect(result.map((c) => c.nome)).toEqual(["New", "Old"])
  })
})

describe("getOrdersByCustomer", () => {
  afterEach(() => jest.clearAllMocks())

  it("filters by exact telefono when provided", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrdersByCustomer("Maria Rossi", "3331112222")

    const builder = client.from.mock.results[0].value
    expect(builder.eq).toHaveBeenCalledWith("telefono", "3331112222")
    expect(builder.ilike).not.toHaveBeenCalled()
  })

  it("falls back to a partial ilike match on the first word of nome when telefono is absent", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrdersByCustomer("Maria Rossi", null)

    const builder = client.from.mock.results[0].value
    expect(builder.ilike).toHaveBeenCalledWith("nome", "%Maria%")
  })
})
