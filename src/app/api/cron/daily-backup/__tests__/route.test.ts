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
  return new Request("http://localhost/api/cron/daily-backup", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

const oneOrder = [
  {
    nome: "Gigi", cognome: "Rossi", telefono: null, email_cliente: null,
    cosa_ordinato: "Targa", data_ordine: "2026-08-01", data_consegna: null,
    data_consegnato: null, status: "pronto", operatore: "Maria",
    prezzo: 10, acconto: 0, saldo: 10, note: null,
  },
]

function mockAdminClient(
  orders: unknown[],
  ordersError: unknown = null,
  users: unknown[] = [{ id: "u1", email: "bottega@example.com", user_metadata: { shop_name: "La Bottega" } }],
  usersError: unknown = null
) {
  return {
    auth: {
      admin: {
        listUsers: () =>
          Promise.resolve({
            data: usersError ? null : { users },
            error: usersError,
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

describe("GET /api/cron/daily-backup", () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    process.env = { ...OLD_ENV, CRON_SECRET: "test-secret", BACKUP_EMAIL_TO: "bottega@example.com" }
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

  it("returns 500 and does not touch the database when BACKUP_EMAIL_TO is not configured", async () => {
    delete process.env.BACKUP_EMAIL_TO
    jest.spyOn(console, "error").mockImplementation(() => {})

    const res = await GET(makeRequest("test-secret"))

    expect(res.status).toBe(500)
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
    expect(mockSendBackupEmail).not.toHaveBeenCalled()
  })

  it("sends the CSV backup to BACKUP_EMAIL_TO, using the shop name of the matching auth user", async () => {
    mockCreateAdminClient.mockReturnValue(mockAdminClient(oneOrder))

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

  it("still sends the backup when extra/stray accounts exist in Supabase Auth (regression: no longer requires exactly one shop user)", async () => {
    mockCreateAdminClient.mockReturnValue(
      mockAdminClient(oneOrder, null, [
        { id: "u1", email: "bottega@example.com", user_metadata: { shop_name: "La Bottega" } },
        { id: "u2", email: "vecchio-account-fantasma@esempio.it", user_metadata: {} },
        { id: "u3", email: "e2e-test@oltrelabottega.local", user_metadata: {} },
      ])
    )

    const res = await GET(makeRequest("test-secret"))

    expect(res.status).toBe(200)
    expect(mockSendBackupEmail).toHaveBeenCalledTimes(1)
    const call = mockSendBackupEmail.mock.calls[0][0]
    expect(call.to).toBe("bottega@example.com")
    expect(call.shopName).toBe("La Bottega")
  })

  it("falls back to the default shop name when no auth user matches BACKUP_EMAIL_TO", async () => {
    mockCreateAdminClient.mockReturnValue(
      mockAdminClient(oneOrder, null, [
        { id: "u2", email: "qualcun-altro@esempio.it", user_metadata: { shop_name: "Altro" } },
      ])
    )

    const res = await GET(makeRequest("test-secret"))

    expect(res.status).toBe(200)
    expect(mockSendBackupEmail.mock.calls[0][0].to).toBe("bottega@example.com")
    expect(mockSendBackupEmail.mock.calls[0][0].shopName).toBe("OB")
  })

  it("still sends the backup even if listing auth users fails (shop name falls back, delivery is not blocked)", async () => {
    mockCreateAdminClient.mockReturnValue(
      mockAdminClient(oneOrder, null, [], new Error("auth admin API down"))
    )
    jest.spyOn(console, "error").mockImplementation(() => {})

    const res = await GET(makeRequest("test-secret"))

    expect(res.status).toBe(200)
    expect(mockSendBackupEmail.mock.calls[0][0].to).toBe("bottega@example.com")
  })

  it("returns 500 and does not send an email if the orders query fails", async () => {
    mockCreateAdminClient.mockReturnValue(mockAdminClient([], new Error("boom")))
    jest.spyOn(console, "error").mockImplementation(() => {})

    const res = await GET(makeRequest("test-secret"))

    expect(res.status).toBe(500)
    expect(mockSendBackupEmail).not.toHaveBeenCalled()
  })

  it("returns 500 and does not report success if sendBackupEmail throws", async () => {
    mockCreateAdminClient.mockReturnValue(mockAdminClient(oneOrder))
    mockSendBackupEmail.mockRejectedValue(new Error("Resend down"))
    jest.spyOn(console, "error").mockImplementation(() => {})

    const res = await GET(makeRequest("test-secret"))

    expect(res.status).toBe(500)
  })
})
