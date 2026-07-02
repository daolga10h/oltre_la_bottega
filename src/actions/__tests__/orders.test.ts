import { createSupabaseMock } from "@/lib/testUtils/supabaseMock"

const mockCreateClient = jest.fn()
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

import { getOrders, updateOrderStatus, createOrder } from "../orders"

describe("getOrders filters", () => {
  afterEach(() => jest.clearAllMocks())

  it("filters by exact status when status is given and is not 'tutti'", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrders({ status: "in_lavorazione" })

    const builder = client.from.mock.results[0].value
    expect(builder.eq).toHaveBeenCalledWith("status", "in_lavorazione")
    expect(builder.neq).not.toHaveBeenCalled()
  })

  it("excludes delivered orders when activeOnly is set and no explicit status is given", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrders({ activeOnly: true })

    const builder = client.from.mock.results[0].value
    expect(builder.neq).toHaveBeenCalledWith("status", "consegnato")
  })

  it("status='tutti' + activeOnly still excludes consegnato — 'tutti' means all ACTIVE statuses, not literally all rows", async () => {
    // fragile point: the only real caller (orders/page.tsx) always passes activeOnly: true,
    // and its "Tutti" filter option maps to status="tutti". Because the else-if falls through
    // to activeOnly when status is "tutti", a user clicking "Tutti" can never see consegnato
    // orders through this filter — intentional per CLAUDE.md ("Ordini mostra solo attivi"),
    // but easy to break by mistake since nothing in the code makes that coupling explicit.
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrders({ status: "tutti", activeOnly: true })

    const builder = client.from.mock.results[0].value
    expect(builder.eq).not.toHaveBeenCalled()
    expect(builder.neq).toHaveBeenCalledWith("status", "consegnato")
  })

  it("searches across nome, cognome, cosa_ordinato and telefono", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrders({ search: "rossi" })

    const builder = client.from.mock.results[0].value
    const orArg = builder.or.mock.calls[0][0] as string
    expect(orArg).toBe('nome.ilike."%rossi%",cognome.ilike."%rossi%",cosa_ordinato.ilike."%rossi%",telefono.ilike."%rossi%"')
  })

  it("quotes a search term containing a comma so it is treated as one literal value, not split into extra clauses", async () => {
    // A customer typing "Rossi, Mario" (or a pasted "cosa ordinato" with a comma)
    // must not be split by PostgREST's .or() comma delimiter — the whole term
    // is wrapped in double quotes to keep it as a single literal value.
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrders({ search: "Rossi, Mario" })

    const builder = client.from.mock.results[0].value
    const orArg = builder.or.mock.calls[0][0] as string
    expect(orArg).toBe(
      'nome.ilike."%Rossi, Mario%",cognome.ilike."%Rossi, Mario%",cosa_ordinato.ilike."%Rossi, Mario%",telefono.ilike."%Rossi, Mario%"'
    )
  })

  it("escapes double quotes and backslashes inside the search term", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrders({ search: 'targa "VIP"' })

    const builder = client.from.mock.results[0].value
    const orArg = builder.or.mock.calls[0][0] as string
    expect(orArg).toContain('nome.ilike."%targa \\"VIP\\"%"')
  })

  it("also protects parentheses and periods in the search term from PostgREST's .or() grouping syntax", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await getOrders({ search: "Mario (VIP) sig.ra" })

    const builder = client.from.mock.results[0].value
    const orArg = builder.or.mock.calls[0][0] as string
    expect(orArg).toContain('nome.ilike."%Mario (VIP) sig.ra%"')
  })
})

describe("updateOrderStatus", () => {
  afterEach(() => jest.clearAllMocks())

  it("stamps data_consegnato with today's date only when moving to consegnato", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-02T10:00:00Z"))
    const client = createSupabaseMock({ orders: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await updateOrderStatus("id1", "consegnato")

    const builder = client.from.mock.results[0].value
    const updatePayload = builder.update.mock.calls[0][0]
    expect(updatePayload.status).toBe("consegnato")
    expect(updatePayload.data_consegnato).toBe("2026-07-02")

    jest.useRealTimers()
  })

  it("does not touch data_consegnato for any other status", async () => {
    const client = createSupabaseMock({ orders: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await updateOrderStatus("id1", "pronto")

    const builder = client.from.mock.results[0].value
    const updatePayload = builder.update.mock.calls[0][0]
    expect(updatePayload).toEqual({ status: "pronto" })
  })

  it("logs a human-readable Italian event for every known status", async () => {
    const client = createSupabaseMock({ orders: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await updateOrderStatus("id1", "pronto")

    const eventsBuilder = client.from.mock.results[1].value
    expect(client.from).toHaveBeenNthCalledWith(2, "order_events")
    const eventPayload = eventsBuilder.insert.mock.calls[0][0]
    expect(eventPayload.note).toBe("Pronto per la consegna")
  })

  it("falls back to the raw status string if it is not in the label map", async () => {
    const client = createSupabaseMock({ orders: [{ data: null, error: null }] })
    mockCreateClient.mockResolvedValue(client)

    await updateOrderStatus("id1", "stato_sconosciuto")

    const eventsBuilder = client.from.mock.results[1].value
    const eventPayload = eventsBuilder.insert.mock.calls[0][0]
    expect(eventPayload.note).toBe("stato_sconosciuto")
  })

  it("throws when the update fails", async () => {
    const client = createSupabaseMock({ orders: [{ data: null, error: { message: "db down" } }] })
    mockCreateClient.mockResolvedValue(client)
    jest.spyOn(console, "error").mockImplementation(() => {})

    await expect(updateOrderStatus("id1", "pronto")).rejects.toThrow()
  })
})

describe("createOrder", () => {
  afterEach(() => jest.clearAllMocks())

  it("inserts the order then logs a 'created' event against the returned id", async () => {
    const client = createSupabaseMock({
      orders: [{ data: { id: "new-id" }, error: null }],
      order_events: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const result = await createOrder({ nome: "Gigi", cosa_ordinato: "Targa" })

    expect(result).toEqual({ id: "new-id" })
    const eventsBuilder = client.from.mock.results[1].value
    expect(client.from).toHaveBeenNthCalledWith(2, "order_events")
    expect(eventsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: "new-id", event_type: "created" })
    )
  })

  it("if the order_events insert fails, createOrder does not surface an error — the order exists with no timeline entry", async () => {
    // fragile point: the two inserts are not transactional and the second one's
    // error is neither checked nor thrown. This documents current (risky) behavior.
    const client = createSupabaseMock({
      orders: [{ data: { id: "new-id" }, error: null }],
      order_events: [{ data: null, error: { message: "insert failed" } }],
    })
    mockCreateClient.mockResolvedValue(client)

    await expect(createOrder({ nome: "Gigi", cosa_ordinato: "Targa" })).resolves.toEqual({ id: "new-id" })
  })

  it("throws a save-failed AppError when the order insert itself fails", async () => {
    const client = createSupabaseMock({
      orders: [{ data: null, error: { message: "constraint violation" } }],
    })
    mockCreateClient.mockResolvedValue(client)
    jest.spyOn(console, "error").mockImplementation(() => {})

    await expect(createOrder({ nome: "Gigi", cosa_ordinato: "Targa" })).rejects.toThrow()
  })
})
