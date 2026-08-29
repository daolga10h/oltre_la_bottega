import { createSupabaseMock } from "@/lib/testUtils/supabaseMock"

const mockCreateClient = jest.fn()
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))

import { GET } from "../route"

describe("GET /api/search", () => {
  afterEach(() => jest.clearAllMocks())

  it("returns an empty list when the query is missing or shorter than 2 chars", async () => {
    const req = new Request("http://localhost/api/search?q=a")
    const res = await GET(req)
    const body = await res.json()
    expect(body).toEqual({ orders: [] })
  })

  it("returns an empty list when there is no authenticated user", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] }, { user: null })
    mockCreateClient.mockResolvedValue(client)

    const req = new Request("http://localhost/api/search?q=rossi")
    const res = await GET(req)
    const body = await res.json()
    expect(body).toEqual({ orders: [] })
  })

  it("includes azienda in the select so results can be labeled with it", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const req = new Request("http://localhost/api/search?q=rossi")
    await GET(req)

    const builder = client.from.mock.results[0].value
    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining("azienda"))
  })

  it("searches across nome, cognome, cosa_ordinato, telefono and azienda with escaping", async () => {
    const client = createSupabaseMock({ orders: [{ data: [], error: null }] })
    mockCreateClient.mockResolvedValue(client)

    const req = new Request(`http://localhost/api/search?q=${encodeURIComponent("Rossi, Mario")}`)
    await GET(req)

    const builder = client.from.mock.results[0].value
    const orArg = builder.or.mock.calls[0][0] as string
    expect(orArg).toBe(
      'nome.ilike."%Rossi, Mario%",cognome.ilike."%Rossi, Mario%",cosa_ordinato.ilike."%Rossi, Mario%",telefono.ilike."%Rossi, Mario%",azienda.ilike."%Rossi, Mario%"'
    )
  })
})
