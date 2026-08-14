const mockCreateAdminClient = jest.fn()
jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}))

const mockSendBackupEmail = jest.fn()
jest.mock("@/lib/email/sendBackupEmail", () => ({
  sendBackupEmail: (...args: unknown[]) => mockSendBackupEmail(...args),
}))

import { GET } from "../route"

function makeRequest(secret?: string): Request {
  return new Request("http://localhost/api/cron/weekly-backup", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

function mockAdminClient(orders: unknown[], ordersError: unknown = null) {
  return {
    auth: {
      admin: {
        listUsers: () =>
          Promise.resolve({
            data: {
              users: [
                { id: "u1", email: "bottega@example.com", user_metadata: { shop_name: "La Bottega" } },
              ],
            },
            error: null,
          }),
      },
    },
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: ordersError ? null : orders, error: ordersError }),
      }),
    }),
  }
}

describe("GET /api/cron/weekly-backup", () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    process.env = { ...OLD_ENV, CRON_SECRET: "test-secret" }
    mockSendBackupEmail.mockResolvedValue(undefined)
  })
  afterEach(() => {
    process.env = OLD_ENV
    jest.clearAllMocks()
  })

  it("returns 401 when the secret header is wrong", async () => {
    const res = await GET(makeRequest("wrong-secret"))
    expect(res.status).toBe(401)
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it("returns 401 when the secret header is missing", async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it("sends the CSV backup to the shop's own email on success", async () => {
    mockCreateAdminClient.mockReturnValue(
      mockAdminClient([
        {
          nome: "Gigi",
          cognome: "Rossi",
          telefono: null,
          email_cliente: null,
          cosa_ordinato: "Targa",
          data_ordine: "2026-08-01",
          data_consegna: null,
          data_consegnato: null,
          status: "pronto",
          operatore: "Maria",
          prezzo: 10,
          acconto: 0,
          saldo: 10,
          note: null,
        },
      ])
    )

    const res = await GET(makeRequest("test-secret"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.count).toBe(1)
    expect(mockSendBackupEmail).toHaveBeenCalledTimes(1)
    const call = mockSendBackupEmail.mock.calls[0][0]
    expect(call.to).toBe("bottega@example.com")
    expect(call.shopName).toBe("La Bottega")
    expect(call.csv).toContain("Gigi")
  })

  it("returns 500 and does not send an email if the orders query fails", async () => {
    mockCreateAdminClient.mockReturnValue(mockAdminClient([], new Error("boom")))
    jest.spyOn(console, "error").mockImplementation(() => {})

    const res = await GET(makeRequest("test-secret"))

    expect(res.status).toBe(500)
    expect(mockSendBackupEmail).not.toHaveBeenCalled()
  })

  it("returns 500 and does not report success if sendBackupEmail throws", async () => {
    mockCreateAdminClient.mockReturnValue(
      mockAdminClient([
        {
          nome: "Gigi", cognome: "Rossi", telefono: null, email_cliente: null,
          cosa_ordinato: "Targa", data_ordine: "2026-08-01", data_consegna: null,
          data_consegnato: null, status: "pronto", operatore: "Maria",
          prezzo: 10, acconto: 0, saldo: 10, note: null,
        },
      ])
    )
    mockSendBackupEmail.mockRejectedValue(new Error("Resend down"))
    jest.spyOn(console, "error").mockImplementation(() => {})

    const res = await GET(makeRequest("test-secret"))

    expect(res.status).toBe(500)
  })
})
