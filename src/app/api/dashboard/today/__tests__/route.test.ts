import { createSupabaseMock } from "@/lib/testUtils/supabaseMock"

const mockCreateClient = jest.fn()
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))

import { GET } from "../route"

// L'ordine delle risposte deve rispettare l'ordine dei from("orders") nel
// Promise.all della route: open, urgent, overdue, todayOrders, deliveredToday,
// materialeDaOrdinare, materialeOrdinatoOggi.
function mockOrdersSequence(
  counts: { open: number; urgent: number; overdue: number },
  todayOrders: unknown[],
  deliveredToday: unknown[],
  materialeDaOrdinare: unknown[] = [],
  materialeOrdinatoOggi: unknown[] = []
) {
  return createSupabaseMock({
    orders: [
      { data: null, error: null, count: counts.open },
      { data: null, error: null, count: counts.urgent },
      { data: null, error: null, count: counts.overdue },
      { data: todayOrders, error: null },
      { data: deliveredToday, error: null },
      { data: materialeDaOrdinare, error: null },
      { data: materialeOrdinatoOggi, error: null },
    ],
    reminders: [{ data: [], error: null }],
  })
}

describe("GET /api/dashboard/today", () => {
  afterEach(() => jest.clearAllMocks())

  it("returns 401 when there is no authenticated user", async () => {
    const client = mockOrdersSequence({ open: 0, urgent: 0, overdue: 0 }, [], [])
    client.auth.getUser = jest.fn(() => Promise.resolve({ data: { user: null } }))
    mockCreateClient.mockResolvedValue(client)

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("maps each Supabase count to the correct KPI field", async () => {
    const client = mockOrdersSequence({ open: 12, urgent: 4, overdue: 2 }, [{ id: "o1" }], [])
    mockCreateClient.mockResolvedValue(client)

    const res = await GET()
    const body = await res.json()

    expect(body.kpi).toEqual({ open: 12, urgent: 4, overdue: 2, todayDeliveries: 1 })
  })

  it("counts todayDeliveries from the todayOrders row count, not a separate query", async () => {
    // regression guard: kpi.todayDeliveries is derived from todayRes.data.length,
    // it is easy to accidentally wire it to deliveredRes (consegnati oggi) instead
    const todayOrders = [{ id: "a" }, { id: "b" }, { id: "c" }]
    const deliveredToday = [{ id: "x" }]
    const client = mockOrdersSequence({ open: 0, urgent: 0, overdue: 0 }, todayOrders, deliveredToday)
    mockCreateClient.mockResolvedValue(client)

    const res = await GET()
    const body = await res.json()

    expect(body.kpi.todayDeliveries).toBe(3)
    expect(body.deliveredToday).toEqual(deliveredToday)
  })

  it("defaults every count to 0 instead of null/undefined when Supabase returns no count", async () => {
    const client = createSupabaseMock({
      orders: [
        { data: null, error: null, count: null },
        { data: null, error: null, count: null },
        { data: null, error: null, count: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
      reminders: [{ data: null, error: null }],
    })
    mockCreateClient.mockResolvedValue(client)

    const res = await GET()
    const body = await res.json()

    expect(body.kpi).toEqual({ open: 0, urgent: 0, overdue: 0, todayDeliveries: 0 })
    expect(body.todayOrders).toEqual([])
    expect(body.deliveredToday).toEqual([])
    expect(body.materialeDaOrdinare).toEqual([])
    expect(body.materialeOrdinatoOggi).toEqual([])
    expect(body.reminders).toEqual([])
  })

  it("returns 500 and does not leak internals if a query throws", async () => {
    mockCreateClient.mockImplementation(() => {
      throw new Error("supabase unreachable")
    })
    jest.spyOn(console, "error").mockImplementation(() => {})

    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Internal server error")
  })
})

describe("materiale sections", () => {
  afterEach(() => jest.clearAllMocks())

  it("returns materialeDaOrdinare and materialeOrdinatoOggi from their dedicated queries", async () => {
    const daOrdinare = [{ id: "m1", cosa_ordinato: "Targa", nome: "Gigi", cognome: null }]
    const ordinatoOggi = [{ id: "m2", cosa_ordinato: "Timbro", nome: "Ada", cognome: null }]
    const client = mockOrdersSequence({ open: 0, urgent: 0, overdue: 0 }, [], [], daOrdinare, ordinatoOggi)
    mockCreateClient.mockResolvedValue(client)

    const res = await GET()
    const body = await res.json()

    expect(body.materialeDaOrdinare).toEqual(daOrdinare)
    expect(body.materialeOrdinatoOggi).toEqual(ordinatoOggi)
  })
})
